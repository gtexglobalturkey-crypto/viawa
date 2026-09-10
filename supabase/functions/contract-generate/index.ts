import { createContractEdgeHandler } from "../../../document-service/src/edge/handler.ts";

Deno.serve(createContractEdgeHandler(Deno.env.toObject(), fetch, 110_000, () => {
  const { rss, heapUsed } = Deno.memoryUsage();
  return { rss, heapUsed };
}));
