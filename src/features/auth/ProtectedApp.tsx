import type { ReactNode } from "react";

import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";

type Props = {
  children: ReactNode;
};

function FullPageMessage({
  heading,
  body,
  onSignOut,
}: {
  heading: string;
  body: string;
  onSignOut?: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>VIAWA</span>

          <p>Satış Zekası Çalışma Alanı</p>
        </div>

        <p className="eyebrow">Güvenli erişim</p>

        <h1>{heading}</h1>

        <p className="muted">{body}</p>

        {onSignOut && (
          <button
            type="button"
            className="btn btn-primary auth-submit"
            onClick={onSignOut}
          >
            Çıkış yap
          </button>
        )}
      </section>
    </main>
  );
}

export function ProtectedApp({
  children,
}: Props) {
  const {
    loading,
    session,
    profile,
    profileLoading,
    signOut,
  } = useAuth();

  if (loading) {
    return (
      <FullPageMessage
        heading="Oturum yükleniyor..."
        body="VIAWA hesabınız kontrol ediliyor."
      />
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // RC-AUTH — a Supabase Auth session is not, by itself, VIAWA access.
  // profileLoading only ever runs while a session already exists (see
  // AuthProvider), so this never flashes for an unauthenticated visitor.
  if (profileLoading) {
    return (
      <FullPageMessage
        heading="Yetki kontrol ediliyor..."
        body="VIAWA erişim yetkiniz doğrulanıyor."
      />
    );
  }

  if (!profile) {
    return (
      <FullPageMessage
        heading="Erişim reddedildi"
        body="Bu kullanıcı VIAWA erişimine sahip değil."
        onSignOut={() => void signOut()}
      />
    );
  }

  if (!profile.is_active) {
    return (
      <FullPageMessage
        heading="Erişim reddedildi"
        body="Hesabınız devre dışı bırakılmış."
        onSignOut={() => void signOut()}
      />
    );
  }

  return children;
}