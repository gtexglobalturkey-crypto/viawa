import type {
  Session,
  User,
} from "@supabase/supabase-js";

import type { ApplicationUser } from "../../types/database";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  // RC-AUTH — the signed-in user's VIAWA authorization record (see
  // applicationUserService.getOwnApplicationUser). null while it's
  // still being fetched (profileLoading) OR once it's confirmed there
  // is no row for this auth user at all — ProtectedApp treats both
  // "no session" and "session but no/inactive profile" as access
  // denied, just with different messages.
  profile: ApplicationUser | null;
  profileLoading: boolean;
};