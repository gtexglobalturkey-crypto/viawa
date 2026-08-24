export type GmailIdentityAliasCode =
  | "GMAIL_MAILBOX_LOOKUP_FAILED"
  | "GMAIL_MAILBOX_MISMATCH"
  | "GMAIL_ALIAS_LOOKUP_FAILED"
  | "GMAIL_ALIAS_NOT_FOUND"
  | "GMAIL_ALIAS_NOT_ACCEPTED"
  | "GMAIL_IDENTITY_ALIAS_OK";

export async function verifyGmailIdentityAlias(input: {
  accessToken: string;
  owningMailbox: string;
  senderAlias: string;
  fetchImpl?: typeof fetch;
}): Promise<GmailIdentityAliasCode> {
  const request = input.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${input.accessToken}` };
  let mailboxResponse: Response;
  try {
    mailboxResponse = await request("https://openidconnect.googleapis.com/v1/userinfo", { headers });
  } catch {
    return "GMAIL_MAILBOX_LOOKUP_FAILED";
  }
  let mailboxPayload: unknown = null;
  try { mailboxPayload = await mailboxResponse.json(); } catch { /* safely discarded */ }
  if (!mailboxResponse.ok || !mailboxPayload || typeof mailboxPayload !== "object" || typeof (mailboxPayload as Record<string, unknown>).email !== "string") {
    return "GMAIL_MAILBOX_LOOKUP_FAILED";
  }
  if ((mailboxPayload as Record<string, unknown>).email?.toString().trim().toLowerCase() !== input.owningMailbox.trim().toLowerCase()) {
    return "GMAIL_MAILBOX_MISMATCH";
  }

  let aliasResponse: Response;
  try {
    aliasResponse = await request(`https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(input.senderAlias)}`, { headers });
  } catch {
    return "GMAIL_ALIAS_LOOKUP_FAILED";
  }
  let aliasPayload: unknown = null;
  try { aliasPayload = await aliasResponse.json(); } catch { /* safely discarded */ }
  if (aliasResponse.status === 404) return "GMAIL_ALIAS_NOT_FOUND";
  if (!aliasResponse.ok) return "GMAIL_ALIAS_LOOKUP_FAILED";
  if (!aliasPayload || typeof aliasPayload !== "object" || typeof (aliasPayload as Record<string, unknown>).sendAsEmail !== "string" ||
    (aliasPayload as Record<string, unknown>).sendAsEmail?.toString().trim().toLowerCase() !== input.senderAlias.trim().toLowerCase()) {
    return "GMAIL_ALIAS_NOT_FOUND";
  }
  if ((aliasPayload as Record<string, unknown>).verificationStatus !== "accepted") return "GMAIL_ALIAS_NOT_ACCEPTED";
  return "GMAIL_IDENTITY_ALIAS_OK";
}
