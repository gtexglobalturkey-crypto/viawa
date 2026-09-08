import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { loadFairyContext, type FairyReadClient } from "./fairyContext.ts";
import {
  buildFairyResponseRequest,
  extractFairyAnswer,
  FAIRY_LIMITS,
  FairyError,
  readFairyRequest,
} from "./fairy.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

type FairyDependencies = {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options: {
    auth: { persistSession: false; autoRefreshToken: false };
    global: { fetch: typeof fetch };
  }) => SupabaseClient;
  fetch: typeof fetch;
  supabaseFetch?: typeof fetch;
  loadContext?: typeof loadFairyContext;
};

// Kept separate from Deno.serve so auth order and provider failures are tested offline.
export function createFairyHandler(dependencies: FairyDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

    try {
      const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");
      if (!bearer) throw new FairyError("UNAUTHENTICATED");
      const token = bearer[1];
      const url = dependencies.env("SUPABASE_URL");
      const serviceKey = dependencies.env("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !serviceKey) throw new FairyError("FAIRY_NOT_CONFIGURED");

      const admin = dependencies.createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          async fetch(input, init) {
            try {
              return await (dependencies.supabaseFetch ?? globalThis.fetch)(input, init);
            } catch {
              // Auth SDKs can log transport exceptions before returning them.
              // Discard raw messages/causes before they cross that boundary.
              throw new Error("VIAWA authentication transport is unavailable.");
            }
          },
        },
      });
      // Same authorization boundary as organizer-report: verified JWT, then active membership.
      let userId: string;
      try {
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data.user) throw new FairyError("UNAUTHENTICATED");
        userId = data.user.id;
      } catch (error) {
        if (error instanceof FairyError) throw error;
        throw new FairyError("AUTH_UNAVAILABLE");
      }

      try {
        const { data: member, error } = await admin.from("application_users")
          .select("id,is_active")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw new FairyError("AUTH_UNAVAILABLE");
        if (member?.is_active !== true) throw new FairyError("ACCESS_DENIED");
      } catch (error) {
        if (error instanceof FairyError) throw error;
        throw new FairyError("AUTH_UNAVAILABLE");
      }

      const input = await readFairyRequest(request);
      // Provider secret is server-only and is read only after authorization and validation.
      const apiKey = dependencies.env("OPENAI_API_KEY");
      if (!apiKey?.trim()) throw new FairyError("FAIRY_NOT_CONFIGURED");
      let context: Awaited<ReturnType<typeof loadFairyContext>>;
      try {
        const reader: FairyReadClient = {
          // Explicit row typing avoids recursive SDK inference for dynamic column
          // lists; the context loader validates results and projects each field.
          from: (table) => ({ select: (columns) => admin.from(table).select<string, Record<string, unknown>>(columns) }),
        };
        context = await (dependencies.loadContext ?? loadFairyContext)(reader, input);
      } catch {
        throw new FairyError("CONTEXT_UNAVAILABLE");
      }

      const payload = buildFairyResponseRequest(input, context);
      let providerResponse: Response;
      let providerBody: unknown;
      const signal = AbortSignal.timeout(FAIRY_LIMITS.timeoutMs);
      try {
        providerResponse = await dependencies.fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal,
          redirect: "error",
        });
        if (!providerResponse.ok) {
          // Never return or log raw provider error bodies, which may contain request details.
          await providerResponse.body?.cancel();
          throw new FairyError(providerResponse.status === 429 ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE");
        }
        providerBody = await providerResponse.json();
      } catch (error) {
        if (error instanceof FairyError) throw error;
        if (signal.aborted || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) {
          throw new FairyError("AI_TIMEOUT");
        }
        throw new FairyError("AI_UNAVAILABLE");
      }

      const answer = extractFairyAnswer(providerBody);
      if ([apiKey, serviceKey, token].some((secret) => secret.length >= 8 && answer.includes(secret))) {
        throw new FairyError("AI_UNAVAILABLE");
      }
      return json({ answer });
    } catch (error) {
      const safe = error instanceof FairyError ? error : new FairyError("INTERNAL_ERROR");
      return json({ error: safe.message, code: safe.code }, safe.status);
    }
  };
}
