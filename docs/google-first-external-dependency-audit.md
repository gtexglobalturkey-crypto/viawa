# Google-first external dependency audit

Scope: repository runtime dependencies reviewed for the Google-first contract V1. This audit does not authorize deployment or remote configuration changes.

| Capability | Current implementation | Decision | Release boundary |
| --- | --- | --- | --- |
| Application database, authentication, RLS, operational state and private PDF archive | Supabase | KEEP | Core VIAWA infrastructure. Do not replace. |
| Contract master, copy, merge, PDF export and document archive | Google Docs and Drive | KEEP | Authoritative Google-first document path. Master remains immutable. |
| Contract signing | Legacy Dropbox Sign sender and Edge Function | REMOVE | Runtime sender, parser, tests and function removed. V1 users initiate Google eSignature manually; no speculative API integration. |
| Legacy browser document history | `viawa.generatedDocuments.v1.*` localStorage | DEFER | Read compatibility is retained. Do not migrate or delete silently; Supabase becomes authoritative after the migration is approved. |
| Generated PDF private application copy | Supabase Storage `contract-documents` | KEEP | Shared application archive/audit path, not a signing-provider dependency. Drive remains the Google document archive. |
| Organizer Report email | Gmail OAuth and Gmail send API | KEEP | Existing working integration; preserved unchanged. |
| Workspace Contract email action | Client mailto draft | DEFER | No signing-provider call. A broader Gmail operational-email integration should be a separate release. |
| Communication Center email records | Supabase records; no live mailbox provider | KEEP | Operational history belongs in VIAWA. Gmail mailbox sync is future scope. |
| Spreadsheet/report export | `xlsx` package and existing report generation | KEEP | Current local export has consumers. Google Sheets is a future integration point, not this release. |
| Calendar, meetings and online meeting actions | VIAWA action/reminder data; no external provider integration found | DEFER | Calendar/Meet may be added at explicit scheduling boundaries later. |
| File sharing and document approval | Drive links/manual Workspace controls | REPLACE WITH GOOGLE | Use Workspace sharing/approval operationally; no new automation in V1. |
| External campaign/email tooling | No active campaign SaaS dependency found | DEFER | Sheets recipient datasets and Gmail tooling may be evaluated separately. |

## Removed Dropbox surface

- Browser signing service and response parser.
- `dropbox-sign-send` Supabase Edge Function and its focused tests.
- Active Workspace Email callback and Customer Workspace signing orchestration.
- Generated-document database signing state (`signing_status`).
- `READY_FOR_SIGNATURE`; successful generation now ends at `COMPLETED`.

No Dropbox SDK/package or frontend environment variable existed in `package.json` or the checked-in environment examples. The legacy `sent-for-signature` status remains readable, and unknown old JSON fields are preserved at runtime, so browser data is not silently destroyed; new records and the Supabase schema do not write provider state.

## Clean future integration points

- Gmail: replace the contract mailto action only through the existing server-side OAuth/send pattern.
- Calendar/Meet: add after a VIAWA meeting action is committed, preserving VIAWA as the operational source of truth.
- Sheets: publish reports or controlled recipient datasets from explicit export actions.
- Google eSignature: automate only if a supported Workspace API/workflow is selected and independently designed.
