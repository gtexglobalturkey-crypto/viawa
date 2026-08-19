// RC-AUTH — Supabase's own signInWithPassword error text (English,
// technical, e.g. "Invalid login credentials") is never shown to the
// user directly. Kept as a pure function (no supabase-js import) so it
// stays unit-testable without a real auth call.
export type SignInErrorLike = {
  message: string;
  status?: number;
};

const GENERIC_SIGN_IN_ERROR_MESSAGE =
  "Giriş yapılamadı. Lütfen tekrar deneyin.";

export function describeSignInError(
  error: SignInErrorLike,
): string {
  const message = error.message.toLowerCase();

  if (
    message.includes("invalid login credentials")
  ) {
    return "E-posta veya şifre hatalı.";
  }

  if (message.includes("email not confirmed")) {
    return "E-posta adresiniz henüz doğrulanmamış.";
  }

  if (
    error.status === 403 ||
    message.includes("banned") ||
    message.includes("disabled")
  ) {
    return "Hesabınız devre dışı bırakılmış.";
  }

  return GENERIC_SIGN_IN_ERROR_MESSAGE;
}
