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
        "Email and password are required.",
        "error",
      );

      return;
    }

    setIsSubmitting(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setIsSubmitting(false);

    if (error) {
      showToast(
        error.message,
        "error",
      );

      return;
    }

    showToast(
      "Welcome back to ATLAS.",
      "success",
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>ATLAS</span>

          <p>Sales Intelligence Workspace</p>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">
            Secure access
          </p>

          <h1>Sign in</h1>

          <p className="muted">
            Enter your ATLAS account details.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>Email address</span>

            <div className="auth-input">
              <Mail size={18} />

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
          </label>

          <label>
            <span>Password</span>

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
                placeholder="Enter your password"
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
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}