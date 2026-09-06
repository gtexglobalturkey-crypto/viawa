# Google-first Supabase Edge migration

React calls the authenticated `contract-generate` Supabase function. Cloudflare serves the frontend only. Google edits a native master copy and exports the PDF; no Node server, filesystem, container, LibreOffice or separate service URL is required by this path.

The old Document Service remains a rollback/reference implementation. Its Google adapter delegates to the same portable lifecycle and provider client; no legacy runtime was deleted. Full browser acceptance is required before marking it a retirement candidate.

## Security and behavior

The function authenticates via Supabase Auth and reuses the active-user, company/opportunity and owner checks before any Google artifacts. Current policy grants no blanket admin non-owner exception: an active admin owner is allowed, an admin non-owner is denied. Caller JWTs remain attached to database/RPC/Storage requests; no service-role client is used.

Google settings are server secrets. `CONTRACT_ALLOWED_ORIGINS` is an explicit frontend origin allowlist. Authenticated generation performs read-only Google configuration/master/folder preflight and required-column checks; no public diagnostic endpoint was added. The provider-returned copy and PDF URLs must match their returned IDs. Edge does not construct fallback URLs.

Business mapping, canonical numbering, approved-price resolution, payment-plan validation and database history remain shared. Contract date formatting explicitly uses Europe/Istanbul so a UTC Edge host cannot change the business date around midnight.

Lifecycle remains PENDING → DOC_CREATED → PDF_CREATED → COMPLETED, with archive success required before completion. Exact PDF bytes go to Drive, immutable generation-specific Supabase Storage and the HTTP response. SHA-256 uses Web Crypto. Storage collisions fail without looking up an older PDF.

## Runtime bounds and interruption evidence

- Overall generation budget: 110 seconds; provider/database request timeout: 20 seconds; read-only Google preflight: 10 seconds.
- Failure persistence receives a separate 5-second cleanup budget.
- Request body: 16 KiB; copied Docs JSON: 5 MiB; exported PDF: 10 MiB. Streaming reads reject oversized bodies, including bodies without Content-Length.
- Multipart body uses Blob and binary data, without base64 or disk round trips.
- Logs contain request ID, generated-row ID, total duration, optional RSS/heap readings, and per-host time to response headers. They do not contain tokens, business bodies or raw provider error details.

A platform hard termination cannot guarantee FAILED persistence. Existing lifecycle rows and timestamps plus logged request/generation IDs identify interrupted attempts. Reconciliation should inspect the exact persisted references and Storage identity; do not blindly replay Google copy/upload or delete artifacts. A new request intentionally allocates a new version; database uniqueness and the existing bounded version-allocation retry remain in force. This sprint does not promise exactly-once execution across network interruptions.

## Build and deployment

Source entry: `supabase/functions/contract-generate/index.ts`. It imports the existing business modules through the portable handler. The reproducible bundle resolves the repository's extensionless TypeScript imports for deployment, externalizes only pinned Supabase JS, and rejects native runtime imports.

```powershell
npm run contract-edge:build
npm exec --yes --package=deno -- deno check --unstable-sloppy-imports --config supabase/functions/contract-generate/deno.json supabase/functions/contract-generate/index.ts
supabase functions deploy contract-generate --project-ref STAGING_PROJECT_REF --workdir .tmp/contract-edge --use-api
```

The generated deployment directory is ignored and has its own function-only config with JWT verification enabled. API deployment does not require Docker. Source and Deno dependency lock are committed; no secrets or smoke artifacts are committed.

Set only staging function secrets: GOOGLE_WORKSPACE_CLIENT_ID, GOOGLE_WORKSPACE_CLIENT_SECRET, GOOGLE_WORKSPACE_REFRESH_TOKEN, VIAWA_MASTER_CONTRACT_TEMPLATE_ID, VIAWA_GENERATED_DOCUMENTS_FOLDER_ID, CONTRACT_ALLOWED_ORIGINS. Supabase URL/anon key are supplied by the Edge environment. Do not overwrite existing unrelated secrets.

Build the frontend with staging Supabase public configuration and staging guards, then direct-upload only to the isolated `viawa-staging` Pages project. The existing `viawa` project's previews point to the protected database and must not be used for acceptance. No push or main merge is needed for direct upload.

## Rollback and eventual cleanup

Until actual hosted React acceptance passes, retain `document-service/`, its configuration examples, Dockerfile, converters, Node HTTP adapters and legacy scripts. A subsequent cleanup can remove these production deployment dependencies, DOCX conversion adapters and obsolete standalone URL documentation after verifying no unrelated consumer. Preserve the portable Google orchestration, business merge mapping, database repositories, history/download controls and all safety tests.
