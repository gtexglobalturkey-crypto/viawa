import type { ReactNode } from "react";

import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";

type Props = {
  children: ReactNode;
};

export function ProtectedApp({
  children,
}: Props) {
  const {
    loading,
    session,
  } = useAuth();

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand">
            <span>ATLAS</span>

            <p>
              Sales Intelligence Workspace
            </p>
          </div>

          <p className="eyebrow">
            Secure access
          </p>

          <h1>Loading session...</h1>

          <p className="muted">
            Your ATLAS account is being checked.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return children;
}