# Google Hardening Worktree — Salvage Note (2026-09-10)

Forensic audit of the preserved worktree `C:/Projects/VIAWA-google-hardening`
(branch `harden/google-first-contract`) against canonical
`main@4ec8ffaef1cc29b04ac27d8f17746d534197ae5c` concluded **PASS**. The
worktree and branch have been deleted. Canonical pricing architecture
remains the `approve_opportunity_price` RPC (see
`supabase/migrations/20260909090000_create_approve_opportunity_price_rpc.sql`);
explicit, user-initiated price approval remains authoritative.

## Rejected as canonical architecture

- `commit_commercial_quote` (RPC + `20260907010000_commit_commercial_quote.sql`)
  — a jsonb-blob alternative to `approve_opportunity_price` solving the same
  atomicity problem differently. Redundant with the RPC already on `main`.
- Automatic price calculation/approval during proposal creation
  (`commercialQuoteWorkflow.ts` auto-commit behavior) — changes who/what
  approves a price; a product decision, not a bug fix. Not adopted.

## Future hardening candidates (not implemented)

1. Add company/exhibition consistency validation to the existing canonical
   `approve_opportunity_price` RPC (scope the write by `company_id` /
   `exhibition_id`, not just `opportunity_id`).
2. Populate `created_by` on `approved_price_snapshots` inserts.
3. Exact exhibition-ID matching in pricing configuration lookup
   (`fetchExhibitionPricingConfig`), in addition to fuzzy name matching.
4. Price Calculator saving/in-flight guard — relevant only if the modal's
   approve flow is later changed to await persistence before closing.
5. `commercialAreaEvents.ts` aggregation concept (sales-pipeline area
   metrics over the existing `commercial_area_events` ledger) and its tests
   were valid, but must not be wired in until a proper event-emission
   architecture exists (nothing currently calls
   `create_commercial_area_event`).
