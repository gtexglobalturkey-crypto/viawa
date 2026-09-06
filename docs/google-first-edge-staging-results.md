# Supabase Edge migration — staging results

## A. Architecture

Implemented: React on the isolated Cloudflare Pages `viawa-staging` project → authenticated Supabase `contract-generate` Edge Function → caller-scoped Supabase data/RPC/Storage and Google Docs/Drive. Signing remains manual in Google Workspace. No Containers, Workers Paid, standalone Node host, Docker runtime or LibreOffice is required by the deployed staging path.

## B. Files changed

Implementation commit `f275a74a50e1bda7e8eb383b646b0ced54d37684` changes exactly:

```text
.env.staging.example
docs/google-first-edge-migration.md
document-service/src/edge/handler.test.mjs
document-service/src/edge/handler.ts
document-service/src/edge/runtime.ts
document-service/src/google/googleReadiness.ts
document-service/src/google/googleWorkspaceClient.test.mjs
document-service/src/google/googleWorkspaceClient.ts
document-service/src/google/portableGoogleContractGeneration.ts
document-service/src/google/portableGoogleWorkspaceClient.ts
document-service/src/google/requestScopedGoogleContractGeneration.ts
document-service/src/storage/immutableGenerationPdf.ts
package.json
scripts/build-contract-edge.mjs
src/modules/document-engine/engine/formatContractDate.ts
src/modules/document-engine/services/contractEdgeTransport.test.mjs
src/modules/document-engine/services/contractPdfService.ts
supabase/functions/contract-generate/deno.json
supabase/functions/contract-generate/deno.lock
supabase/functions/contract-generate/index.ts
vite-plugins/contract-docx-endpoint/persistentContractDataSource.ts
vite-plugins/contract-docx-endpoint/supabaseAuthorization.ts
```

This results document is a subsequent evidence-only addition. Companies, Kanban, Organizer Report, Gmail, exhibition implementation and migrations were not changed by the Edge sprint.

## C–E. Function, runtime and security

`contract-generate` verifies JWT/user, active membership and existing opportunity ownership before Google side effects. It reuses approved-price/business mapping, canonical numbering, generation lifecycle and immutable PDF archival. Active admin owners are allowed; admin non-owners remain denied under the existing policy. There is no service-role client in the function.

Server secrets contain Google credentials, locked master ID, approved output folder and the explicit origin `https://viawa-staging.pages.dev`. Frontend build verification found staging Supabase URL and Edge transport, no protected database URL and no server credential values. Gateway JWT verification is enabled. Read-only readiness checks run behind owner authorization before generation.

The old Node service is retained for rollback/reference, not called by this frontend. It is **not yet a retirement candidate**, because browser acceptance remains incomplete.

## F–G. Local verification

- Complete relevant suite: **466 tests; 465 passed, 0 failed, 1 skipped** (optional real LibreOffice integration).
- Includes **15 added tests** for Edge handler/transport, auth policy, lifecycle/archive failure, byte parity, timeout cleanup, size bounds and Istanbul midnight-date behavior. Existing version-allocation retry, collision, history and exhibition coverage remains.
- Application staging build: **PASS**.
- Source Edge/Deno typecheck: **PASS**, Deno 2.9.6; dependency lock committed.
- Portable deployment bundle: **55,520 bytes**, native dependency scan **PASS**.
- Rollback Document Service typecheck and build: **PASS**.
- `git diff --check`: **PASS**.

## H. Staging deployments

Both deployments use implementation SHA **`f275a74a50e1bda7e8eb383b646b0ced54d37684`**.

**Supabase:** project `mmbmepxftibxjsyhlgtg`; function `contract-generate`; ID `eec3dc8e-1f62-4c6f-8500-c7da436a6970`; version **1**; status **ACTIVE**; `verify_jwt: true`.

