import { supabase } from "./client";
import type { ApplicationUser } from "../../types/database";

export type { ApplicationUser } from "../../types/database";

// RC-AUTH — the row's own RLS policy (application_users_select_self)
// already restricts this to auth.uid()'s own row, so no .eq("id", ...)
// is needed here: a signed-in user physically cannot read anyone else's
// row through this client. maybeSingle() returns null (not an error)
// when the row doesn't exist yet — a Supabase Auth account with no
// matching application_users row is exactly the "not authorized for
// VIAWA" case this is meant to detect.
export async function getOwnApplicationUser(): Promise<ApplicationUser | null> {
  const { data, error } = await supabase
    .from("application_users")
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return data;
}
