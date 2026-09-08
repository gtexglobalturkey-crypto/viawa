import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createFairyHandler } from "../_shared/fairyHandler.ts";

Deno.serve(createFairyHandler({
  env: (name) => Deno.env.get(name),
  createClient,
  fetch: globalThis.fetch,
}));
