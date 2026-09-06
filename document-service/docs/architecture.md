# Architecture

The built-in `node:http` server is an adapter around the existing runtime-independent DOCX
handler. It reuses Supabase token authentication, company/opportunity authorization, persistent
repositories, atomic contract numbering, the contract orchestrator, central mapping, DOCX
Content Control adapter, response headers, and request-scoped cleanup. Business logic is not
copied into the server.

`/health` is liveness only. `/ready` independently verifies the template and database-backed
canonical settings. Valid issuer/bank JSON objects produce technical readiness; demo configuration
is identified by a non-sensitive response marker and does not block readiness.

The PDF route reuses the same handler, authentication, authorization, repositories, orchestrator,
merge and DOCX adapter. The existing PDF adapter invokes the existing LibreOffice converter. A
validated `%PDF-` buffer is uploaded with `upsert: false` to private Storage before the identical
bytes are returned. Existing objects in the deterministic document folder are downloaded instead
of generating a duplicate. Queue and concurrency control remain outside this sprint.


## Google-first production path

See `../../docs/google-first-hardening.md` for the authoritative Google generation, immutable PDF archive, database history and readiness behavior. DOCX/LibreOffice descriptions above apply only to non-production technical fallback. Production uses Google Docs/Drive and manual Workspace signing.
