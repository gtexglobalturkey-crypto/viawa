# Production Deployment Checklist

- [ ] Inject all required environment variables and secrets.
- [ ] Confirm `/health` returns `200` without dependencies.
- [ ] Confirm `/ready` returns `200`; replace demo issuer/bank values before production release.
- [ ] Verify the immutable master template name/hash and read access.
- [ ] Configure an explicit HTTPS CORS allowlist.
- [ ] Run as non-root with read-only root filesystem and a bounded tmpfs mounted at `/tmp` (not just `DOCUMENT_TEMP_ROOT` — LibreOffice's headless IPC pipe is created directly under system `/tmp` regardless of `-env:UserInstallation`/`TMPDIR`/`HOME`, so a subdirectory-only mount fails every conversion with "no valid pipe path found"). Point `HOME` at the same tmpfs to avoid non-fatal dconf/fontconfig cache warnings.
- [ ] Apply CPU, memory, request timeout, and platform traffic limits.
- [ ] Run unit tests, root/service typechecks, root/service builds, and container smoke tests.
- [ ] Verify JWT authentication, authorization, DOCX MIME/filename, and temp cleanup in staging.
- [ ] Verify `/api/contracts/generate-pdf` conversion, private upload, duplicate reuse, and download in staging.
- [ ] Do not route production traffic until readiness is `200`.
