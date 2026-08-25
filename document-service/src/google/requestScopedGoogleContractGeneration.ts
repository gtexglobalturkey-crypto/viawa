import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateParticipationContract } from "../../../src/modules/document-engine/orchestration/generateParticipationContract.ts";
import { buildGoogleContractPlaceholderMap, validateGoogleContractPlaceholderMap } from "../../../src/modules/document-engine/google/googleContractPlaceholders.ts";
import type { ContractDocxGenerationPort, ContractGenerationDataSource } from "../../../src/modules/document-engine/orchestration/models.ts";
import type { AuthenticatedContractUser, ContractDocxEndpointDependencies } from "../../../vite-plugins/contract-docx-endpoint/models.ts";
import { createGoogleWorkspaceClient, refreshGoogleWorkspaceAccessToken, type GoogleContractArtifacts } from "./googleWorkspaceClient.ts";
import type { GeneratedDocumentPersistence, PendingGeneratedDocument } from "../../../src/modules/document-engine/repositories/generatedDocumentRepository.ts";
import type { GoogleContractPlaceholderMap } from "../../../src/modules/document-engine/google/googleContractPlaceholders.ts";

function safeName(value: string) { return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim(); }

type GoogleGenerationClient = Pick<ReturnType<typeof createGoogleWorkspaceClient>, "copyMaster" | "replaceAll" | "verifyPlaceholders" | "exportPdf" | "uploadPdf">;

export async function runPersistedGoogleGeneration(input: {
  values: GoogleContractPlaceholderMap;
  contractIdentity: { id?: string; number: string };
  companyId: string;
  opportunityId: string;
  exhibitionId: string;
  generatedAt: string;
  masterTemplateId: string;
  google: GoogleGenerationClient;
  persistence: GeneratedDocumentPersistence;
  onPdfReady?: (pdf: Buffer, baseName: string) => Promise<void>;
}) {
  if (!input.contractIdentity.id) throw new Error("CANONICAL_CONTRACT_UUID_MISSING");
  const baseName = safeName(`${input.values.CNO} — ${input.values.COMPANY_LEGAL_NAME} — ${input.values.FNM}`);
  let pending: PendingGeneratedDocument | undefined;
  try {
    pending = await input.persistence.createPending({
      contractId: input.contractIdentity.id,
      opportunityId: input.opportunityId,
      companyId: input.companyId,
      exhibitionId: input.exhibitionId,
      documentType: "participation-contract",
      templateId: input.masterTemplateId,
      generatedAt: input.generatedAt,
    });
    const copied = await input.google.copyMaster(baseName);
    await input.persistence.markDocCreated(pending, { googleDocId: copied.id, googleDocUrl: copied.url });
    await input.google.replaceAll(copied.id, input.values);
    await input.google.verifyPlaceholders(copied.id);
    const pdf = await input.google.exportPdf(copied.id);
    const uploaded = await input.google.uploadPdf(`${baseName}.pdf`, pdf);
    await input.persistence.markPdfCreated(pending, { googlePdfId: uploaded.id, googlePdfUrl: uploaded.url });
    await input.onPdfReady?.(pdf, baseName);
    await input.persistence.markCompleted(pending);
    return {
      baseName, pdf,
      artifacts: {
        masterTemplateId: input.masterTemplateId, googleDocFileId: copied.id, googleDocUrl: copied.url,
        googlePdfFileId: uploaded.id, googlePdfUrl: uploaded.url,
        generatedDocumentId: pending.id, generatedDocumentVersion: pending.version,
      } satisfies GoogleContractArtifacts,
    };
  } catch (error) {
    if (pending) {
      await input.persistence.markFailed(pending).catch((persistenceError) => {
        console.error(JSON.stringify({ level: "error", stage: "generated_document_failure_status_failed", generatedDocumentId: pending?.id, errorName: persistenceError instanceof Error ? persistenceError.name : "NonErrorThrow" }));
      });
      console.error(JSON.stringify({ level: "error", stage: "generated_document_failed", generatedDocumentId: pending.id, contractId: pending.contractId.slice(0, 8), errorName: error instanceof Error ? error.name : "NonErrorThrow" }));
    }
    throw error;
  }
}

export function createRequestScopedGoogleContractGenerator(input: {
  temporaryRoot: string;
  masterTemplateId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  generatedDocumentsFolderId: string;
  createDataSource: (context: { user: AuthenticatedContractUser; accessToken: string }) => ContractGenerationDataSource;
  createPersistence: (context: { accessToken: string }) => GeneratedDocumentPersistence;
  now?: () => Date;
}): ContractDocxEndpointDependencies["generate"] {
  return async ({ user, accessToken, companyId, opportunityId }) => {
    const directory = await mkdtemp(path.join(input.temporaryRoot, "viawa-google-contract-"));
    const cleanup = () => rm(directory, { recursive: true, force: true });
    let artifacts: GoogleContractArtifacts | undefined;
    let handedOff = false;
    try {
      const googleToken = await refreshGoogleWorkspaceAccessToken(input);
      const google = createGoogleWorkspaceClient({
        accessToken: googleToken,
        masterTemplateId: input.masterTemplateId,
        generatedDocumentsFolderId: input.generatedDocumentsFolderId,
      });
      const persistence = input.createPersistence({ accessToken });
      const generator: ContractDocxGenerationPort = {
        async generate({ mergeResult, contractIdentity, companyId: resolvedCompanyId, opportunityId: resolvedOpportunityId, exhibitionId, generatedAt }) {
          const values = buildGoogleContractPlaceholderMap(mergeResult);
          const missing = validateGoogleContractPlaceholderMap(values);
          if (missing.length) throw new Error(`REQUIRED_GOOGLE_CONTRACT_FIELDS_MISSING:${missing.join(",")}`);
          let outputPath = "";
          const generated = await runPersistedGoogleGeneration({
            values, contractIdentity, companyId: resolvedCompanyId, opportunityId: resolvedOpportunityId,
            exhibitionId, generatedAt, masterTemplateId: input.masterTemplateId, google, persistence,
            onPdfReady: async (pdf, baseName) => {
              outputPath = path.join(directory, `${baseName}.pdf`);
              await writeFile(outputPath, pdf, { flag: "wx", mode: 0o600 });
            },
          });
          artifacts = generated.artifacts;
          return { outputFileName: `${generated.baseName}.pdf`, outputPath, warnings: [] };
        },
      };
      const result = await generateParticipationContract({ companyId, opportunityId }, {
        dataSource: input.createDataSource({ user, accessToken }), docxGenerator: generator, now: input.now,
      });
      const pdfBuffer = result.success ? await import("node:fs/promises").then(({ readFile }) => readFile(result.outputPath)) : undefined;
      handedOff = true;
      return { result, docxBuffer: pdfBuffer, cleanup, artifacts };
    } finally {
      if (!handedOff) await cleanup();
    }
  };
}
