// Re-exports the single shared Supabase client (see
// ../../../services/supabase/client.ts) so the whole app — auth included —
// talks to Supabase through one GoTrueClient instance instead of two
// separate ones racing over the same session storage key.
export { supabase } from "../../../services/supabase/client";
