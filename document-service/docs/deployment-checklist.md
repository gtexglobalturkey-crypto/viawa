# Production Deployment Checklist

- [ ] Inject all required environment variables and secrets.
- [ ] Confirm `/health` returns `200` without dependencies.
- [ ] Confirm `/ready` returns `200`; replace demo issuer/bank values before production release.
- [ ] Verify the immutable master template name/hash and read access.
- [ ] Configure an explicit HTTPS CORS allowlist.
- [ ] Run as non-root with read-only root filesystem and bounded tmpfs at `DOCUMENT_TEMP_ROOT`.
- [ ] Apply CPU, memory, request timeout, and platform traffic limits.
- [ ] Run unit tests, root/service typechecks, root/service builds, and container smoke tests.
- [ ] Verify JWT authentication, authorization, DOCX MIME/filename, and temp cleanup in staging.
- [ ] Verify `/api/contracts/generate-pdf` conversion, private upload, duplicate reuse, and download in staging.
- [ ] Do not route production traffic until readiness is `200`.
