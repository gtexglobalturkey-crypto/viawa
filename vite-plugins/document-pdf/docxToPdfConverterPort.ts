import {
  DocxToPdfConversionError,
  type DocxToPdfConversionOptions,
} from "./models.ts";

export type DocxToPdfConverterPort = {
  convert: (
    docxBuffer: Buffer,
    options?: DocxToPdfConversionOptions,
  ) => Promise<Buffer>;
};

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

const SAFE_ERROR_MESSAGES = {
  EMPTY_DOCX_INPUT: "DOCX input must not be empty.",
  EMPTY_PDF_OUTPUT: "PDF output must not be empty.",
  INVALID_PDF_OUTPUT: "Converter output is not a valid PDF document.",
  INPUT_MUTATED: "DOCX input was modified during conversion.",
  TIMEOUT: "PDF conversion timed out.",
  CONVERSION_FAILED: "DOCX to PDF conversion failed.",
} as const;

export async function convertDocxToPdf(
  converter: DocxToPdfConverterPort,
  docxBuffer: Buffer,
  options?: DocxToPdfConversionOptions,
): Promise<Buffer> {
  if (docxBuffer.length === 0) {
    throw new DocxToPdfConversionError(
      "EMPTY_DOCX_INPUT",
      "DOCX input must not be empty.",
    );
  }

  const originalInput = Buffer.from(docxBuffer);
  const converterInput = Buffer.from(docxBuffer);
  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await converter.convert(
      converterInput,
      options,
    );
  } catch (error) {
    if (error instanceof DocxToPdfConversionError) {
      throw new DocxToPdfConversionError(
        error.code,
        SAFE_ERROR_MESSAGES[error.code],
      );
    }

    throw new DocxToPdfConversionError(
      "CONVERSION_FAILED",
      "DOCX to PDF conversion failed.",
    );
  }

  if (!converterInput.equals(originalInput)) {
    throw new DocxToPdfConversionError(
      "INPUT_MUTATED",
      "DOCX input was modified during conversion.",
    );
  }

  if (pdfBuffer.length === 0) {
    throw new DocxToPdfConversionError(
      "EMPTY_PDF_OUTPUT",
      "PDF output must not be empty.",
    );
  }

  if (
    pdfBuffer.length < PDF_SIGNATURE.length ||
    !pdfBuffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
  ) {
    throw new DocxToPdfConversionError(
      "INVALID_PDF_OUTPUT",
      "Converter output is not a valid PDF document.",
    );
  }

  return pdfBuffer;
}
