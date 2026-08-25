export type DocumentServiceEnvironment = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  documentTemplatePath: string;
  documentTempRoot: string;
  logLevel: "debug" | "info" | "warn" | "error";
  corsAllowedOrigins: readonly string[];
  httpRequestBodyLimitBytes: number;
  libreOfficeBinaryPath?: string;
  pdfConversionTimeoutMs?: number;
  pdfConversionMaxConcurrency?: number;
  pdfConversionMaxFileSizeBytes?: number;
  googleWorkspace?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    masterContractTemplateId: string;
    generatedDocumentsFolderId: string;
  };
};

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

function required(input: EnvironmentInput, name: string) {
  const value = input[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

function integer(value: string, name: string, min: number, max: number) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function optionalInteger(
  input: EnvironmentInput,
  name: string,
  min: number,
  max: number,
) {
  const value = input[name]?.trim();
  return value ? integer(value, name, min, max) : undefined;
}

function httpUrl(value: string, name: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must be a valid HTTP URL.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export function loadDocumentServiceEnvironment(
  input: EnvironmentInput = process.env,
): DocumentServiceEnvironment {
  const nodeEnv = required(input, "NODE_ENV");
  if (!(["development", "test", "production"] as const).includes(
    nodeEnv as "development" | "test" | "production",
  )) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  const logLevel = required(input, "LOG_LEVEL");
  if (!(["debug", "info", "warn", "error"] as const).includes(
    logLevel as "debug" | "info" | "warn" | "error",
  )) {
    throw new Error("LOG_LEVEL must be debug, info, warn, or error.");
  }

  const corsAllowedOrigins = required(input, "CORS_ALLOWED_ORIGINS")
    .split(",")
    .map((value) => httpUrl(value.trim(), "CORS_ALLOWED_ORIGINS"));
  if (nodeEnv === "production" && corsAllowedOrigins.includes("*")) {
    throw new Error("CORS_ALLOWED_ORIGINS cannot contain a wildcard in production.");
  }

  const googleValues = [
    input.GOOGLE_WORKSPACE_CLIENT_ID,
    input.GOOGLE_WORKSPACE_CLIENT_SECRET,
    input.GOOGLE_WORKSPACE_REFRESH_TOKEN,
    input.VIAWA_MASTER_CONTRACT_TEMPLATE_ID,
    input.VIAWA_GENERATED_DOCUMENTS_FOLDER_ID,
  ]
    .map((value) => value?.trim() || "");
  if ((nodeEnv === "production" || googleValues.some(Boolean)) && !googleValues.every(Boolean)) {
    throw new Error("Google Workspace credentials, master template ID and generated-documents folder ID must be configured together.");
  }
  if (googleValues.every(Boolean) && googleValues[3] === googleValues[4]) {
    throw new Error("The Google master template cannot be used as the generated-documents folder.");
  }

  return {
    nodeEnv: nodeEnv as DocumentServiceEnvironment["nodeEnv"],
    host: required(input, "HOST"),
    port: integer(required(input, "PORT"), "PORT", 1, 65535),
    supabaseUrl: httpUrl(required(input, "SUPABASE_URL"), "SUPABASE_URL"),
    supabaseAnonKey: required(input, "SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required(input, "SUPABASE_SERVICE_ROLE_KEY"),
    documentTemplatePath: required(input, "DOCUMENT_TEMPLATE_PATH"),
    documentTempRoot: required(input, "DOCUMENT_TEMP_ROOT"),
    logLevel: logLevel as DocumentServiceEnvironment["logLevel"],
    corsAllowedOrigins,
    httpRequestBodyLimitBytes: integer(
      required(input, "HTTP_REQUEST_BODY_LIMIT_BYTES"),
      "HTTP_REQUEST_BODY_LIMIT_BYTES",
      1,
      10 * 1024 * 1024,
    ),
    libreOfficeBinaryPath: input.LIBREOFFICE_BINARY_PATH?.trim() || undefined,
    pdfConversionTimeoutMs: optionalInteger(input, "PDF_CONVERSION_TIMEOUT_MS", 1, 600_000),
    pdfConversionMaxConcurrency: optionalInteger(input, "PDF_CONVERSION_MAX_CONCURRENCY", 1, 64),
    pdfConversionMaxFileSizeBytes: optionalInteger(input, "PDF_CONVERSION_MAX_FILE_SIZE_BYTES", 1, 1024 * 1024 * 1024),
    googleWorkspace: googleValues.every(Boolean) ? {
      clientId: googleValues[0], clientSecret: googleValues[1], refreshToken: googleValues[2],
      masterContractTemplateId: googleValues[3], generatedDocumentsFolderId: googleValues[4],
    } : undefined,
  };
}
