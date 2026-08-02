import type { IncomingMessage } from "node:http";

import type { ContractDocxHttpRequest } from "../../../vite-plugins/contract-docx-endpoint/models.ts";

export async function adaptNodeRequest(
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<ContractDocxHttpRequest | null> {
  const declaredLength = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) return null;
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  return {
    method: request.method,
    headers: request.headers as Record<string, string | string[] | undefined>,
    body: (async function* () { yield body; })(),
    maxBodyBytes,
  };
}
