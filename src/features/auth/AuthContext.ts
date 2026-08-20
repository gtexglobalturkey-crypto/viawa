import {
  createContext,
  useContext,
} from "react";

import type { AuthState } from "./types";

type AuthContextValue = AuthState & {
  signOut: () => Promise<void>;
  finishRecovery: () => Promise<void>;
};

export const AuthContext =
  createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}
