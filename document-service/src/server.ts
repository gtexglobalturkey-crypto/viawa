import { access, constants, mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createPersistentEndpointDataSourceFactory,
  createRequestScopedContractGenerator,
  createSupabaseAccessTokenAuthenticator,
  createSupabaseContractAuthorizer,
} from "../../vite-plugins/contract-docx-endpoint/index.ts";
import { loadDocumentServiceEnvironment, type DocumentServiceEnvironment } from "./config/environment.ts";
import { createNodeRequestHandler } from "./http/routes.ts";
import { createReadinessChecker } from "./readiness/readinessChecks.ts";
import { createLibreOfficeDocxToPdfConverter } from "./converters/libreOfficeDocxToPdfConverter.ts";
import { createRequestScopedPdfGenerator } from "./pdf/requestScopedPdfGeneration.ts";
import { createStoredPdfEndpointDependencies } from "./pdf/contractPdfEndpoint.ts";
import { createContractPdfStorage } from "./storage/contractPdfStorage.ts";

export async function createDocumentServiceServer(environment: DocumentServiceEnvironment) {
  await mkdir(environment.documentTempRoot, { recursive: true });
  await access(environment.documentTempRoot, constants.W_OK);
  const supabase = { supabaseUrl: environment.supabaseUrl, supabaseAnonKey: environment.supabaseAnonKey };
  const createDataSource = createPersistentEndpointDataSourceFactory(supabase);
  const endpointDependencies = {
    authenticate: createSupabaseAccessTokenAuthenticator(supabase),
    authorize: createSupabaseContractAuthorizer(supabase),
    generate: createRequestScopedContractGenerator({
      projectRoot: path.resolve("."),
      templatePath: environment.documentTemplatePath,
      temporaryRoot: environment.documentTempRoot,
      createDataSource,
    }),
    logError(message: string) { console.error(JSON.stringify({ level: "error", message })); },
  };
  const converter = createLibreOfficeDocxToPdfConverter({
    binaryPath: environment.libreOfficeBinaryPath,
    tempRoot: environment.documentTempRoot,
    defaultTimeoutMs: environment.pdfConversionTimeoutMs,
  });
  const generatePdf = createRequestScopedPdfGenerator({
    templatePath: environment.documentTemplatePath,
    temporaryRoot: environment.documentTempRoot,
    converter,
    createDataSource,
  });
  const pdfEndpointDependencies = createStoredPdfEndpointDependencies({
    base: endpointDependencies,
    generatePdf,
    storage: createContractPdfStorage(supabase),
  });
  const handle = createNodeRequestHandler({
    environment,
    endpointDependencies,
    pdfEndpointDependencies,
    checkReadiness: createReadinessChecker(environment),
  });
  return createServer((request, response) => {
    void handle(request, response).catch(() => {
      if (response.headersSent) return response.end();
      const body = Buffer.from(JSON.stringify({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "The request could not be completed.",
        validationErrors: [],
        warnings: [],
      }));
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(body);
    });
  });
}

export async function startDocumentService(input: Readonly<Record<string, string | undefined>> = process.env) {
  const environment = loadDocumentServiceEnvironment(input);
  const server = await createDocumentServiceServer(environment);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(environment.port, environment.host, resolve);
  });
  return { server, environment };
}

export function installGracefulShutdown(server: Server) {
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    server.close((error) => {
      if (error) { console.error(JSON.stringify({ level: "error", message: "Server shutdown failed." })); process.exitCode = 1; }
    });
    server.closeIdleConnections?.();
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  startDocumentService().then(({ server, environment }) => {
    installGracefulShutdown(server);
    console.log(JSON.stringify({ level: "info", message: "Document service started.", host: environment.host, port: environment.port }));
  }).catch(() => {
    console.error(JSON.stringify({ level: "error", message: "Document service startup failed." }));
    process.exitCode = 1;
  });
}
