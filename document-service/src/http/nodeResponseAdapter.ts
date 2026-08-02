import type { ServerResponse } from "node:http";

import type { ContractDocxHttpResponse } from "../../../vite-plugins/contract-docx-endpoint/models.ts";

export function sendNodeResponse(response: ServerResponse, result: ContractDocxHttpResponse) {
  response.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  response.end(result.body);
}
