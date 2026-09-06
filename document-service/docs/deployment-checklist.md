# Production Deployment Checklist

- [ ] Inject all required environment variables and secrets.
- [ ] Confirm `/health` returns `200` without dependencies.
- [ ] Confirm `/ready` returns `200`; replace demo issuer/bank values before production release.
- [ ] Configure Google OAuth client ID, client secret, refresh token, `VIAWA_MASTER_CONTRACT_TEMPLATE_ID` and `VIAWA_GENERATED_DOCUMENTS_FOLDER_ID` server-side. Use separate staging/production output folders; never use the master/template folder for output.
- [ ] Verify `/ready` reports Google authentication, readable/copyable master, writable output-folder metadata, and generated-document schema as healthy. No document is created by this probe.
- [ ] Configure an explicit HTTPS CORS allowlist.
- [ ] Run as non-root with read-only root filesystem and a bounded tmpfs mounted at `/tmp` (not just `DOCUMENT_TEMP_ROOT` — LibreOffice's headless IPC pipe is created directly under system `/tmp` regardless of `-env:UserInstallation`/`TMPDIR`/`HOME`, so a subdirectory-only mount fails every conversion with "no valid pipe path found"). Point `HOME` at the same tmpfs to avoid non-fatal dconf/fontconfig cache warnings.
- [ ] Apply CPU, memory, request timeout, and platform traffic limits.
- [ ] Run unit tests, root/service typechecks, root/service builds, and container smoke tests.
- [ ] Review/apply the two August 25 Google migrations and the additive `20260906120000_harden_generated_document_pdf_identity.sql` migration in the intended environment. Do not repair unrelated migration history.
- [ ] Verify JWT authentication, active-owner authorization and temp cleanup in staging.
- [ ] Verify `/api/contracts/generate-pdf` copies the Google master, saves both Google artifacts to the dedicated output folder, and persists the canonical contract/version and unique PDF archive identity.
- [ ] Compare Drive-uploaded, HTTP-returned and downloaded PDF SHA-256 values, including regeneration with the same display filename. Conflicts must fail, never return an older PDF.
- [ ] Verify the primary generated-copy action “Google Docs'ta Aç”, secondary “PDF İndir”, and database-backed history after refresh/login on another browser. Signing remains manual in Workspace.
- [ ] Keep DOCX/LibreOffice only for explicit non-production fallback. The production DOCX route is disabled; Google readiness does not depend on a local DOCX template.
- [ ] Do not route production traffic until readiness is `200`.
