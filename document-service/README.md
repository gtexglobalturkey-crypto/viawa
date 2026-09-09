# VIAWA Document Service

**Not the canonical contract-generation path.** The canonical runtime is the
Supabase Edge Function `contract-generate` (`supabase/functions/contract-generate`,
built from `document-service/src/edge/handler.ts` — see
`docs/google-first-edge-migration.md`). The frontend (`contractPdfService.ts`)
calls that Edge Function exclusively; nothing in the app calls the routes
below. This local Node/LibreOffice service is retained only for local
development, rollback reference, and its own test suite — it must not be
deployed as, or mistaken for, the production contract path.

This Node.js 22 runtime exposes four routes:

- `GET /health` — process liveness; no filesystem or database access.
- `GET /ready` — DOCX readiness; checks the master template, Supabase, and canonical settings.
- `POST /api/contracts/generate-docx` — the existing authenticated DOCX contract.
- `POST /api/contracts/generate-pdf` — the same request contract, converted with LibreOffice,
  validated, persisted in private Storage, and returned as a download.

The process can be alive while not ready for production traffic. `/ready` reports technical readiness and identifies the current
placeholder setup only as `businessConfiguration: "demo"`; it never returns issuer/bank values.

## Local commands

```text
npm run document-service:typecheck
npm run document-service:build
npm run document-service:start
```

Configuration is read from process environment and documented in `.env.example`. Secrets must
come from a secret manager; the service-role key is server-only. The deterministic container
build uses the repository root as build context:

```text
docker build -f document-service/Dockerfile .
```

The image copies the unchanged master template from
`resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx`.

PDF objects use the existing private `contract-documents` path contract:
`{userId}/{companyId}/{documentRecordId}/{fileName}`. The record folder is deterministically tied
to the latest approved-price snapshot, preventing duplicate generation while allowing a new
approved snapshot to produce a new document version.
