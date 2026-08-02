// SPRINT 26.2.2 — deliberately Deno-independent (no `Deno.*` reference
// anywhere in this file) so it can be unit tested with plain `node --test`
// — index.ts is the only Deno-specific file in this function and only
// ever imports from this one, never the other way around.

/**
 * The ONE source of truth for whether a Dropbox Sign signature request
 * is test-mode — read from the DROPBOX_SIGN_TEST_MODE Edge Function
 * secret/env var (see index.ts's Deno.serve, the only caller), never
 * from the client request body: a request field would let the browser
 * decide whether a signature is legally binding, which must never be
 * possible (see index.ts's DropboxSignSendRequest.testMode comment —
 * that field is validated but already ignored by the real-send path).
 *
 * Fail-safe by construction: only the exact literal "false" (after
 * trim + lowercase) disables test mode. Missing, "true", empty, or a
 * typo all stay test-mode — a misconfigured/unset secret can never
 * silently produce a legally binding signature.
 */
export function resolveDropboxSignTestMode(
  rawEnvValue: string | undefined,
): boolean {
  return (
    rawEnvValue?.trim().toLowerCase() !==
    "false"
  );
}
