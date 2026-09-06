import { createClient } from "@supabase/supabase-js";
import { createSupabaseContractAuthorizer } from "../../../vite-plugins/contract-docx-endpoint/supabaseAuthorization.ts";
import { createPersistentEndpointDataSourceFactory } from "../../../vite-plugins/contract-docx-endpoint/persistentContractDataSource.ts";
import { createGeneratedDocumentRepository } from "../../../src/modules/document-engine/repositories/generatedDocumentRepository.ts";
import { generateParticipationContract } from "../../../src/modules/document-engine/orchestration/generateParticipationContract.ts";
import { buildGoogleContractPlaceholderMap, validateGoogleContractPlaceholderMap } from "../../../src/modules/document-engine/google/googleContractPlaceholders.ts";
import { createGoogleWorkspaceClient, refreshGoogleWorkspaceAccessToken } from "../google/portableGoogleWorkspaceClient.ts";
import { runPersistedGoogleGeneration } from "../google/portableGoogleContractGeneration.ts";
import { archiveGenerationPdf } from "../storage/immutableGenerationPdf.ts";
import { checkGoogleReadiness } from "../google/googleReadiness.ts";
import { boundedFetch, readBoundedBytes } from "./runtime.ts";

type Environment = Record<string, string | undefined>;
const EXPOSE = "Content-Disposition, X-VIAWA-Master-Template-Id, X-VIAWA-Google-Doc-Id, X-VIAWA-Google-Doc-Url, X-VIAWA-Google-Pdf-Id, X-VIAWA-Google-Pdf-Url, X-VIAWA-Generation-Status, X-VIAWA-Generated-Document-Id, X-VIAWA-Duration-Ms";

