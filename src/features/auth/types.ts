import type {
  Session,
  User,
} from "@supabase/supabase-js";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
};