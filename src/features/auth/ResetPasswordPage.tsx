import { type FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import { supabase } from "../crm/api/supabase";
import { useAuth } from "./AuthContext";
import { validateNewPassword } from "./recoveryUrl";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { recoveryStatus, recoveryError, finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (recoveryStatus === "idle") return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSubmitting(true);
    setMessage(null);
    let error: Error | null = null;
    try {
      const result = await supabase.auth.updateUser({ password });
      error = result.error;
    } catch {
      error = new Error("network_error");
    }
    setSubmitting(false);

    if (error) {
      setMessage("Şifre güncellenemedi. Bağlantı geçersiz veya süresi dolmuş olabilir.");
      return;
    }

    setMessage("Şifreniz güncellendi. Giriş ekranına yönlendiriliyorsunuz.");
    await finishRecovery();
    navigate("/", { replace: true });
  }

  const unavailable = recoveryStatus === "pending" || recoveryStatus === "invalid";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>VIAWA</span><p>Satış Zekası Çalışma Alanı</p></div>
        <div className="auth-heading">
          <p className="eyebrow">Güvenli erişim</p>
          <h1>Yeni Şifre Belirle</h1>
          <p className="muted">
            {recoveryStatus === "pending" ? "Kurtarma bağlantısı doğrulanıyor..." : recoveryError ?? "Hesabınız için yeni bir şifre oluşturun."}
          </p>
        </div>
        {!unavailable && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label><span>Yeni Şifre</span><div className="auth-input"><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div></label>
            <label><span>Yeni Şifre Tekrar</span><div className="auth-input"><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div></label>
            {message && <p className="muted" role="status">{message}</p>}
            <button className="btn btn-primary auth-submit" disabled={submitting}>{submitting ? "Şifre güncelleniyor..." : "Şifreyi güncelle"}</button>
          </form>
        )}
        {recoveryStatus === "invalid" && <button type="button" className="btn btn-primary auth-submit" onClick={() => navigate("/", { replace: true })}>Giriş ekranına dön</button>}
      </section>
    </main>
  );
}
