import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGmailAccessToken } from "../_shared/gmailRefresh.ts";
import { verifyGmailIdentityAlias } from "../_shared/gmailIdentity.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
function json(ok: boolean, result: string, status = 200): Response {
  return new Response(JSON.stringify({ ok, result }), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("NOT_CONFIGURED");
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json(false, "GMAIL_MAILBOX_LOOKUP_FAILED", 405);
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json(false, "GMAIL_MAILBOX_LOOKUP_FAILED", 401);
    const admin = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) return json(false, "GMAIL_MAILBOX_LOOKUP_FAILED", 401);
    const { data: member } = await admin.from("application_users").select("id,is_active,role").eq("id", authData.user.id).maybeSingle();
    if (!member?.is_active || member.role !== "admin") return json(false, "GMAIL_MAILBOX_LOOKUP_FAILED", 403);
    const refresh = await refreshGmailAccessToken({ clientId: required("GMAIL_OAUTH_CLIENT_ID"), clientSecret: required("GMAIL_OAUTH_CLIENT_SECRET"), refreshToken: required("GMAIL_OAUTH_REFRESH_TOKEN") });
    if (!refresh.ok) return json(false, "GMAIL_MAILBOX_LOOKUP_FAILED", 503);
    const result = await verifyGmailIdentityAlias({ accessToken: refresh.accessToken, owningMailbox: required("GMAIL_OWNING_MAILBOX"), senderAlias: required("GMAIL_SENDER_ALIAS") });
    return json(result === "GMAIL_IDENTITY_ALIAS_OK", result);
  } catch {
    return json(false, "GMAIL_MAILBOX_LOOKUP_FAILED", 503);
  }
});
