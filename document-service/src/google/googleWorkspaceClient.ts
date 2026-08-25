import { Buffer } from "node:buffer";

import { findDisallowedUnresolvedPlaceholders, type GoogleContractPlaceholderMap } from "../../../src/modules/document-engine/google/googleContractPlaceholders.ts";

export type GoogleContractArtifacts = {
  masterTemplateId: string;
  googleDocFileId: string;
  googleDocUrl: string;
  googlePdfFileId: string;
  googlePdfUrl: string;
  generatedDocumentId?: string;
  generatedDocumentVersion?: number;
};

type Request = (url: string, init?: RequestInit) => Promise<Response>;

async function providerError(response: Response, operation: string): Promise<never> {
  const detail = (await response.text().catch(() => "")).slice(0, 500);
  throw new Error(`${operation} failed (${response.status})${detail ? `: ${detail}` : ""}`);
}

function collectText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(collectText).join("");
  const record = value as Record<string, unknown>;
  const own = record.textRun && typeof record.textRun === "object"
    ? (record.textRun as Record<string, unknown>).content
    : "";
  return (typeof own === "string" ? own : "") + Object.entries(record)
    .filter(([key]) => key !== "textRun")
    .map(([, child]) => collectText(child)).join("");
}

export function assertCopyTarget(masterId: string, targetId: string): void {
  if (!targetId || targetId === masterId) {
    throw new Error("MASTER_TEMPLATE_MUTATION_BLOCKED");
  }
}

export function assertGeneratedDocumentsFolder(masterId: string, folderId: string): void {
  if (!folderId || folderId === masterId) {
    throw new Error("INVALID_GOOGLE_GENERATED_DOCUMENTS_FOLDER");
  }
}

export function createGoogleWorkspaceClient(input: {
  accessToken: string;
  masterTemplateId: string;
  generatedDocumentsFolderId: string;
  fetchImpl?: Request;
}) {
  assertGeneratedDocumentsFolder(input.masterTemplateId, input.generatedDocumentsFolderId);
  const request = input.fetchImpl ?? fetch;
  const auth = { Authorization: `Bearer ${input.accessToken}` };

  async function copyMaster(name: string) {
    const response = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.masterTemplateId)}/copy?fields=id,webViewLink,name`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name, parents: [input.generatedDocumentsFolderId] }),
    });
    if (!response.ok) return providerError(response, "Google Drive master copy");
    const data = await response.json() as { id?: string; webViewLink?: string };
    assertCopyTarget(input.masterTemplateId, data.id ?? "");
    return { id: data.id!, url: data.webViewLink ?? `https://docs.google.com/document/d/${data.id}/edit` };
  }

  async function replaceAll(targetId: string, values: GoogleContractPlaceholderMap) {
    assertCopyTarget(input.masterTemplateId, targetId);
    const requests = Object.entries(values).map(([key, replaceText]) => ({
      replaceAllText: { containsText: { text: `{{${key}}}`, matchCase: true }, replaceText },
    }));
    const response = await request(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(targetId)}:batchUpdate`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ requests }),
    });
    if (!response.ok) return providerError(response, "Google Docs placeholder replacement");
  }

  async function verifyPlaceholders(targetId: string) {
    assertCopyTarget(input.masterTemplateId, targetId);
    const response = await request(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(targetId)}?includeTabsContent=true`, { headers: auth });
    if (!response.ok) return providerError(response, "Google Docs verification read");
    const unresolved = findDisallowedUnresolvedPlaceholders(collectText(await response.json()));
    if (unresolved.length) throw new Error(`UNRESOLVED_CONTRACT_PLACEHOLDERS:${unresolved.join(",")}`);
  }

  async function exportPdf(targetId: string): Promise<Buffer> {
    assertCopyTarget(input.masterTemplateId, targetId);
    const response = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(targetId)}/export?mimeType=application%2Fpdf`, { headers: auth });
    if (!response.ok) return providerError(response, "Google Drive PDF export");
    const pdf = Buffer.from(await response.arrayBuffer());
    if (pdf.length < 6 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("INVALID_GOOGLE_PDF_EXPORT");
    return pdf;
  }

  async function uploadPdf(name: string, pdf: Buffer) {
    const boundary = `viawa-${crypto.randomUUID()}`;
    const metadata = Buffer.from(JSON.stringify({
      name, mimeType: "application/pdf", parents: [input.generatedDocumentsFolderId],
    }), "utf8");
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`), metadata,
      Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`), pdf,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await request("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
      method: "POST", headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
    });
    if (!response.ok) return providerError(response, "Google Drive PDF upload");
    const data = await response.json() as { id?: string; webViewLink?: string };
    if (!data.id) throw new Error("GOOGLE_PDF_FILE_ID_MISSING");
    return { id: data.id, url: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view` };
  }

  async function remove(fileId: string) {
    if (!fileId || fileId === input.masterTemplateId) return;
    const response = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: auth });
    if (!response.ok && response.status !== 404) return providerError(response, "Google Drive failure cleanup");
  }

  return { copyMaster, replaceAll, verifyPlaceholders, exportPdf, uploadPdf, remove };
}

export async function refreshGoogleWorkspaceAccessToken(input: {
  clientId: string; clientSecret: string; refreshToken: string; fetchImpl?: Request;
}): Promise<string> {
  const response = await (input.fetchImpl ?? fetch)("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret, refresh_token: input.refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) return providerError(response, "Google OAuth refresh");
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  return payload.access_token;
}
