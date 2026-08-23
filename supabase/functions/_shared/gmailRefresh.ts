export type GmailRefreshCode =
  | "OAUTH_REFRESH_OK"
  | "OAUTH_INVALID_GRANT"
  | "OAUTH_INVALID_CLIENT"
  | "OAUTH_REFRESH_OTHER";

export type GmailRefreshResult =
  | { ok: true; code: "OAUTH_REFRESH_OK"; httpStatus: number; accessToken: string }
  | { ok: false; code: Exclude<GmailRefreshCode, "OAUTH_REFRESH_OK">; httpStatus: number };

export function classifyGmailRefreshError(payload: unknown): Exclude<GmailRefreshCode, "OAUTH_REFRESH_OK"> {
  if (!payload || typeof payload !== "object") return "OAUTH_REFRESH_OTHER";
  const error = (payload as Record<string, unknown>).error;
  if (error === "invalid_grant") return "OAUTH_INVALID_GRANT";
  if (error === "invalid_client") return "OAUTH_INVALID_CLIENT";
  return "OAUTH_REFRESH_OTHER";
}

export async function refreshGmailAccessToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<GmailRefreshResult> {
  const response = await (input.fetchImpl ?? fetch)("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A non-JSON provider response is deliberately reduced to the generic class.
  }
  if (response.ok && payload && typeof payload === "object") {
    const accessToken = (payload as Record<string, unknown>).access_token;
    if (typeof accessToken === "string" && accessToken) {
      return { ok: true, code: "OAUTH_REFRESH_OK", httpStatus: response.status, accessToken };
    }
  }
  return { ok: false, code: classifyGmailRefreshError(payload), httpStatus: response.status };
}
