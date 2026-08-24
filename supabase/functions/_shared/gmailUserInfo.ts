export type GmailUserInfoCode =
  | "USERINFO_HTTP_401"
  | "USERINFO_HTTP_403"
  | "USERINFO_HTTP_OTHER"
  | "USERINFO_MALFORMED_RESPONSE"
  | "USERINFO_EMAIL_MISSING"
  | "USERINFO_EMAIL_OK";

export async function inspectGoogleUserInfo(input: { accessToken: string; fetchImpl?: typeof fetch }): Promise<{ code: GmailUserInfoCode; httpStatus: number }> {
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${input.accessToken}` } });
  } catch {
    return { code: "USERINFO_HTTP_OTHER", httpStatus: 0 };
  }
  if (response.status === 401) return { code: "USERINFO_HTTP_401", httpStatus: 401 };
  if (response.status === 403) return { code: "USERINFO_HTTP_403", httpStatus: 403 };
  if (!response.ok) return { code: "USERINFO_HTTP_OTHER", httpStatus: response.status };
  let payload: unknown;
  try { payload = await response.json(); } catch { return { code: "USERINFO_MALFORMED_RESPONSE", httpStatus: response.status }; }
  if (!payload || typeof payload !== "object") return { code: "USERINFO_MALFORMED_RESPONSE", httpStatus: response.status };
  if (typeof (payload as Record<string, unknown>).email !== "string" || !(payload as Record<string, unknown>).email) return { code: "USERINFO_EMAIL_MISSING", httpStatus: response.status };
  return { code: "USERINFO_EMAIL_OK", httpStatus: response.status };
}
