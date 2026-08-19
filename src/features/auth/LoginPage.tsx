import {
  type FormEvent,
  useState,
} from "react";
import {
  LockKeyhole,
  Mail,
} from "lucide-react";

import { useToast } from "../../components/feedback/toastContext";
import { supabase } from "../crm/api/supabase";
import { describeSignInError } from "./describeSignInError";

export function LoginPage() {
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!email.trim() || !password) {
      showToast(
        "E-posta ve şifre zorunludur.",
        "error",
      );

      return;
    }

    setIsSubmitting(true);

    let result: Awaited<
      ReturnType<
        typeof supabase.auth.signInWithPassword
      >
    >;

    try {
      result =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
    } catch (networkError) {
      console.error(
        "ATLAS sign in network error:",
        networkError,
      );

      setIsSubmitting(false);

      showToast(
        "Bağlantı kurulamadı. Lütfen tekrar deneyin.",
        "error",
      );

      return;
    }

    setIsSubmitting(false);

    if (result.error) {
      showToast(
        describeSignInError(result.error),
        "error",
      );

      return;
    }

    showToast(
      "VIAWA'ya tekrar hoş geldiniz.",
      "success",
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>VIAWA</span>

          <p>Satış Zekası Çalışma Alanı</p>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">
            Güvenli erişim
          </p>

          <h1>Giriş yap</h1>

          <p className="muted">
            VIAWA hesap bilgilerinizi girin.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>E-posta adresi</span>

            <div className="auth-input">
              <Mail size={18} />

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="ad@sirket.com"
                autoComplete="email"
              />
            </div>
          </label>

          <label>
            <span>Şifre</span>

            <div className="auth-input">
              <LockKeyhole size={18} />

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Şifrenizi girin"
                autoComplete="current-password"
              />
            </div>
          </label>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Giriş yapılıyor..."
              : "Giriş yap"}
          </button>
        </form>
      </section>
    </main>
  );
}