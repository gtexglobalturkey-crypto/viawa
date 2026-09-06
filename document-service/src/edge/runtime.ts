export async function readBoundedBytes(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel(); throw new Error("SIZE_LIMIT_EXCEEDED");
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) throw new Error("SIZE_LIMIT_EXCEEDED");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

/** Covers fetch AND response-body reads. Also bounds Supabase calls. */
export function boundedFetch(overall: AbortSignal, requestMs = 20_000, base: typeof fetch = fetch,
  timing: (host: string, ms: number) => void = () => {}) : typeof fetch {
  return async (input, init) => {
    const started = performance.now();
    const signal = AbortSignal.any([overall, AbortSignal.timeout(requestMs), ...(init?.signal ? [init.signal] : [])]);
    try {
      const response = await base(input, { ...init, signal });
      return response;
    } finally {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      timing(new URL(url).hostname, Math.round(performance.now() - started));
    }
  };
}
