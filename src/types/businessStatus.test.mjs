import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  BUSINESS_STATUSES,
  MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY,
  canCloseOpportunity,
  closureOutcomeToStage,
  countActiveOpportunities,
  hasReachedActiveOpportunityLimit,
  isActiveBusinessStatus,
  isTerminalBusinessStatus,
} = await import(new URL("./businessStatus.ts", import.meta.url));

function opportunities(...stages) {
  return stages.map((stage) => ({ stage }));
}

test("MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY is 4", () => {
  assert.equal(MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY, 4);
});

test("signed, lost and won are the only terminal stages", () => {
  const terminalIds = new Set(["signed", "lost", "won"]);

  for (const status of BUSINESS_STATUSES) {
    const shouldBeTerminal = terminalIds.has(status.id);
    assert.equal(
      isTerminalBusinessStatus(status.id),
      shouldBeTerminal,
      `stage "${status.id}" terminality mismatch`,
    );
    assert.equal(isActiveBusinessStatus(status.id), !shouldBeTerminal);
  }
});

test("0-3 active opportunities: limit is not reached, creation is allowed", () => {
  assert.equal(hasReachedActiveOpportunityLimit(opportunities()), false);
  assert.equal(
    hasReachedActiveOpportunityLimit(opportunities("new")),
    false,
  );
  assert.equal(
    hasReachedActiveOpportunityLimit(
      opportunities("new", "contacted", "interested"),
    ),
    false,
  );
});

test("4 active opportunities: limit is reached, a 5th is rejected", () => {
  assert.equal(
    hasReachedActiveOpportunityLimit(
      opportunities("new", "contacted", "interested", "quotation-ready"),
    ),
    true,
  );
});

test("signed, lost and won opportunities are never counted toward the limit", () => {
  assert.equal(
    countActiveOpportunities(
      opportunities("signed", "signed", "lost", "lost", "won"),
    ),
    0,
  );

  // 3 active + a pile of terminal records must still allow a 4th.
  assert.equal(
    hasReachedActiveOpportunityLimit(
      opportunities(
        "new",
        "contacted",
        "interested",
        "signed",
        "won",
        "lost",
      ),
    ),
    false,
  );

  // 4 active alongside terminal records is still the cap.
  assert.equal(
    hasReachedActiveOpportunityLimit(
      opportunities(
        "new",
        "contacted",
        "interested",
        "quotation-ready",
        "won",
        "lost",
      ),
    ),
    true,
  );
});

// Sprint 25.5 — "Signed ≠ Won": Won is its own dedicated stage, not an
// alias for "signed" (Sprint 25.3's original guess, corrected here).
test("closureOutcomeToStage: won maps to won, lost maps to lost", () => {
  assert.equal(closureOutcomeToStage("won"), "won");
  assert.equal(closureOutcomeToStage("lost"), "lost");
});

test("closureOutcomeToStage always resolves to a terminal stage", () => {
  assert.equal(isTerminalBusinessStatus(closureOutcomeToStage("won")), true);
  assert.equal(isTerminalBusinessStatus(closureOutcomeToStage("lost")), true);
});

// RC-05 — canCloseOpportunity now shares the exact same terminal
// definition as isTerminalBusinessStatus (Company Detail, the active
// count, and the opportunity limit already used this). "signed" is no
// longer a special case: Katılım Onaylandı writing stage="signed" is
// itself the terminal event, not a still-open "awaiting Kazanıldı"
// state (the old Sprint 25.5 rule this test previously encoded).
test("canCloseOpportunity: every non-terminal stage can still be closed, every terminal stage cannot", () => {
  for (const status of BUSINESS_STATUSES) {
    assert.equal(
      canCloseOpportunity(status.id),
      !status.isTerminal,
      `stage "${status.id}" closeability mismatch`,
    );
  }
});

test("canCloseOpportunity: signed, won and lost can never be closed again", () => {
  assert.equal(canCloseOpportunity("signed"), false);
  assert.equal(canCloseOpportunity("won"), false);
  assert.equal(canCloseOpportunity("lost"), false);
});

test("canCloseOpportunity: a missing stage cannot be closed", () => {
  assert.equal(canCloseOpportunity(null), false);
  assert.equal(canCloseOpportunity(undefined), false);
  assert.equal(canCloseOpportunity(""), false);
});

// The migration is the actual concurrency-safe guarantee (see
// BUG-S25-001); there is no live Postgres in this test run, so this
// asserts its structure the same way persistentRepositories.test.mjs
// already asserts supabase/migrations/20260731050000_...sql's trigger
// text. The behavior itself (insert/update scenarios, and the advisory
// lock actually serializing a real race) was separately verified against
// a real throwaway Postgres container during development.
test("enforce_active_opportunity_limit migration has the required guarantees", async () => {
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20260801100000_enforce_active_opportunity_limit.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /before insert or update on public\.opportunities/i);
  assert.match(migration, /for each row execute function public\.enforce_active_opportunity_limit/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(new\.company_id::text, 0\)\)/);
  assert.match(migration, /raise exception 'ACTIVE_OPPORTUNITY_LIMIT_REACHED'/);
  assert.match(migration, /max_active constant integer := 4/);

  // Terminal rows are never blocked and never counted.
  assert.match(migration, /new\.stage = any \(terminal_stages\)[\s\S]*?return new;/);

  // UPDATE only checks on reactivation (a) or a company move (b).
  assert.match(migration, /old\.stage = any \(terminal_stages\)/);
  assert.match(migration, /new\.company_id is distinct from old\.company_id/);

  // The row being updated must not count against itself.
  assert.match(migration, /and id <> new\.id/);

  // No backfill / no auto-terminal-conversion of pre-existing violations.
  assert.doesNotMatch(migration, /delete from public\.opportunities/i);
  assert.doesNotMatch(migration, /update public\.opportunities\s+set/i);
});

// Sprint 25.5 — 'won' must be added to the trigger's own terminal_stages
// array, or a company with several Won opportunities could be wrongly
// blocked from creating a new active one (BUG-S25-001's cap would
// over-count them as active).
test("include_won_in_terminal_stages migration adds 'won' without changing the rest of the guarantee", async () => {
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20260801120000_include_won_in_terminal_stages.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /terminal_stages constant text\[\] := array\['signed', 'lost', 'won'\]/,
  );
  assert.match(migration, /create or replace function public\.enforce_active_opportunity_limit/i);
  assert.match(migration, /raise exception 'ACTIVE_OPPORTUNITY_LIMIT_REACHED'/);
  assert.match(migration, /max_active constant integer := 4/);
});
