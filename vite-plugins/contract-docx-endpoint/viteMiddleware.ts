import type { IncomingMessage, ServerResponse } from "node:http";

import type { Connect, Plugin } from "vite";

import { handleContractDocxHttpRequest } from "./httpHandler";
import type { ContractDocxEndpointDependencies } from "./models";

export const CONTRACT_DOCX_ENDPOINT_PATH =
  "/api/contracts/generate-docx";

function headersFromRequest(request: IncomingMessage) {
  return request.headers as Record<string, string | string[] | undefined>;
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ContractDocxEndpointDependencies,
) {
  const result = await handleContractDocxHttpRequest(
    {
      method: request.method,
      headers: headersFromRequest(request),
      body: request,
    },
    dependencies,
  );

  response.statusCode = result.status;

  if (result.status === 405) {
    response.setHeader("Allow", "POST");
  }

  for (const [name, value] of Object.entries(result.headers)) {
    response.setHeader(name, value);
  }

  response.end(result.body);
}

export function contractDocxEndpointPlugin(
  dependencies: ContractDocxEndpointDependencies,
): Plugin {
  const register = (middlewares: Connect.Server) => {
    middlewares.use(CONTRACT_DOCX_ENDPOINT_PATH, (request, response) => {
      void handle(request, response, dependencies).catch((error) => {
        dependencies.logError?.("Contract endpoint middleware failed.", error);
        if (!response.headersSent) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store, private");
        }
        response.end(JSON.stringify({
          success: false,
          code: "CONTRACT_ENDPOINT_FAILED",
          message: "The contract endpoint could not complete the request.",
          validationErrors: [],
          warnings: [],
        }));
      });
    });
  };

  return {
    name: "viawa-authenticated-contract-docx-endpoint",
    configureServer(server) {
      register(server.middlewares);
    },
    configurePreviewServer(server) {
      register(server.middlewares);
    },
  };
}
