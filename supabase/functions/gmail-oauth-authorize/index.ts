import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildGoogleAuthorizationUrl, createOAuthState, type GmailOAuthConfig } from "../_shared/gmailOAuth.ts";

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Gmail OAuth is not configured.");
  return value;
}

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const supabaseUrl = required("SUPABASE_URL");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) return new Response("Unauthorized", { status: 401 });
    const { data: member } = await admin.from("application_users").select("id,is_active").eq("id", authData.user.id).maybeSingle();
    if (!member?.is_active) return new Response("Active VIAWA access is required.", { status: 403 });

    const config: GmailOAuthConfig = {
      clientId: required("GMAIL_OAUTH_CLIENT_ID"),
      clientSecret: required("GMAIL_OAUTH_CLIENT_SECRET"),
      redirectUri: required("GMAIL_OAUTH_REDIRECT_URI"),
      senderAlias: required("GMAIL_SENDER_ALIAS"),
      owningMailbox: required("GMAIL_OWNING_MAILBOX"),
    };
    const state = await createOAuthState({ viawaUserId: authData.user.id, clientSecret: config.clientSecret });
    return Response.redirect(buildGoogleAuthorizationUrl(config, state), 302);
  } catch {
    return new Response("Gmail authorization could not be started.", { status: 503 });
  }
});
