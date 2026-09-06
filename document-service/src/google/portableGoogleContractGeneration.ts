import { createGoogleWorkspaceClient, type GoogleContractArtifacts } from "./portableGoogleWorkspaceClient.ts";
import type { GoogleContractPlaceholderMap } from "../../../src/modules/document-engine/google/googleContractPlaceholders.ts";
import type { GeneratedDocumentPersistence, PendingGeneratedDocument } from "../../../src/modules/document-engine/repositories/generatedDocumentRepository.ts";
import type { GenerationPdfArchive } from "../storage/immutableGenerationPdf.ts";
function safeName(value: string) { return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim(); }

type GoogleGenerationClient = Pick<ReturnType<typeof createGoogleWorkspaceClient>, "copyMaster" | "replaceAll" | "verifyPlaceholders" | "exportPdf" | "uploadPdf">;

export async function runPersistedGoogleGeneration(input: {
  values: GoogleContractPlaceholderMap;
  contractIdentity: { id?: string; number: string };
  companyId: string;
  opportunityId: string;
  exhibitionId: string;
  generatedAt: string;
  masterTemplateId: string;
  google: GoogleGenerationClient;
  persistence: GeneratedDocumentPersistence;
  onPdfReady: (pdf: Uint8Array, baseName: string, pending: PendingGeneratedDocument) => Promise<GenerationPdfArchive>;
}) {
  if (!input.contractIdentity.id) throw new Error("CANONICAL_CONTRACT_UUID_MISSING");
  const baseName = safeName(`${input.values.CNO} — ${input.values.COMPANY_LEGAL_NAME} — ${input.values.FNM}`);
  let pending: PendingGeneratedDocument | undefined;
  try {
    pending = await input.persistence.createPending({
      contractId: input.contractIdentity.id,
      opportunityId: input.opportunityId,
      companyId: input.companyId,
      exhibitionId: input.exhibitionId,
      documentType: "participation-contract",
      templateId: input.masterTemplateId,
      generatedAt: input.generatedAt,
    });
    const copied = await input.google.copyMaster(baseName);
    await input.persistence.markDocCreated(pending, { googleDocId: copied.id, googleDocUrl: copied.url });
    await input.google.replaceAll(copied.id, input.values);
    await input.google.verifyPlaceholders(copied.id);
    const pdf = await input.google.exportPdf(copied.id);
    const uploaded = await input.google.uploadPdf(`${baseName}.pdf`, pdf);
    await input.persistence.markPdfCreated(pending, { googlePdfId: uploaded.id, googlePdfUrl: uploaded.url });
    const archive = await input.onPdfReady(pdf, baseName, pending);
    await input.persistence.markCompleted(pending, archive);
    return {
      baseName, pdf,
      artifacts: {
        masterTemplateId: input.masterTemplateId, googleDocFileId: copied.id, googleDocUrl: copied.url,
        googlePdfFileId: uploaded.id, googlePdfUrl: uploaded.url,
        generatedDocumentId: pending.id, generatedDocumentVersion: pending.version,
        pdfStoragePath: archive.storagePath,
      } satisfies GoogleContractArtifacts,
    };
  } catch (error) {
    if (pending) {
      await input.persistence.markFailed(pending).catch((persistenceError) => {
        console.error(JSON.stringify({ level: "error", stage: "generated_document_failure_status_failed", generatedDocumentId: pending?.id, errorName: persistenceError instanceof Error ? persistenceError.name : "NonErrorThrow" }));
      });
      console.error(JSON.stringify({ level: "error", stage: "generated_document_failed", generatedDocumentId: pending.id, contractId: pending.contractId.slice(0, 8), errorName: error instanceof Error ? error.name : "NonErrorThrow" }));
    }
    throw error;
  }
}
