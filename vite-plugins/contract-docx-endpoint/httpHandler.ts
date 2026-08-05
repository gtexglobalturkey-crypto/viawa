import type {
  ContractDocxEndpointDependencies,
  ContractDocxHttpRequest,
  ContractDocxHttpResponse,
} from "./models";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DEFAULT_MAX_BODY_BYTES = 16 * 1024;

function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): ContractDocxHttpResponse {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      ...extraHeaders,
    },
    body: Buffer.from(JSON.stringify(body), "utf8"),
  };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details: {
    validationErrors?: readonly unknown[];
    warnings?: readonly string[];
    diagnosticCode?: string;
  } = {},
) {
  return jsonResponse(status, {
    success: false,
    code,
    message,
    validationErrors: details.validationErrors ?? [],
    warnings: details.warnings ?? [],
    ...(details.diagnosticCode ? { diagnosticCode: details.diagnosticCode } : {}),
  });
}

function maskId(value: string): string {
  return value.length <= 8 ? value : `${value.slice(0, 8)}…`;
}

function headerValue(
  headers: ContractDocxHttpRequest["headers"],
  name: string,
) {
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1];

  return Array.isArray(match) ? match[0] : match;
}

function accessTokenFromRequest(request: ContractDocxHttpRequest) {
  const authorization = headerValue(request.headers, "authorization")?.trim();
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

async function readBody(request: ContractDocxHttpRequest) {
  const maxBodyBytes = request.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const declaredLength = Number(
    headerValue(request.headers, "content-length") ?? "0",
  );

  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new Error("BODY_TOO_LARGE");
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request.body) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;

    if (total > maxBodyBytes) {
      throw new Error("BODY_TOO_LARGE");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseRequestBody(rawBody: string) {
  let value: unknown;

  try {
    value = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  if (
    keys.length !== 2 ||
    keys[0] !== "companyId" ||
    keys[1] !== "opportunityId" ||
    typeof record.companyId !== "string" ||
    typeof record.opportunityId !== "string" ||
    !record.companyId.trim() ||
    !record.opportunityId.trim() ||
    record.companyId.length > 128 ||
    record.opportunityId.length > 128
  ) {
    return null;
  }

  return {
    companyId: record.companyId.trim(),
    opportunityId: record.opportunityId.trim(),
  };
}

function asciiFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/"\r\n]/g, "_")
    .replace(/\.\.+/g, ".")
    .trim();

  return normalized.toLowerCase().endsWith(".docx")
    ? normalized
    : "contract.docx";
}

function contentDisposition(fileName: string) {
  const fallback = asciiFileName(fileName);
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function handleContractDocxHttpRequest(
  request: ContractDocxHttpRequest,
  dependencies: ContractDocxEndpointDependencies,
): Promise<ContractDocxHttpResponse> {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST is supported.", {
      warnings: [],
    });
  }

  dependencies.logCheckpoint?.("contract_request_accepted");

  const accessToken = accessTokenFromRequest(request);

  if (!accessToken) {
    return errorResponse(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  }

  let user;

  try {
    user = await dependencies.authenticate(accessToken);
  } catch (error) {
    dependencies.logError?.("Contract authentication failed.", error);
    return errorResponse(401, "INVALID_AUTHENTICATION", "Authentication is invalid or expired.");
  }

  if (!user) {
    return errorResponse(401, "INVALID_AUTHENTICATION", "Authentication is invalid or expired.");
  }

  let rawBody: string;

  try {
    rawBody = await readBody(request);
  } catch {
    return errorResponse(400, "REQUEST_TOO_LARGE", "Request body is too large.");
  }

  const parsed = parseRequestBody(rawBody);

  if (!parsed) {
    return errorResponse(400, "INVALID_REQUEST", "companyId and opportunityId are required.");
  }

  let authorization;

  try {
    authorization = await dependencies.authorize({
      user,
      accessToken,
      ...parsed,
    });
  } catch (error) {
    dependencies.logError?.("Contract authorization failed.", error);
    return errorResponse(
      500,
      "AUTHORIZATION_CHECK_FAILED",
      "Authorization could not be verified.",
    );
  }

  if (!authorization.allowed) {
    return errorResponse(
      authorization.status,
      authorization.code,
      authorization.message,
    );
  }

  dependencies.logCheckpoint?.("auth_authz_completed", {
    userId: maskId(user.id),
    companyId: maskId(parsed.companyId),
    opportunityId: maskId(parsed.opportunityId),
  });

  let cleanup: (() => Promise<void>) | undefined;

  try {
    const generated = await dependencies.generate({
      user,
      accessToken,
      ...parsed,
    });
    cleanup = generated.cleanup;

    if (!generated.result.success) {
      return errorResponse(
        422,
        "CONTRACT_VALIDATION_FAILED",
        "Contract generation validation failed.",
        {
          validationErrors: generated.result.validationErrors,
          warnings: generated.result.warnings,
        },
      );
    }

    if (!generated.docxBuffer || generated.docxBuffer.length === 0) {
      throw new Error("Generated DOCX bytes are unavailable.");
    }

    return {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME_TYPE,
        "Content-Disposition": contentDisposition(
          generated.result.outputFileName,
        ),
        "Content-Length": String(generated.docxBuffer.length),
        "Cache-Control": "no-store, private, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
      body: generated.docxBuffer,
    };
  } catch (error) {
    dependencies.logError?.("Contract DOCX generation failed.", error);
    return errorResponse(
      500,
      "CONTRACT_GENERATION_FAILED",
      "The contract document could not be generated.",
      dependencies.isDevelopment
        ? { diagnosticCode: error instanceof Error ? error.name : "NonErrorThrow" }
        : {},
    );
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (error) {
        dependencies.logError?.("Contract temporary-file cleanup failed.", error);
      }
    }
  }
}
