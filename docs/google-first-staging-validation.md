# Controlled Google-first staging validation

Run: 2026-09-06, 20:49:49–20:50:25 UTC (23:49:49–23:50:25 Istanbul).

**Backend/Drive smoke: PASS. Complete browser end-to-end acceptance: NOT RUN.**

Tested implementation: `a5edae5e2aa2f30281910e2961a7ae6ae237faf5`, branch `harden/google-first-contract`, in the separate `C:/Projects/VIAWA-google-hardening` worktree. The built hardened service ran locally on loopback port 18087 with live staging Supabase and Google services. This does not validate a hosted service deployment.

## Environment and migration

- Supabase: `mmbmepxftibxjsyhlgtg` (VIAWA Staging), explicitly addressed. The default CLI project is ATLAS; linked-project mutation commands were not used.
- Approved output folder: [VIAWA — STAGING Generated Contracts](https://drive.google.com/drive/folders/1xRmyrvlkXDZHBFrPdLNJFuE1lYw8R8m_). Folder configuration was supplied only to the task-local staging process; no production configuration was changed.
- Initial readiness: HTTP **503**, Google checks all `ok`, generated-document schema unavailable; REST error `42703`, `column generated_documents.file_name does not exist`.
- Verified both prerequisite migration versions `20260825120000` and `20260825130000` in the staging ledger.
- Applied only `20260906120000_harden_generated_document_pdf_identity.sql` to staging, transactionally with its ledger entry. Management API HTTP **201**. No historical updates/backfills; original values in all **4/4** historical rows verified unchanged across migration and generation. Existing generated-document RLS policies compared equal before/after.
- Subsequent `/ready`: HTTP **200**, `ready`; configuration, authentication, master, folder, generatedDocuments, database and documentSettings all `ok`; template `not_required`.

## Exact smoke results

| Requirement | Result | Evidence |
| --- | --- | --- |
| Contract generation | PASS | Owner POST returned HTTP **200**, `application/pdf`, `COMPLETED`; exactly one new row, version **5**, canonical number **EXP-2027-000001**. |
| Master unchanged | PASS | Master version **291 → 291**, modifiedTime **2026-08-24T21:17:46.453Z → unchanged**; full retrieved Docs JSON plus selected Drive metadata had identical SHA-256 before/after. |
| Google Doc folder | PASS | Persisted copy ID differs from master; its sole parent is the approved staging folder. |
| Google PDF folder | PASS | Persisted PDF's sole parent is the same approved staging folder. |
| Synthetic company/fair | PASS | `VIAWA STAGING TEST ÇĞİÖŞÜ MADENCİLİK çğıöşü LTD.` and `VIAWA STAGING TEST FAIR 2027`. Existing synthetic fixture was reused without overwriting its business data. |
| Turkish rendering | PASS | Docs content checks plus visual inspection of both rendered PDF pages; uppercase/lowercase Turkish characters intact. |
| Stand area | PASS | `12 m²` in Docs and PDF; no `12.00 m²`. |
| Placeholder resolution | PASS | No unresolved double-brace placeholders in the copied document; generation verification succeeded. |
| Persistence | PASS | Database stores matching Doc/PDF IDs and URLs, template ID, canonical contract UUID, version, unique Storage path, file name, SHA-256 and byte count. Four historical records unchanged. |
| VIAWA primary handoff | PARTIAL | Actual React component rendered using the live persisted row: exact saved copy URL, primary Docs action before secondary PDF action, `_blank` with `noopener noreferrer`, no master link. Actual browser click/navigation **NOT RUN**: browser discovery returned no available browser. |
| Exact PDF download | PASS | HTTP bytes, uploaded Drive PDF, owner-authenticated Storage download, and the actual UI `loadMatchingGeneratedPdf` function all matched exactly. |
| Authorization | PASS | Non-owner generation HTTP **403** `OPPORTUNITY_ACCESS_DENIED`; inactive generation HTTP **403** `APPLICATION_ACCESS_DENIED`; neither created a row. Each user's history returned zero rows and Storage denied download (HTTP **400**, no file data). Owner's fresh session loaded all **5** records via the actual history repository and downloaded the current PDF without browser cache. |

The PDF has **2 pages**, visually reviewed with no observed clipping, missing Turkish glyphs or overlapping content. Existing stamp/signature area is present. Contract date is **06.09.2026**, fair dates **2027-05-24–2027-05-27**, matching the run and synthetic fixture. No signing action was initiated.

## Created artifacts and identity

- [Generated Google Docs copy](https://docs.google.com/document/d/1guc0BVRHe67cULDjmO1qmjKwvBNnajZMZaiNzfzhA-c/edit?usp=drivesdk)
- [Generated Drive PDF](https://drive.google.com/file/d/1sAGqbVab6pwAGTaPqeir11tG2Wkk8AAQ/view?usp=drivesdk)
- Generated-document row: `b53f9bab-74a7-4ea2-a453-78324dc20c91`.
- Canonical contract UUID: `cedb20df-0c49-4cc5-b30a-67d607738132`.
- Private bucket: `contract-documents`.
- Storage path: `19f88b99-41ad-46ec-b1c8-492284545da4/71000000-0000-4000-8000-000000000001/b53f9bab-74a7-4ea2-a453-78324dc20c91/contract.pdf`.
- PDF bytes: **256243**.
- HTTP / Drive / Storage / database SHA-256: `270b5bc6dd709c2ec26bcd3e93079814ff5b2f8581523d01bb46241175b165dc`.
- Master before/after snapshot SHA-256: `2668dd6fcc55fa68689f49cff63504650cf3073aeb198299a33b53cd8f956db9`.

Detailed local evidence is in ignored `.tmp/staging-smoke/`: `result.json`, `history-result.json`, database before/after snapshots, master before/after snapshots, `copy.json`, `copy-text.txt`, `contract.pdf`, two rendered page PNGs and `handoff.html`. These local files contain synthetic staging evidence, not credentials. OAuth/session tokens remained in process memory. Auth sessions were obtained through admin-generated magic links without sending emails or changing passwords.

## Verification and remaining gate

Existing implementation verification remains **450 passed, 0 failed, 1 skipped**; actual local SQL migration tests **6 passed, 0 failed**; application build and document-service typecheck/build passed. This validation turn changed documentation only, so those builds/tests were not unnecessarily repeated. Added live evidence confirms the migration, Google generation, persisted fresh-session history and exact UI download path. `git diff --check` passed after report changes.

**NO-GO — FIX REQUIRED** for production rollout: complete the actual browser handoff acceptance and validate the intended hosted deployment/configuration before a controlled production decision. This is an outstanding validation gate, not a failed backend smoke or a missing staging folder. No production push, deployment, migration, folder use, master mutation, signing request or artifact deletion occurred. The synthetic Doc/PDF and row are retained for review.
