import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGmailAccessToken } from "../_shared/gmailRefresh.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
function json(body: unknown, status: number, oauthHttpStatus?: number): Response {
  const headers: Record<string, string> = { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (oauthHttpStatus !== undefined) headers["X-OAuth-HTTP-Status"] = String(oauthHttpStatus);
  return new Response(JSON.stringify(body), { status, headers });
}
function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("NOT_CONFIGURED");
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ ok: false, result: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ ok: false, result: "UNAUTHORIZED" }, 401);
    const admin = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) return json({ ok: false, result: "UNAUTHORIZED" }, 401);
    const { data: member } = await admin.from("application_users").select("id,is_active,role").eq("id", authData.user.id).maybeSingle();
    if (!member?.is_active || member.role !== "admin") return json({ ok: false, result: "ADMIN_REQUIRED" }, 403);

    const result = await refreshGmailAccessToken({
      clientId: required("GMAIL_OAUTH_CLIENT_ID"),
      clientSecret: required("GMAIL_OAUTH_CLIENT_SECRET"),
      refreshToken: required("GMAIL_OAUTH_REFRESH_TOKEN"),
    });
    if (!result.ok) return json({ ok: false, result: result.code }, 503, result.httpStatus);
    return json({ ok: true, result: "OAUTH_REFRESH_OK" }, 200, result.httpStatus);
  } catch {
    return json({ ok: false, result: "OAUTH_REFRESH_OTHER" }, 503);
  }
});