export function createContractEdgeHandler(env: Environment, baseFetch: typeof fetch = fetch, deadlineMs = 110_000,
  memoryUsage: () => Record<string, number> | undefined = () => undefined) {
  return async (request: Request): Promise<Response> => {
    const started = performance.now();
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("origin");
    const allowed = (env.CONTRACT_ALLOWED_ORIGINS ?? "").split(",").map(x => x.trim()).filter(Boolean);
    const headers: Record<string, string> = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Vary": "Origin" };
    if (origin && allowed.includes(origin)) Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Expose-Headers": EXPOSE,
    });
    const fail = (status: number, code: string, validationErrors: readonly unknown[] = []) => Response.json({ success: false, code, message: "Contract request could not be completed.", validationErrors, warnings: [] }, { status, headers });
    if (origin && !allowed.includes(origin)) return fail(403, "ORIGIN_NOT_ALLOWED");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return fail(401, "AUTHENTICATION_REQUIRED");
    const overall = AbortSignal.timeout(deadlineMs);
    const timings: { host: string; ms: number }[] = [];
    const fetcher = boundedFetch(overall, 20_000, baseFetch, (host, ms) => timings.push({ host, ms }));
    let pendingId: string | undefined;
    try {
      const url = env.SUPABASE_URL, key = env.SUPABASE_ANON_KEY;
      if (!url || !key) return fail(503, "CONFIGURATION_UNAVAILABLE");
      const client = createClient(url, key, { global: { fetch: fetcher, headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
      const auth = await client.auth.getUser(token);
      if (auth.error || !auth.data.user) return fail(401, "INVALID_AUTHENTICATION");
      let body: Record<string, unknown>;
      try { body = JSON.parse(new TextDecoder().decode(await readBoundedBytes(new Response(request.body, { headers: request.headers }), 16_384))); }
      catch { return fail(400, "INVALID_REQUEST"); }
      if (!body || typeof body !== "object" || Object.keys(body).sort().join(",") !== "companyId,opportunityId"
        || ![body.companyId, body.opportunityId].every(x => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x))) return fail(400, "INVALID_REQUEST");
      const companyId = body.companyId as string, opportunityId = body.opportunityId as string;
      const user = { id: auth.data.user.id, email: auth.data.user.email };
      const authorized = await createSupabaseContractAuthorizer({ supabaseUrl: url, supabaseAnonKey: key, fetchImpl: fetcher })({ user, accessToken: token, companyId, opportunityId });
      if (!authorized.allowed) return fail(authorized.status, authorized.code);
      const config = {
        clientId: env.GOOGLE_WORKSPACE_CLIENT_ID ?? "", clientSecret: env.GOOGLE_WORKSPACE_CLIENT_SECRET ?? "",
        refreshToken: env.GOOGLE_WORKSPACE_REFRESH_TOKEN ?? "", masterContractTemplateId: env.VIAWA_MASTER_CONTRACT_TEMPLATE_ID ?? "",
        generatedDocumentsFolderId: env.VIAWA_GENERATED_DOCUMENTS_FOLDER_ID ?? "",
      };
      // Authenticated, owner-scoped preflight; never creates an artifact.
      const readiness = await checkGoogleReadiness(config, fetcher);
      if (Object.values(readiness).some(x => x !== "ok")) return fail(503, "GOOGLE_CONFIGURATION_UNAVAILABLE");
      const schema = await client.from("generated_documents").select("id,file_name,pdf_storage_path,pdf_sha256,pdf_size_bytes,signed_pdf_storage_path,signed_pdf_file_name,signature_completed_at").limit(0);
      if (schema.error) return fail(503, "GENERATED_DOCUMENT_SCHEMA_UNAVAILABLE");
      const persistence = createGeneratedDocumentRepository(client);
      const tracked = { ...persistence, createPending: async (value: Parameters<typeof persistence.createPending>[0]) => {
        const row = await persistence.createPending(value); pendingId = row.id;
        console.log(JSON.stringify({ stage: "contract_pending", requestId, generatedDocumentId: row.id })); return row;
      }, markFailed: async (row: Parameters<typeof persistence.markFailed>[0]) => {
        // Failure evidence has its own bounded cleanup window after generation timeout.
        const cleanupClient = createClient(url, key, { global: { fetch: boundedFetch(AbortSignal.timeout(5_000), 5_000, baseFetch), headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
        await createGeneratedDocumentRepository(cleanupClient).markFailed(row);
      } };
      let generated: Awaited<ReturnType<typeof runPersistedGoogleGeneration>> | undefined;
      const result = await generateParticipationContract({ companyId, opportunityId }, {
        dataSource: createPersistentEndpointDataSourceFactory({ supabaseUrl: url, supabaseAnonKey: key, fetchImpl: fetcher })({ user, accessToken: token }),
        docxGenerator: { async generate(input) {
          const values = buildGoogleContractPlaceholderMap(input.mergeResult);
          if (validateGoogleContractPlaceholderMap(values).length) throw new Error("REQUIRED_GOOGLE_FIELDS_MISSING");
          const accessToken = await refreshGoogleWorkspaceAccessToken({ ...config, fetchImpl: fetcher });
          generated = await runPersistedGoogleGeneration({ ...input, values, masterTemplateId: config.masterContractTemplateId,
            google: createGoogleWorkspaceClient({ accessToken, masterTemplateId: config.masterContractTemplateId, generatedDocumentsFolderId: config.generatedDocumentsFolderId, fetchImpl: fetcher, requireProviderUrls: true }),
            persistence: tracked,
            onPdfReady: (pdf, baseName, row) => archiveGenerationPdf({ pdf, fileName: `${baseName}.pdf`, userId: user.id, companyId, generatedDocumentId: row.id,
              upload: (path, bytes) => client.storage.from("contract-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false }) }),
          });
          return { outputFileName: `${generated.baseName}.pdf`, outputPath: "memory", warnings: [] };
        } },
      });
      if (!result.success) return fail(422, "CONTRACT_VALIDATION_FAILED", result.validationErrors);
      if (!generated) throw new Error("MISSING_GENERATION");
      const { artifacts: a, pdf, baseName } = generated;
      const encoded = encodeURIComponent(`${baseName}.pdf`).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      return new Response(pdf as Uint8Array<ArrayBuffer>, { status: 200, headers: { ...headers, "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contract.pdf"; filename*=UTF-8''${encoded}`,
        "X-VIAWA-Master-Template-Id": a.masterTemplateId, "X-VIAWA-Google-Doc-Id": a.googleDocFileId,
        "X-VIAWA-Google-Doc-Url": a.googleDocUrl, "X-VIAWA-Google-Pdf-Id": a.googlePdfFileId,
        "X-VIAWA-Google-Pdf-Url": a.googlePdfUrl, "X-VIAWA-Generation-Status": "COMPLETED",
        "X-VIAWA-Generated-Document-Id": a.generatedDocumentId!, "X-VIAWA-Duration-Ms": String(Math.round(performance.now() - started)),
      } });
    } catch (error) {
      const timeout = overall.aborted || error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      console.error(JSON.stringify({ stage: "contract_failed", requestId, generatedDocumentId: pendingId, category: timeout ? "TIMEOUT" : "GENERATION_FAILED" }));
      return fail(timeout ? 504 : 500, timeout ? "CONTRACT_TIMEOUT" : "CONTRACT_GENERATION_FAILED");
    } finally {
      let memory: Record<string, number> | undefined;
      try { memory = memoryUsage(); } catch { /* Optional runtime telemetry cannot fail a request. */ }
      console.log(JSON.stringify({ stage: "contract_finished", requestId, generatedDocumentId: pendingId, durationMs: Math.round(performance.now() - started), memory, requestHeaderTimings: timings }));
    }
  };
}
