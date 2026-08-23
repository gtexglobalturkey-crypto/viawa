import { isAcceptedSenderAlias, isConfiguredMailbox } from "./gmailOAuth.ts";

export const ORGANIZER_REPORT_EMAIL_PROVIDER = "gmail" as const;

export function normalizeRecipient(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) && value.length <= 254;
}

export async function sendOperationKey(input: {
  reportId: string;
  recipient: string;
  subject: string;
  messageBody: string;
}): Promise<string> {
  const canonical = JSON.stringify({
    reportId: input.reportId,
    recipient: normalizeRecipient(input.recipient),
    subject: input.subject,
    messageBody: input.messageBody,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(result);
}

function base64UrlText(value: string): string {
  return base64(new TextEncoder().encode(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function buildGmailMime(input: {
  recipient: string;
  subject: string;
  messageBody: string;
  senderAlias: string;
  reportId: string;
  pdfBytes: Uint8Array;
}): string {
  const boundary = `viawa_${crypto.randomUUID().replaceAll("-", "")}`;
  const encodedSubject = `=?UTF-8?B?${base64(new TextEncoder().encode(input.subject))}?=`;
  const message = [
    `From: VIAFA <${input.senderAlias}>`,
    `To: ${normalizeRecipient(input.recipient)}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(new TextEncoder().encode(input.messageBody)),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${input.reportId}.pdf"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${input.reportId}.pdf"`,
    "",
    base64(input.pdfBytes),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return base64UrlText(message);
}

export function gmailIdentityIsReady(input: {
  actualMailbox: string;
  configuredMailbox: string;
  aliasResponse: unknown;
  configuredAlias: string;
}): boolean {
  return isConfiguredMailbox(input.actualMailbox, input.configuredMailbox) &&
    isAcceptedSenderAlias(input.aliasResponse, input.configuredAlias);
}

export function providerFailureStatus(httpStatus: number | null): "failed" | "unknown" {
  return httpStatus !== null && httpStatus >= 400 && httpStatus < 500 ? "failed" : "unknown";
}
