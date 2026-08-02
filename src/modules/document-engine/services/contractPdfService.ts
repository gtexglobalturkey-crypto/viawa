// BUG-S26-001.3 — the ONE frontend caller of the production Document
// Service's authenticated PDF endpoint (see document-service/src/pdf and
// vite-plugins/contract-docx-endpoint/httpHandler.ts). Server-side DOCX
// generation → LibreOffice PDF conversion → PDF validation → Storage
// upload were already built and tested in "Sprint 24" — this file adds
// no generation logic of its own, it only sends the request and shapes
// the response/error for the UI.

const GENERATE_PDF_PATH = "/api/contracts/generate-pdf";

export type ContractPdfValidationError = {
  code: string;
  message: string;
};

export type ContractPdfSuccess = {
  ok: true;
  pdfBlob: Blob;
  fileName: string;
};

export type ContractPdfFailure = {
  ok: false;
  code: string;
  message: string;
  validationErrors: readonly ContractPdfValidationError[];
};

export type ContractPdfResult =
  | ContractPdfSuccess
  | ContractPdfFailure;

export type RequestContractPdfInput = {
  accessToken: string;
  companyId: string;
  opportunityId: string;
};

function resolveDocumentServiceBaseUrl(): string | null {
  const value = import.meta.env
    .VITE_DOCUMENT_SERVICE_URL;

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed.replace(/\/+$/, "")
    : null;
}

function fileNameFromContentDisposition(
  headerValue: string | null,
): string {
  if (!headerValue) {
    return "contract.pdf";
  }

  const utf8Match = headerValue.match(
    /filename\*=UTF-8''([^;]+)/i,
  );

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(
        utf8Match[1],
      );
    } catch {
      // Fall through to the ASCII fallback below.
    }
  }

  const asciiMatch = headerValue.match(
    /filename="([^"]+)"/i,
  );

  return asciiMatch?.[1] ?? "contract.pdf";
}

async function parseErrorBody(
  response: Response,
): Promise<{
  code: string;
  message: string;
  validationErrors: ContractPdfValidationError[];
}> {
  const fallback = {
    code: "CONTRACT_GENERATION_FAILED",
    message:
      "Sözleşme PDF'i oluşturulamadı.",
    validationErrors:
      [] as ContractPdfValidationError[],
  };

  try {
    const body: unknown =
      await response.json();

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return fallback;
    }

    const record =
      body as Record<string, unknown>;

    return {
      code:
        typeof record.code === "string"
          ? record.code
          : fallback.code,
      message:
        typeof record.message === "string"
          ? record.message
          : fallback.message,
      validationErrors: Array.isArray(
        record.validationErrors,
      )
        ? (record.validationErrors as ContractPdfValidationError[])
        : [],
    };
  } catch {
    return fallback;
  }
}

/**
 * POSTs `{ companyId, opportunityId }` to the Document Service's
 * `generate-pdf` endpoint (auth via Bearer token) and returns either the
 * generated PDF (as a Blob, with the server-confirmed file name from
 * `Content-Disposition`) or a structured failure. The endpoint is
 * idempotent server-side — calling this twice for the same
 * company/opportunity/approved-snapshot returns the same stored PDF
 * rather than generating or uploading a second time.
 */
export async function requestContractPdf(
  input: RequestContractPdfInput,
): Promise<ContractPdfResult> {
  const baseUrl =
    resolveDocumentServiceBaseUrl();

  if (!baseUrl) {
    return {
      ok: false,
      code: "DOCUMENT_SERVICE_NOT_CONFIGURED",
      message:
        "Document Service adresi yapılandırılmamış (VITE_DOCUMENT_SERVICE_URL).",
      validationErrors: [],
    };
  }

  let response: Response;

  try {
    response = await fetch(
      `${baseUrl}${GENERATE_PDF_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${input.accessToken}`,
        },
        body: JSON.stringify({
          companyId: input.companyId,
          opportunityId:
            input.opportunityId,
        }),
      },
    );
  } catch (networkError) {
    console.error(
      "Contract PDF request network error:",
      networkError,
    );

    return {
      ok: false,
      code: "NETWORK_ERROR",
      message:
        "Document Service'e ulaşılamadı.",
      validationErrors: [],
    };
  }

  if (!response.ok) {
    const errorBody =
      await parseErrorBody(response);

    return { ok: false, ...errorBody };
  }

  const pdfBlob = await response.blob();

  const fileName =
    fileNameFromContentDisposition(
      response.headers.get(
        "Content-Disposition",
      ),
    );

  return { ok: true, pdfBlob, fileName };
}

