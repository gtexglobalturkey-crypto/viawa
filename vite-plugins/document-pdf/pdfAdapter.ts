import type { TemplateMergeResult } from "../../src/modules/document-engine/merge/models.ts";

import {
  convertDocxToPdf,
  type DocxToPdfConverterPort,
} from "./docxToPdfConverterPort.ts";
import type {
  DocxBufferGenerationAdapter,
  PdfAdapter,
} from "./models.ts";

export function createPdfAdapter(
  docxAdapter: DocxBufferGenerationAdapter,
  converter: DocxToPdfConverterPort,
): PdfAdapter {
  return {
    async generate(
      mergeResult: TemplateMergeResult,
    ) {
      const generatedDocx = await docxAdapter.generate(
        mergeResult,
      );
      const pdfBuffer = await convertDocxToPdf(
        converter,
        generatedDocx.docxBuffer,
      );

      return {
        pdfBuffer,
        warnings: generatedDocx.warnings ?? [],
      };
    },
  };
}
