# VIAWA Document Service

Production Node.js 22 runtime exposes four routes:

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
