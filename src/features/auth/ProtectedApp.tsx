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
            <span>VIAWA</span>

            <p>
              Satış Zekası Çalışma Alanı
            </p>
          </div>

          <p className="eyebrow">
            Güvenli erişim
          </p>

          <h1>Oturum yükleniyor...</h1>

          <p className="muted">
            VIAWA hesabınız kontrol ediliyor.
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