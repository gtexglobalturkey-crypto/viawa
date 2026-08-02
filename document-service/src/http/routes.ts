import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { handleContractDocxHttpRequest } from "../../../vite-plugins/contract-docx-endpoint/httpHandler.ts";
import type { ContractDocxEndpointDependencies } from "../../../vite-plugins/contract-docx-endpoint/models.ts";
import type { DocumentServiceEnvironment } from "../config/environment.ts";
import type { ReadinessCheckResult } from "../readiness/readinessChecks.ts";
import { adaptNodeRequest } from "./nodeRequestAdapter.ts";
import { sendNodeResponse } from "./nodeResponseAdapter.ts";
import { handleContractPdfHttpRequest } from "../pdf/contractPdfEndpoint.ts";

const DOCX_PATH = "/api/contracts/generate-docx";
const PDF_PATH = "/api/contracts/generate-pdf";

function json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", String(bytes.length));
  response.setHeader("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(bytes);
}

function safeError(status: number, code: string, message: string) {
  return { success: false, code, message, validationErrors: [], warnings: [] };
}

export function createNodeRequestHandler(input: {
  environment: DocumentServiceEnvironment;
  endpointDependencies: ContractDocxEndpointDependencies;
  pdfEndpointDependencies: ContractDocxEndpointDependencies;
  checkReadiness: () => Promise<ReadinessCheckResult>;
}) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("X-Request-Id", randomUUID());
    const url = new URL(request.url ?? "/", "http://document-service.local");
    const origin = request.headers.origin;
    const originAllowed = !!origin && input.environment.corsAllowedOrigins.includes(origin);
    if (originAllowed) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      if (url.pathname !== DOCX_PATH && url.pathname !== PDF_PATH) return json(response, 404, safeError(404, "NOT_FOUND", "Route not found."));
      if (!originAllowed) return json(response, 403, safeError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed."));
      response.statusCode = 204;
      response.setHeader("Access-Control-Allow-Methods", "POST");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.setHeader("Access-Control-Max-Age", "600");
      return response.end();
    }

    if (url.pathname === "/health") {
      if (request.method !== "GET") return json(response, 405, safeError(405, "METHOD_NOT_ALLOWED", "Only GET is supported."), { Allow: "GET" });
      return json(response, 200, { status: "ok" });
    }

    if (url.pathname === "/ready") {
      if (request.method !== "GET") return json(response, 405, safeError(405, "METHOD_NOT_ALLOWED", "Only GET is supported."), { Allow: "GET" });
      const readiness = await input.checkReadiness();
      return json(response, readiness.status === "ready" ? 200 : 503, readiness);
    }

    if (url.pathname !== DOCX_PATH && url.pathname !== PDF_PATH) return json(response, 404, safeError(404, "NOT_FOUND", "Route not found."));
    if (request.method !== "POST") return json(response, 405, safeError(405, "METHOD_NOT_ALLOWED", "Only POST is supported."), { Allow: "POST" });
    if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
      return json(response, 415, safeError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json."));
    }

    const adapted = await adaptNodeRequest(request, input.environment.httpRequestBodyLimitBytes);
    if (!adapted) return json(response, 413, safeError(413, "REQUEST_TOO_LARGE", "Request body is too large."));
    const result = url.pathname === PDF_PATH
      ? await handleContractPdfHttpRequest(adapted, input.pdfEndpointDependencies)
      : await handleContractDocxHttpRequest(adapted, input.endpointDependencies);
    if (result.status === 405) response.setHeader("Allow", "POST");
    sendNodeResponse(response, result);
  };
}
