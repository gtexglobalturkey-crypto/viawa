import { createClient } from "@supabase/supabase-js";

import type { AuthenticatedContractUser } from "./models";

export function createSupabaseAccessTokenAuthenticator(input: {
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  const client = createClient(
    input.supabaseUrl,
    input.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return async (
    accessToken: string,
  ): Promise<AuthenticatedContractUser | null> => {
    const { data, error } = await client.auth.getUser(accessToken);

    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  };
}
