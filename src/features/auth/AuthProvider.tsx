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

import { getOwnApplicationUser } from "../../services/supabase/applicationUserService";
import type { ApplicationUser } from "../../types/database";
import { supabase } from "../crm/api/supabase";
import { AuthContext } from "./AuthContext";

type Props = {
  children: ReactNode;
};

// RC-AUTH — every app-owned localStorage cache is namespaced under this
// one prefix (see exhibitionStorage.ts, generatedDocumentStorage.ts,
// approvedPriceSnapshotStorage.ts). Clearing by prefix, rather than
// importing each module's own key, means a second signed-in user on the
// same browser/machine never sees the previous user's cached UI state,
// and any future "viawa."-prefixed cache is covered automatically.
const VIAWA_LOCAL_STORAGE_PREFIX = "viawa.";

function clearViawaLocalStorage() {
  const keysToRemove: string[] = [];

  for (
    let index = 0;
    index < window.localStorage.length;
    index += 1
  ) {
    const key = window.localStorage.key(index);

    if (
      key?.startsWith(
        VIAWA_LOCAL_STORAGE_PREFIX,
      )
    ) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}

export function AuthProvider({
  children,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] =
    useState<Session | null>(null);
  const [user, setUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<ApplicationUser | null>(null);
  const [profileLoading, setProfileLoading] =
    useState(false);

  // RC-AUTH — a Supabase session alone is never sufficient (see
  // ProtectedApp). Re-fetched whenever the signed-in user id changes
  // (sign-in, sign-out, or a different user signing in after) so a
  // previous user's profile can never be shown for a new session.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let isCancelled = false;
    setProfileLoading(true);

    getOwnApplicationUser()
      .then((result) => {
        if (!isCancelled) {
          setProfile(result);
        }
      })
      .catch((profileError) => {
        console.error(
          "VIAWA application user lookup error:",
          profileError,
        );

        if (!isCancelled) {
          setProfile(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setProfileLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = null;

    function applySession(nextSession: Session | null) {
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        setProfile(null);
        setProfileLoading(nextUserId !== null);
      }

      setSession(nextSession);
      setUser(nextUser);
      setLoading(false);
    }

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
          "VIAWA auth session error:",
          error,
        );
      }

      applySession(data.session);
    }

    void loadSession();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySession(nextSession);
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

    // RC-AUTH — see clearViawaLocalStorage's own note: prevents a
    // second user on the same browser from ever seeing the previous
    // user's cached exhibitions/generated-documents/price-snapshot
    // state. onAuthStateChange (above) already clears session/user/
    // profile React state; this only clears the separate localStorage
    // caches, which signOut() itself does not touch.
    clearViawaLocalStorage();
  }

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      profile,
      profileLoading,
      signOut,
    }),
    [
      loading,
      session,
      user,
      profile,
      profileLoading,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
