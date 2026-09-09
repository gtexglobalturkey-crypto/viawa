# VIAWA Document Service

This directory is **not a runnable service anymore** — the local Node/LibreOffice
HTTP server, its Dockerfile, and every legacy-only DOCX/PDF/storage path under it
were removed once the canonical path proved stable (see
`docs/google-first-edge-migration.md`, `docs/google-first-edge-staging-results.md`).

What remains here is the source the canonical Supabase Edge Function
`contract-generate` is built from:

- `src/edge/handler.ts` — the Edge request handler (`Deno.serve` entrypoint is
  `supabase/functions/contract-generate/index.ts`).
- `src/google/portableGoogleWorkspaceClient.ts`,
  `src/google/portableGoogleContractGeneration.ts`, `src/google/googleReadiness.ts`
  — Deno/Edge-safe Google Docs/Drive client, generation pipeline, and read-only
  preflight checks.
- `src/storage/immutableGenerationPdf.ts` — immutable PDF archival into Supabase
  Storage.
- `src/config/environment.ts` — the small `DocumentServiceEnvironment` type the
  Edge readiness check still needs.

Build/typecheck:

```text
npm run document-service:typecheck
npm run contract-edge:build
```

`contract-edge:build` bundles `supabase/functions/contract-generate` into
`.tmp/contract-edge` and fails if any Node-only/native dependency (LibreOffice,
`child_process`, `node:` imports) leaks into the bundle — Docker is not required
to build or deploy it (`supabase functions deploy --use-api`).