const VALIDATION_ERROR_MESSAGES: Record<
  string,
  string
> = {
  // Reuses the exact wording CustomerWorkspace already shows for this
  // same condition when it pre-checks the approved price client-side
  // before ever opening the modal — kept identical here as the
  // server-side fallback for the same user-facing fact.
  APPROVED_PRICE_NOT_FOUND:
    "Seçili fuar için onaylanmış fiyat bulunamadı.",
  PRIMARY_CONTACT_NOT_FOUND:
    "Sözleşme için birincil iletişim kişisi bulunamadı.",
  SIGNATORY_CONTACT_NOT_FOUND:
    "Sözleşme için imza yetkilisi bulunamadı.",
  COMPANY_NOT_FOUND: "Firma bulunamadı.",
  OPPORTUNITY_NOT_FOUND:
    "Fırsat bulunamadı.",
  OPPORTUNITY_COMPANY_MISMATCH:
    "Fırsat bu firmaya ait değil.",
  EXHIBITION_NOT_FOUND:
    "Fuar bulunamadı.",
  SETTINGS_NOT_FOUND:
    "Sözleşme ayarları eksik.",
  REQUIRED_TEMPLATE_FIELD_MISSING:
    "Sözleşme için gerekli bilgiler eksik.",
};

const TOP_LEVEL_ERROR_MESSAGES: Record<
  string,
  string
> = {
  AUTHENTICATION_REQUIRED:
    "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.",
  INVALID_AUTHENTICATION:
    "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.",
  COMPANY_ACCESS_DENIED:
    "Bu firmaya erişim yetkiniz yok.",
  OPPORTUNITY_ACCESS_DENIED:
    "Bu fırsata erişim yetkiniz yok.",
  COMPANY_OPPORTUNITY_MISMATCH:
    "Fırsat bu firmaya ait değil.",
  COMPANY_NOT_FOUND: "Firma bulunamadı.",
  OPPORTUNITY_NOT_FOUND:
    "Fırsat bulunamadı.",
  DOCUMENT_SERVICE_NOT_CONFIGURED:
    "Sözleşme PDF servisi yapılandırılmamış.",
  NETWORK_ERROR:
    "Sözleşme PDF servisine ulaşılamadı. Lütfen tekrar deneyin.",
};

const GENERIC_CONTRACT_PDF_ERROR_MESSAGE =
  "Sözleşme PDF'i oluşturulamadı. Lütfen tekrar deneyin.";

/**
 * Turns a raw failure code/validationErrors from the Document Service
 * into one clean Turkish sentence — the raw code/message is never shown
 * to the user directly (only logged via console.error by the caller).
 */
export function describeContractPdfFailure(
  failure: ContractPdfFailure,
): string {
  const firstValidationMessage =
    failure.validationErrors
      .map(
        (error) =>
          VALIDATION_ERROR_MESSAGES[
            error.code
          ],
      )
      .find(
        (message): message is string =>
          Boolean(message),
      );

  return (
    firstValidationMessage ??
    TOP_LEVEL_ERROR_MESSAGES[
      failure.code
    ] ??
    GENERIC_CONTRACT_PDF_ERROR_MESSAGE
  );
}

/** Reads a Blob as a base64 data URL — used to keep the freshly generated PDF's bytes available for preview/download without a second Storage round trip (see GeneratedDocumentRecord.pdfDataUrl). */
export function readBlobAsDataUrl(
  blob: Blob,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(
        reader.error ??
          new Error(
            "PDF could not be read as a data URL.",
          ),
      );
    };

    reader.readAsDataURL(blob);
  });
}
