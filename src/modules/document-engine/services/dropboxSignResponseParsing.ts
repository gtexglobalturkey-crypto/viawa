import { FunctionsHttpError } from "@supabase/supabase-js";

// SPRINT 26.2.2 — extracted out of dropboxSignService.ts so this pure
// parsing/mapping logic can be unit tested without importing the
// Supabase client module (which throws at import time outside a Vite
// runtime — see services/supabase/client.ts's VITE_SUPABASE_URL guard).
// dropboxSignService.ts is still the only real caller.

export type EdgeFunctionSendResponse = {
  signatureRequestId: string;
  signatureRequestUrl: string | null;
  testMode: boolean;
};

export function parseSendForSignatureResponse(
  value: unknown,
): EdgeFunctionSendResponse | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const record =
    value as Record<string, unknown>;

  if (
    record.ok !== true ||
    record.provider !== "dropbox-sign" ||
    typeof record.signatureRequestId !==
      "string" ||
    record.signatureRequestId.trim()
      .length === 0
  ) {
    return null;
  }

  if (
    record.signatureRequestUrl !==
      null &&
    typeof record.signatureRequestUrl !==
      "string"
  ) {
    return null;
  }

  return {
    signatureRequestId:
      record.signatureRequestId.trim(),
    signatureRequestUrl:
      record.signatureRequestUrl as
        | string
        | null,
    // Fail-safe: if the Edge Function response is somehow missing this
    // field (an older deployment, a malformed response), assume test
    // mode rather than claiming a binding signature was sent. Only an
    // explicit `false` disables it.
    testMode: record.testMode !== false,
  };
}

export function readEdgeFunctionErrorStatus(
  error: unknown,
): number | null {
  if (
    !(error instanceof FunctionsHttpError)
  ) {
    return null;
  }

  const context = error.context as unknown;

  if (
    typeof context === "object" &&
    context !== null &&
    typeof (
      context as { status?: unknown }
    ).status === "number"
  ) {
    return (context as { status: number })
      .status;
  }

  return null;
}

// Supabase's invoke() error model doesn't reliably expose more than an
// HTTP status in every failure mode, so this stays a small, fixed
// mapping rather than trying to parse the Edge Function's JSON error
// body — matches the sprint's "don't build a fragile parser" guidance.
export function getSendForSignatureErrorMessage(
  error: unknown,
): string {
  switch (
    readEdgeFunctionErrorStatus(error)
  ) {
    case 401:
      return "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";

    // BUG-S26.2.7 — also reached for a storage-level 401/403 (service-role
    // access to Storage itself could not be verified), not only the
    // storage-path ownership mismatch — same user-facing meaning
    // ("access to this file could not be confirmed"), so the existing
    // message is reused rather than adding a second, near-duplicate one.
    case 403:
      return "Bu sözleşme dosyasına erişim izniniz yok.";

    // BUG-S26.2.7 — the Edge Function's storage-download step returned a
    // genuinely malformed/unexpected response it couldn't otherwise
    // classify (see classifyStorageDownloadFailure) — distinct from 422
    // (path ownership) and 404 (confirmed not found) below.
    case 400:
      return "Sözleşme dosyasına erişilemedi. Belge kaydını yeniden oluşturup tekrar deneyin.";

    // BUG-S26.2.7 — Supabase Storage on this project wraps "object/bucket
    // not found" in an HTTP 400 with the real reason only in the response
    // body; classifyStorageDownloadFailure (Edge Function side) already
    // normalizes that back to a real 404 before this ever runs.
    case 404:
      return "Sözleşme PDF'i depolamada bulunamadı.";

    // BUG-S26.2.4 — the Edge Function's storage-path ownership check
    // (validateStoragePathOwnership) failed. Diagnostic improvement
    // only, not the fix itself (see extractGeneratedDocumentStorageIdentity
    // in dropboxSignService.ts, which prevents the specific mismatch
    // that used to make this the guaranteed outcome of every request) —
    // never surfaces the raw storage path, hash, or provider detail.
    case 422:
      return "Sözleşme dosyası doğrulanamadı. Lütfen belgeyi yeniden oluşturup tekrar deneyin.";

    // SPRINT 26.2.2 — the Edge Function returns 501 specifically for
    // "not configured" (DROPBOX_SIGN_API_KEY or storage service-role
    // credentials missing) — distinct from 500 ("unexpected server
    // error"), so this can be a specific, actionable message rather
    // than the generic fallback below.
    case 501:
      return "E-imza hizmeti henüz yapılandırılmamıştır.";

    case 429:
    case 503:
      return "İmza servisi geçici olarak yoğun. Lütfen daha sonra tekrar deneyin.";

    case 504:
      return "İmza servisi zaman aşımına uğradı. Lütfen tekrar deneyin.";

    default:
      return "İmza isteği gönderilemedi.";
  }
}