- Endpoint: `https://mmbmepxftibxjsyhlgtg.supabase.co/functions/v1/contract-generate`
- Runtime deployment ID: `mmbmepxftibxjsyhlgtg_eec3dc8e-1f62-4c6f-8500-c7da436a6970_1`
- Provider bundle hash: `c15438a4c884e51ac84882d6bed297b2bc1af45c6e46bd7ab2fe0b3391e341eb`
- Deployed via explicit staging project ref and API bundle upload; no Docker daemon used.

**Cloudflare Pages:** separate project `viawa-staging`; deployment **`fd7f7d1d-004a-402e-833e-2dacf252e625`**; provider stage **success**; direct upload; clean commit metadata.

- Assigned project URL: `https://viawa-staging.pages.dev`
- Immutable deployment URL: `https://fd7f7d1d.viawa-staging.pages.dev`
- Cloudflare labels the primary deployment slot within this dedicated staging project `production`. This is **not** VIAWA's production project/domain; the existing `viawa` project and `app.expoviafair.com` were untouched.
- Local HTTPS probes to the project hostname failed with `UND_ERR_CONNECT_TIMEOUT` to `172.66.44.231:443`. Thus provider deployment success is verified, but actual frontend delivery/boot is not claimed.

## I. Real staging smoke — all 20 requested checks

The hosted Edge API smoke ran once using the approved synthetic owner fixture. It was **not initiated by a browser**, because browser discovery returned no available browser. Backend checks below are real hosted results, not mocked unit-test evidence.

| # | Acceptance check | Result |
| --- | --- | --- |
| 1 | Owner login in React | NOT RUN; owner authenticated through staging Auth API. |
| 2 | Generate from React | NOT RUN; one generation invoked through deployed Edge HTTP endpoint. |
| 3 | Edge performs generation | PASS; deployed function version 1, runtime logs and HTTP 200. |
| 4 | Contract completes | PASS; one new COMPLETED row, version 6. Result staying visible in browser remains unverified. |
| 5 | Doc in staging folder | PASS; sole parent is approved folder. |
| 6 | PDF in staging folder | PASS; same sole parent. |
| 7 | Master unchanged | PASS; before/after evidence below. |
| 8 | Company/fair/pricing | PASS; synthetic fixture, EXP-2027-000001, total 9810.00 USD; PDF inspected. |
| 9 | Turkish characters | PASS; Docs text plus rendered PDF pages inspected. |
| 10 | Stand area 12 m² | PASS; Docs and rendered PDF; no 12.00 m². |
| 11 | No unresolved placeholders | PASS; provider verification and copied-document text check. |
| 12 | Two-page PDF | PASS; both pages rendered and visually inspected, signature/stamp area intact. |
| 13 | PDF SHA-256 equality | PASS; HTTP, Drive file, Supabase Storage and database hash identical. |
| 14 | Byte-size equality | PASS; 256,243 bytes. |
| 15 | Primary persisted Docs copy action | PARTIAL; actual React component rendered from live persisted row with exact provider URL, primary order and master exclusion. Actual click/opened Doc ID NOT RUN. |
| 16 | Secondary selected-version PDF | PARTIAL; actual UI download function in a fresh authenticated client returns exact version-6 bytes. Browser download click NOT RUN. |
| 17 | Refresh history | PARTIAL; actual history repository loads 6 persisted rows without browser cache. Page refresh NOT RUN. |
| 18 | Logout/login history | PARTIAL; a new authenticated owner session loads all 6 rows. Actual UI logout/login NOT RUN. |
| 19 | Non-owner denied | PASS at hosted API: 403 OPPORTUNITY_ACCESS_DENIED; zero history rows; Storage denied with no PDF data. |
| 20 | Inactive denied | PASS at hosted API: 403 APPLICATION_ACCESS_DENIED; zero history rows; Storage denied with no PDF data. |

Unauthenticated deployed endpoint: HTTP **401** at JWT gateway. Denied generation requests created no rows. All **5** pre-existing history rows were preserved unchanged. No signing request was made. Unrelated UI visual regression acceptance remains unperformed; source scope checks and existing regression tests passed.

