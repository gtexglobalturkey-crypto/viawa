import { Buffer } from "node:buffer";
import { createGoogleWorkspaceClient as portable } from "./portableGoogleWorkspaceClient.ts";
export { assertCopyTarget, assertGeneratedDocumentsFolder, refreshGoogleWorkspaceAccessToken } from "./portableGoogleWorkspaceClient.ts";
export type { GoogleContractArtifacts } from "./portableGoogleWorkspaceClient.ts";
export function createGoogleWorkspaceClient(input: Parameters<typeof portable>[0]) {
  const client = portable(input);
  return { ...client, exportPdf: async (id: string) => Buffer.from(await client.exportPdf(id)) };
}
