import type { ContractDocxEndpointDependencies, ContractDocxHttpRequest, ContractDocxHttpResponse } from "../../../vite-plugins/contract-docx-endpoint/models.ts";
import { handleContractDocxHttpRequest } from "../../../vite-plugins/contract-docx-endpoint/httpHandler.ts";
import type { createContractPdfStorage } from "../storage/contractPdfStorage.ts";

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

function assertValidPdf(value: Buffer) {
  if (value.length <= PDF_SIGNATURE.length || !value.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw new Error("Generated PDF is invalid.");
  }
}

function contentDisposition(fileName: string) {
  const fallback = fileName.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/[\\/"\r\n]/g, "_") || "contract.pdf";
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function createStoredPdfEndpointDependencies(input: {
  base: ContractDocxEndpointDependencies;
  generatePdf: ContractDocxEndpointDependencies["generate"];
  storage: ReturnType<typeof createContractPdfStorage>;
  reuseExisting?: boolean;
}): ContractDocxEndpointDependencies {
  return {
    ...input.base,
    generate: async (request) => {
      const identity = { accessToken: request.accessToken, userId: request.user.id, companyId: request.companyId, opportunityId: request.opportunityId };
      const existing = input.reuseExisting === false ? null : await input.storage.find(identity);
      if (existing) {
        assertValidPdf(existing.pdfBuffer);
        return {
          result: { success: true, outputFileName: existing.fileName, outputPath: "stored", generatedAt: new Date().toISOString(), companyId: request.companyId, opportunityId: request.opportunityId, exhibitionId: "stored", warnings: [], validationErrors: [] },
          docxBuffer: existing.pdfBuffer,
        };
      }
      const generated = await input.generatePdf(request);
      if (!generated.result.success || !generated.docxBuffer) return generated;
      try {
        assertValidPdf(generated.docxBuffer);
        const stored = await input.storage.store({ ...identity, fileName: generated.result.outputFileName, pdfBuffer: generated.docxBuffer });
        return { ...generated, result: { ...generated.result, outputFileName: stored.fileName }, docxBuffer: stored.pdfBuffer };
      } catch (error) {
        await generated.cleanup?.().catch(() => undefined);
        throw error;
      }
    },
  };
}

export async function handleContractPdfHttpRequest(
  request: ContractDocxHttpRequest,
  dependencies: ContractDocxEndpointDependencies,
): Promise<ContractDocxHttpResponse> {
  const result = await handleContractDocxHttpRequest(request, dependencies);
  if (result.status !== 200) return result;
  const disposition = result.headers["Content-Disposition"];
  const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const fileName = encodedName ? decodeURIComponent(encodedName) : "contract.pdf";
  return {
    ...result,
    headers: { ...result.headers, "Content-Type": "application/pdf", "Content-Disposition": contentDisposition(fileName) },
  };
}