### Generated evidence

- Row: `5671e75d-a067-4d85-ae52-2ca400ceeae8`; version **6**; canonical number **EXP-2027-000001**.
- [Generated Google Doc](https://docs.google.com/document/d/1ERB7mJpINhzYtZDgDRqnfJ3WkAGZa7Sq92aIyv6nHas/edit?usp=drivesdk)
- Generated Doc ID: `1ERB7mJpINhzYtZDgDRqnfJ3WkAGZa7Sq92aIyv6nHas`; opened browser Doc ID: **not observed**.
- [Generated Drive PDF](https://drive.google.com/file/d/1TADlYeEuygM2SiBlq4B3IOJjBuJjNwsH/view?usp=drivesdk)
- Output folder: `1xRmyrvlkXDZHBFrPdLNJFuE1lYw8R8m_`.
- PDF SHA-256: `36e1e957015e2287e4f8d67aebb8f0af1a79d328cd51079bec62c955977516b3`.
- Storage: `contract-documents/19f88b99-41ad-46ec-b1c8-492284545da4/71000000-0000-4000-8000-000000000001/5671e75d-a067-4d85-ae52-2ca400ceeae8/contract.pdf`.

## J. Runtime measurements

- Successful invocation: **14,587 ms** handler duration, measured in response and hosted log.
- Region: `eu-central-1`; runtime `supabase-edge-runtime-1.74.3`, compatible with Deno 2.1.4.
- End-of-handler heap: **12,423,944 bytes** (~11.85 MiB). RSS reports 0 and is not a meaningful RSS measurement.
- Matching execution `309ebec0-3f7c-48b6-b9fc-1bbda7b5af53`: shutdown `memory_used.total` **13,618,509 bytes**, raw `cpu_time_used` **110**, reason **EarlyDrop**. These are worker lifecycle measurements, not a measured peak-memory profile.
- Provider time to response headers: master copy **2671 ms**, Docs replacement **985 ms**, copied-Docs verification **497 ms**, PDF export **907 ms**, Drive PDF upload **1587 ms**. Body transfer is included in total invocation duration, not these individual header timings.
- No resource-limit warning/error, deadline failure or 546 response observed. Logs contain a Supabase JS Node-version deprecation warning under the Edge compatibility runtime; generation still succeeded. This warning is not evidence of a Node hosting requirement.

## K. Master safety

Master ID: `1Whhw7_JHhIsI0ZR-tCjEVt_Z4cHQUmFMYOAZub0CtSI`.

- Version: **291 → 291**.
- Modified time: **2026-08-24T21:17:46.453Z → unchanged**.
- Full retrieved Docs + selected Drive metadata snapshot SHA-256: **`c6cf664c2030f91656bd7490541e5c834fbde798acae5b413135f0d553927035` → identical**.
- Generated Doc ID differs from master. Master was only read/copied.

Detailed synthetic evidence is retained in ignored `.tmp/edge-smoke/`, including result/history JSON, provider/runtime logs, master before/after JSON, copied document JSON/text, PDF and both page PNGs. Deployment metadata is under `.tmp/hosted-acceptance/`. Credentials were not committed or included in these evidence reports.

## L–N. Git, production and decision

Implementation branch: `harden/google-first-contract`; implementation SHA `f275a74a50e1bda7e8eb383b646b0ced54d37684`, ahead 4 / behind 0 observed origin/main before this evidence-only commit. No branch push or main merge was needed. The final response reports the evidence commit and final clean state.

No production deployment, migration, environment-variable change, folder output, contract generation or Google signing operation occurred. No new hosting product or paid plan was purchased/enabled.

**NO-GO — FIX REQUIRED.** The remaining blocker is actual hosted React acceptance: connect a browser that can reach the staging frontend, then verify login, generation/result persistence, exact Doc click, PDF click, refresh/logout/login and visible UI regressions. The Edge backend and measured runtime have passed; no separate Document Service is required to resolve this gate.
