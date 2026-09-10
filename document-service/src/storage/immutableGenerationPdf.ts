

export type GenerationPdfArchive = {
  fileName: string;
  storagePath: string;
  sha256: string;
  size: number;
};

export async function archiveGenerationPdf(input: {
  userId: string;
  companyId: string;
  generatedDocumentId: string;
  fileName: string;
  pdf: Uint8Array;
  upload: (path: string, pdf: Uint8Array) => Promise<{ error: unknown }>;
}): Promise<GenerationPdfArchive> {
  for (const id of [input.userId, input.companyId, input.generatedDocumentId]) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Invalid generated PDF identity.");
    }
  }
  if (new TextDecoder().decode(input.pdf.subarray(0, 5)) !== "%PDF-" || input.pdf.length <= 5) {
    throw new Error("Invalid generated PDF.");
  }
  const storagePath = `${input.userId}/${input.companyId}/${input.generatedDocumentId}/contract.pdf`;
  const { error } = await input.upload(storagePath, input.pdf);
  // A conflict is a failure, never an invitation to download/reuse an older PDF.
  if (error) throw new Error("Current generated PDF could not be archived.");
  return { fileName: input.fileName, storagePath, sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", input.pdf as Uint8Array<ArrayBuffer>))].map(x => x.toString(16).padStart(2, "0")).join(""), size: input.pdf.length };
}
