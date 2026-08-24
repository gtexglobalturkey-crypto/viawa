export const GMAIL_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.settings.basic",
] as const;

export function getGmailOAuthScopeGrants(scope: unknown) {
  const granted = new Set(typeof scope === "string" ? scope.split(/\s+/u).filter(Boolean) : []);
  return {
    openid: granted.has("openid"),
    email: granted.has("email") || granted.has("https://www.googleapis.com/auth/userinfo.email"),
    gmailSend: granted.has("https://www.googleapis.com/auth/gmail.send"),
    gmailSettingsBasic: granted.has("https://www.googleapis.com/auth/gmail.settings.basic"),
  };
}

export function hasRequiredGmailOAuthScopes(scope: unknown): boolean {
  const grants = getGmailOAuthScopeGrants(scope);
  return grants.openid && grants.email && grants.gmailSend && grants.gmailSettingsBasic;
}

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  senderAlias: string;
  owningMailbox: string;
};

type OAuthStatePayload = {
  version: 1;
  viawaUserId: string;
  nonce: string;
  expiresAt: number;
};

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createOAuthState(input: {
  viawaUserId: string;
  clientSecret: string;
  nowMs?: number;
  nonce?: string;
}): Promise<string> {
  const payload: OAuthStatePayload = {
    version: 1,
    viawaUserId: input.viawaUserId,
    nonce: input.nonce ?? crypto.randomUUID(),
    expiresAt: (input.nowMs ?? Date.now()) + 10 * 60 * 1000,
  };
  const encodedPayload = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(input.clientSecret), encoder.encode(encodedPayload));
  return `${encodedPayload}.${base64Url(new Uint8Array(signature))}`;
}

export async function validateOAuthState(input: {
  state: string;
  clientSecret: string;
  nowMs?: number;
}): Promise<OAuthStatePayload | null> {
  const [encodedPayload, encodedSignature, extra] = input.state.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(input.clientSecret),
      fromBase64Url(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as OAuthStatePayload;
    if (payload.version !== 1 || !payload.viawaUserId || !payload.nonce || payload.expiresAt < (input.nowMs ?? Date.now())) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(config: GmailOAuthConfig, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("login_hint", config.owningMailbox);
  url.searchParams.set("hd", config.owningMailbox.split("@")[1] ?? "");
  url.searchParams.set("state", state);
  return url.toString();
}

export function isConfiguredMailbox(actual: string, configured: string): boolean {
  return actual.trim().toLowerCase() === configured.trim().toLowerCase();
}

export function isAcceptedSenderAlias(input: unknown, configuredAlias: string): boolean {
  if (!input || typeof input !== "object") return false;
  const alias = input as Record<string, unknown>;
  return typeof alias.sendAsEmail === "string" &&
    alias.sendAsEmail.toLowerCase() === configuredAlias.toLowerCase() &&
    alias.verificationStatus === "accepted";
}
