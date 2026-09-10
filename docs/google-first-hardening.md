# Google-first contract hardening — local review

VIAWA prepares the contract; Google Workspace handles signing manually.

## Integration and scope

Base: remote main `d5a292e410a5588655c4d2de3868c0df1c917ae7`.
The Google release `74b9ba3e5cfb2c4e6c6e70bb2a24e94b1778080e` and main's exhibition fix touched disjoint files after their common ancestor `6c84a99184eed5f49ab8ec7c9e7ab45d34772209`. The release was cherry-picked into a separate worktree, then hardened. Main was not reset or overwritten.

The exhibition implementation and tests, Companies screens/Kanban, Organizer Report, Gmail integration, unrelated migrations and auth implementation are unchanged from remote main. The historical cosmetic CompanyDetailPage change was excluded. Staging banner styles and Dropbox-specific test removal are contract-release changes only. The original dirty `C:/Projects/VIAWA` checkout remains separate.

## Runtime

1. The authenticated caller resolves canonical contract UUID/number and business data.
2. A versioned `generated_documents` PENDING row is allocated under existing active-owner RLS.
3. Google copies the master into the configured output folder; all replacement/verification/export targets the copy.
4. Google exports the PDF and uploads those bytes into the same output folder.
5. The service archives the exact bytes under `{userId}/{companyId}/{generatedDocumentId}/contract.pdf`, with `upsert: false`. Upload errors, including collisions, fail the generation. No legacy file lookup occurs.
6. File name, Storage path, SHA-256 and size are persisted before COMPLETED. The HTTP response returns these same bytes and exposes the generated row ID through CORS.
7. The UI reloads authoritative completed rows and canonical numbers from Supabase, selects the returned row ID, and remains open. “Google Docs'ta Aç” uses the stored copy URL verbatim; “PDF İndir” downloads the selected row's exact Storage path and verifies its SHA-256.
8. Signing is a manual user action in Google Workspace. Existing manual signed-PDF evidence upload is preserved in private Storage/database fields and never replaces the original PDF.

The additive September 6 migration changes no historical row values. Historical Google rows without archive metadata retain their real Drive PDF links. Browser-only history remains available to the unchanged legacy CompanyDetail reader; it is never imported, deleted or used as a fallback for a failed active history query. The active workspace does not write localStorage document records.

## Readiness

`/health` remains independent liveness. Google-mode `/ready` checks all five configuration values, unequal master/folder IDs, OAuth refresh, Drive master type/copy/download capabilities, Docs read access, and folder type/add-children capability. It rejects the folder containing the master as an output destination. OAuth and Google reads share a ten-second deadline; failure responses contain category statuses, not provider details or secrets.

Readiness also checks database settings and the generated-document columns required by this release. Missing migrations fail readiness. Local DOCX readability is only checked in non-Google fallback mode. Production cannot select that fallback and does not expose `/api/contracts/generate-docx`.

Metadata capability checks cannot guarantee a later write during an outage or permission change. The implementation uses Google's documented [Drive file capabilities](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) and [Docs read method](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get), without copying or mutating during readiness.

## Local verification

Broad suite: `node --test` over `*.test.mjs` under `src`, `document-service`, `vite-plugins`, and `scripts`.
Result: **450 passed, 0 failed, 1 skipped** (optional real LibreOffice integration).

Local PostgreSQL: **6 passed, 0 failed**, using the actual two August 25 migrations plus the new additive migration on synthetic in-memory PGlite tables/roles. Covers historical-row preservation, UUID/email owner access, non-owner/inactive denial, immutable archive identity and denied RLS-bypassing privileges. These are local SQL tests, not assertions about hosted production policies.

Reproduce SQL checks without changing application dependencies:

```powershell
npm install --no-save --package-lock=false --prefix .tmp/contract-sql @electric-sql/pglite@0.5.8
node --test scripts/verify-contract-database.mjs
```

Application build, document-service typecheck/build and `git diff --check` pass. React rendering tests verify the real handoff controls and target URL; PDF tests exercise selected-version retrieval and byte verification. The browser runtime reported no available browser, so no visual or interactive browser result is claimed.

## Staging and rollout boundary

**Live staging backend/Drive smoke: PASS — 2026-09-06.** The user supplied the dedicated staging folder; the additive migration was applied only to explicitly addressed VIAWA Staging. Readiness returned 200, generation created one COMPLETED version 5, master snapshots remained identical, and HTTP/Drive/Storage/UI-loader PDF bytes matched. All four historical rows remained unchanged. Fresh-session owner history and non-owner/inactive denial passed.

See [exact staging validation results](google-first-staging-validation.md) for artifact links, IDs, hashes, migration evidence and the full acceptance matrix. Actual React handoff rendering passed using the persisted live row, but browser click/navigation remains unverified because no browser connection was available. The smoke used the local built service with live staging backends; no hosted deployment is claimed.

**Production decision: NO-GO — FIX REQUIRED.** Complete actual browser handoff and hosted environment validation before production rollout. No production push, deployment or migration was performed. The dedicated folder was used only by the task-local synthetic staging process.

Dropbox sender/parser/Edge Function source is removed and no UI calls it. Previously deployed remote Dropbox functions, if any, are outside this task and remain unused by this implementation; remote removal is a separate controlled cleanup.
