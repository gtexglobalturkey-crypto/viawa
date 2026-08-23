import {
  isAcceptedSenderAlias,
  isConfiguredMailbox,
  validateOAuthState,
  type GmailOAuthConfig,
} from "../_shared/gmailOAuth.ts";

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Gmail OAuth is not configured.");
  return value;
}
function page(title: string, detail: string, status = 200): Response {
  const safe = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safe(title)}</title><body style="font-family:Arial,sans-serif;max-width:640px;margin:72px auto;padding:0 24px;color:#1a1b1f"><h1>${safe(title)}</h1><p>${safe(detail)}</p></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return page("Gmail authorization failed", "Method not allowed.", 405);
  try {
    const config: GmailOAuthConfig = {
      clientId: required("GMAIL_OAUTH_CLIENT_ID"),
      clientSecret: required("GMAIL_OAUTH_CLIENT_SECRET"),
      redirectUri: required("GMAIL_OAUTH_REDIRECT_URI"),
      senderAlias: required("GMAIL_SENDER_ALIAS"),
      owningMailbox: required("GMAIL_OWNING_MAILBOX"),
    };
    const url = new URL(request.url);
    if (url.searchParams.get("error")) return page("Gmail authorization cancelled", "Google authorization was not completed.", 400);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    if (!code || !await validateOAuthState({ state, clientSecret: config.clientSecret })) {
      return page("Gmail authorization failed", "The authorization state is invalid or expired.", 400);
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenResponse.json() as Record<string, unknown>;
    if (!tokenResponse.ok || typeof tokens.access_token !== "string") {
      return page("Gmail authorization failed", "Google did not accept the authorization code.", 502);
    }

    const headers = { Authorization: `Bearer ${tokens.access_token}` };
    const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers });
    const identity = await identityResponse.json() as Record<string, unknown>;
    if (!identityResponse.ok || typeof identity.email !== "string" || !isConfiguredMailbox(identity.email, config.owningMailbox)) {
      return page("Gmail authorization failed", "The authorized Google account is not the configured VIAWA mailbox.", 403);
    }
    const aliasResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(config.senderAlias)}`, { headers });
    const alias = await aliasResponse.json() as unknown;
    if (!aliasResponse.ok || !isAcceptedSenderAlias(alias, config.senderAlias)) {
      return page("Gmail authorization failed", "The configured VIAFA sender alias is missing or not accepted in Gmail.", 409);
    }
    if (typeof tokens.refresh_token !== "string" || !tokens.refresh_token) {
      return page("Gmail alias verified", "Google did not issue a refresh token. Re-consent is required before server-side sending can be activated.", 409);
    }

    return page(
      "Gmail authorization verified",
      `Sender: VIAFA ${config.senderAlias}. Secure admin storage of the refresh token is still required before sending can be activated.`,
    );
  } catch {
    return page("Gmail authorization failed", "The authorization could not be completed safely.", 500);
  }
});
