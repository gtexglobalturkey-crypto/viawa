import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { loadFairyContext, sanitizeFairyText, type FairyReadClient } from "./fairyContext.ts";
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

// Removes anything that could be a credential, or part of one, from provider
// text before it is logged: prefixed keys (also when partly masked), bearer
// values, JWTs, masked values and long mixed letter/digit strings.
const CREDENTIAL_FRAGMENTS = [
  /\bBearer\s+\S+/gi,
  /\b(?:sk|pk|rk|sb|sbp)[-_][^\s"'`,;:)\]}]*/gi,
  /\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){0,2}/g,
  /\S*\*{2,}\S*/g,
  /\S*(?:\.{3}|…)[A-Za-z0-9_-]{2,}/g,
  /\b(?=[A-Za-z0-9_-]*[0-9])(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,}/g,
];
function redactCredentialFragments(text: string): string {
  return CREDENTIAL_FRAGMENTS.reduce((current, pattern) => current.replace(pattern, "[redacted]"), text);
}

type FairyDependencies = {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options: {
    auth: { persistSession: false; autoRefreshToken: false };
    global: { fetch: typeof fetch; headers: { Authorization: string } };
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
      const anonKey = dependencies.env("SUPABASE_ANON_KEY");
      if (!url || !anonKey) throw new FairyError("FAIRY_NOT_CONFIGURED");

      // The only Supabase client: public anon key plus the caller's own JWT, so
      // row level security decides every read. Fairy never uses the service role.
      const caller = dependencies.createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { Authorization: `Bearer ${token}` },
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
      // Verified JWT, then active membership read from the caller's own row.
      let userId: string;
      try {
        const { data, error } = await caller.auth.getUser(token);
        if (error || !data.user) throw new FairyError("UNAUTHENTICATED");
        userId = data.user.id;
      } catch (error) {
        if (error instanceof FairyError) throw error;
        throw new FairyError("AUTH_UNAVAILABLE");
      }

      try {
        const { data: member, error } = await caller.from("application_users")
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
          from: (table) => ({ select: (columns) => caller.from(table).select<string, Record<string, unknown>>(columns) }),
        };
        context = await (dependencies.loadContext ?? loadFairyContext)(reader, input);
      } catch {
        throw new FairyError("CONTEXT_UNAVAILABLE");
      }

      const payload = buildFairyResponseRequest(input, context);
      // Provider diagnostics for the function log only. Never the key, headers,
      // tokens, prompt, VIAWA records or response content; user errors are unchanged.
      const scrubbed = (value: unknown): string => {
        if (typeof value !== "string" || !value.trim()) return "none";
        let text = value;
        for (const secret of [apiKey, anonKey, token]) if (secret.length >= 8) text = text.split(secret).join("[redacted]");
        return sanitizeFairyText(redactCredentialFragments(text), 240) ?? "none";
      };
      const identifier = (value: unknown): string => {
        const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
        return /^[A-Za-z0-9_.-]{1,60}$/.test(text) && scrubbed(text) === text ? text : "none";
      };
      const diagnose = (entry: Record<string, unknown>) => {
        try { console.error(JSON.stringify(entry)); } catch { /* Diagnostics can never fail a request. */ }
      };
      let providerResponse: Response;
      let providerBody: unknown;
      let responseReceived = false;
      const signal = AbortSignal.timeout(FAIRY_LIMITS.timeoutMs);
      try {
        providerResponse = await dependencies.fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal,
          redirect: "error",
        });
        responseReceived = true;
        if (!providerResponse.ok) {
          // Only the provider's own error descriptor is logged, sanitized; the
          // raw body is never returned or logged.
          let providerError: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse((await providerResponse.text()).slice(0, 8_000));
            if (parsed?.error && typeof parsed.error === "object" && !Array.isArray(parsed.error)) providerError = parsed.error;
          } catch { /* A non-JSON error body is reported by status alone. */ }
          const errorType = identifier(providerError.type);
          const errorCode = identifier(providerError.code);
          // Providers quote the supplied credential in authentication errors,
          // sometimes only partly masked, so that message is never logged.
          const authenticationFailure = [401, 403].includes(providerResponse.status) ||
            /key|auth|token|credential|permission/i.test(`${errorType} ${errorCode}`);
          diagnose({
            stage: "fairy_provider_error", httpStatus: providerResponse.status, errorType, errorCode,
            errorMessage: authenticationFailure ? "[authentication error message omitted]" : scrubbed(providerError.message),
          });
          throw new FairyError(providerResponse.status === 429 ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE");
        }
        providerBody = await providerResponse.json();
      } catch (error) {
        if (error instanceof FairyError) throw error;
        // A body-parsing message could quote response content, so it is omitted.
        diagnose({
          stage: "fairy_provider_exception", phase: responseReceived ? "response_body" : "request",
          name: identifier(error instanceof Error ? error.name : undefined),
          message: responseReceived ? "none" : scrubbed(error instanceof Error ? error.message : undefined),
        });
        if (signal.aborted || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) {
          throw new FairyError("AI_TIMEOUT");
        }
        throw new FairyError("AI_UNAVAILABLE");
      }

      let answer: string;
      try {
        answer = extractFairyAnswer(providerBody);
      } catch (error) {
        // An HTTP 200 that still cannot be shown: envelope facts only, no content.
        const body = providerBody && typeof providerBody === "object" && !Array.isArray(providerBody) ? providerBody as Record<string, unknown> : {};
        const nested = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
        const tokens = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
        diagnose({
          stage: "fairy_provider_unusable", fairyCode: error instanceof FairyError ? error.code : "INTERNAL_ERROR",
          responseStatus: identifier(body.status), incompleteReason: identifier(nested(body.incomplete_details).reason),
          errorType: identifier(nested(body.error).type), errorCode: identifier(nested(body.error).code),
          outputTokens: tokens(nested(body.usage).output_tokens),
          reasoningTokens: tokens(nested(nested(body.usage).output_tokens_details).reasoning_tokens),
        });
        throw error;
      }
      if ([apiKey, anonKey, token].some((secret) => secret.length >= 8 && answer.includes(secret))) {
        throw new FairyError("AI_UNAVAILABLE");
      }
      return json({ answer });
    } catch (error) {
      const safe = error instanceof FairyError ? error : new FairyError("INTERNAL_ERROR");
      return json({ error: safe.message, code: safe.code }, safe.status);
    }
  };
}
