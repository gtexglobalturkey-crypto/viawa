import { createClient } from "@supabase/supabase-js";

// Capture the callback before GoTrue removes its hash parameters while
// initialising. This contains no persisted token and must never be logged.
export const initialAuthCallbackUrl =
  typeof window === "undefined" ? "" : window.location.href;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL tanımlı değil.");
}

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY tanımlı değil.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
