export type RecoveryUrlState = "none" | "callback" | "error";

export function getRecoveryUrlState(url: string): RecoveryUrlState {
  if (!url) return "none";

  const parsed = new URL(url, "http://localhost");
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const isResetRoute = parsed.pathname === "/reset-password";
  const hasError = parsed.searchParams.has("error") || hash.has("error");
  const isRecovery =
    parsed.searchParams.get("type") === "recovery" ||
    hash.get("type") === "recovery";

  if (isResetRoute && hasError) return "error";
  if (isResetRoute && isRecovery) {
    return "callback";
  }
  return "none";
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8) return "Yeni şifre en az 8 karakter olmalıdır.";
  if (password !== confirmation) return "Yeni şifreler eşleşmiyor.";
  return null;
}
