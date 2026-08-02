import type { TemplateMergeResult } from "../../src/modules/document-engine/merge/models.ts";

export type PdfGenerationWarning = {
  code: string;
  message: string;
};

export type DocxToPdfConversionOptions = {
  timeoutMs?: number;
};

export type DocxToPdfConversionErrorCode =
  | "EMPTY_DOCX_INPUT"
  | "EMPTY_PDF_OUTPUT"
  | "INVALID_PDF_OUTPUT"
  | "INPUT_MUTATED"
  | "TIMEOUT"
  | "CONVERSION_FAILED";

export class DocxToPdfConversionError extends Error {
  readonly code: DocxToPdfConversionErrorCode;

  constructor(
    code: DocxToPdfConversionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DocxToPdfConversionError";
    this.code = code;
  }
}

export type PdfGenerationResult = {
  pdfBuffer: Buffer;
  warnings: readonly PdfGenerationWarning[];
};

export type PdfAdapterOptions = {
  mergeResult: TemplateMergeResult;
};

export type DocxBufferGenerationResult = {
  docxBuffer: Buffer;
  warnings?: readonly PdfGenerationWarning[];
};

export type DocxBufferGenerationAdapter = {
  generate: (
    mergeResult: TemplateMergeResult,
  ) => Promise<DocxBufferGenerationResult>;
};

export type PdfAdapter = {
  generate: (
    mergeResult: TemplateMergeResult,
  ) => Promise<PdfGenerationResult>;
};
