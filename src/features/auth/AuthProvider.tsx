import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import { supabase } from "../crm/api/supabase";
import { AuthContext } from "./AuthContext";

type Props = {
  children: ReactNode;
};

export function AuthProvider({
  children,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] =
    useState<Session | null>(null);
  const [user, setUser] =
    useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(
          "ATLAS auth session error:",
          error,
        );
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }

    void loadSession();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      signOut,
    }),
    [
      loading,
      session,
      user,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}