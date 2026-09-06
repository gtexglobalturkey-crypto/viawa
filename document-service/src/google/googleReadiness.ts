import { refreshGoogleWorkspaceAccessToken } from "./googleWorkspaceClient.ts";
import type { DocumentServiceEnvironment } from "../config/environment.ts";

export type GoogleReadiness = {
  configuration: "ok" | "missing" | "invalid";
  authentication: "ok" | "unavailable" | "not_checked";
  master: "ok" | "unavailable" | "not_checked";
  folder: "ok" | "unavailable" | "not_checked";
};

/** Read-only capability checks. Never copies, updates, uploads or deletes a file. */
export async function checkGoogleReadiness(
  config: DocumentServiceEnvironment["googleWorkspace"],
  request: typeof fetch = fetch,
): Promise<GoogleReadiness> {
  const result: GoogleReadiness = { configuration: "missing", authentication: "not_checked", master: "not_checked", folder: "not_checked" };
  if (!config || ![config.clientId, config.clientSecret, config.refreshToken, config.masterContractTemplateId, config.generatedDocumentsFolderId].every((value) => typeof value === "string" && value.trim())) return result;
  if (config.masterContractTemplateId === config.generatedDocumentsFolderId) {
    result.configuration = "invalid";
    return result;
  }
  result.configuration = "ok";
  // Bound the whole probe, including the OAuth refresh and metadata reads.
  const signal = AbortSignal.timeout(10_000);
  const boundedRequest: typeof fetch = (url, init) => request(url, { ...init, signal });
  let token: string;
  try {
    token = await refreshGoogleWorkspaceAccessToken({ ...config, fetchImpl: boundedRequest });
    result.authentication = "ok";
  } catch {
    result.authentication = "unavailable";
    return result;
  }
  const headers = { Authorization: `Bearer ${token}` };
  async function metadata(id: string) {
    const response = await boundedRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,mimeType,trashed,parents,capabilities(canCopy,canDownload,canAddChildren)`, { headers });
    if (!response.ok) throw new Error("Google metadata unavailable.");
    return response.json() as Promise<{ id?: string; mimeType?: string; trashed?: boolean; parents?: string[]; capabilities?: { canCopy?: boolean; canDownload?: boolean; canAddChildren?: boolean } }>;
  }
  await Promise.all([
    (async () => {
      try {
        const master = await metadata(config.masterContractTemplateId);
        if (master.parents?.includes(config.generatedDocumentsFolderId)) {
          result.configuration = "invalid";
          throw new Error("Output folder must be separate from the master area.");
        }
        if (master.id !== config.masterContractTemplateId || master.trashed || master.mimeType !== "application/vnd.google-apps.document" || !master.capabilities?.canCopy || !master.capabilities.canDownload) throw new Error("Master inaccessible.");
        const document = await boundedRequest(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(config.masterContractTemplateId)}?fields=documentId`, { headers });
        if (!document.ok || (await document.json() as { documentId?: string }).documentId !== config.masterContractTemplateId) throw new Error("Master unreadable.");
        result.master = "ok";
      } catch { result.master = "unavailable"; }
    })(),
    (async () => {
      try {
        const folder = await metadata(config.generatedDocumentsFolderId);
        if (folder.id !== config.generatedDocumentsFolderId || folder.trashed || folder.mimeType !== "application/vnd.google-apps.folder" || !folder.capabilities?.canAddChildren) throw new Error("Output folder inaccessible.");
        result.folder = "ok";
      } catch { result.folder = "unavailable"; }
    })(),
  ]);
  return result;
}
