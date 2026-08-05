import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { selectOpenRemindersForOpportunity } = await import(
  new URL("./reminderClosureRule.ts", import.meta.url)
);

function reminder(id, opportunityId, completed) {
  return {
    id,
    company_id: "company-1",
    opportunity_id: opportunityId,
    task_type: "manual-opportunity-follow-up",
    title: `reminder ${id}`,
    due_date: null,
    completed,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

// Kritik Akış Düzeltmesi 5 — this is the exact rule that decides which
// reminders a terminal opportunity (lost/won/signed, from any of the
// four closure screens) closes out. TESTLER 1/3/5/6/8 all reduce to
// this selection being correct.

test("selects every open reminder linked to the given opportunity", () => {
  const reminders = [
    reminder("r1", "opp-1", false),
    reminder("r2", "opp-1", false),
    reminder("r3", "opp-1", false),
  ];

  const result = selectOpenRemindersForOpportunity(
    reminders,
    "opp-1",
  );

  assert.deepEqual(
    result.map((r) => r.id),
    ["r1", "r2", "r3"],
  );
});

test("never selects a manual reminder with no opportunity_id (company-level task)", () => {
  const reminders = [
    reminder("r1", "opp-1", false),
    { ...reminder("manual", null, false), opportunity_id: null },
  ];

  const result = selectOpenRemindersForOpportunity(
    reminders,
    "opp-1",
  );

  assert.deepEqual(
    result.map((r) => r.id),
    ["r1"],
  );
});

test("never selects a reminder belonging to a different (still active) opportunity", () => {
  const reminders = [
    reminder("r1", "opp-1", false),
    reminder("other-opp", "opp-2", false),
  ];

  const result = selectOpenRemindersForOpportunity(
    reminders,
    "opp-1",
  );

  assert.deepEqual(
    result.map((r) => r.id),
    ["r1"],
  );
});

test("already-completed reminders for the same opportunity are excluded (no duplicate write)", () => {
  const reminders = [
    reminder("r1", "opp-1", true),
    reminder("r2", "opp-1", false),
  ];

  const result = selectOpenRemindersForOpportunity(
    reminders,
    "opp-1",
  );

  assert.deepEqual(
    result.map((r) => r.id),
    ["r2"],
  );
});

test("idempotent: once every reminder for the opportunity is already completed, re-running selects nothing", () => {
  const reminders = [
    reminder("r1", "opp-1", true),
    reminder("r2", "opp-1", true),
    reminder("r3", "opp-1", true),
  ];

  const result = selectOpenRemindersForOpportunity(
    reminders,
    "opp-1",
  );

  assert.deepEqual(result, []);
});

test("no reminders exist for the opportunity at all: empty, not an error", () => {
  const result = selectOpenRemindersForOpportunity(
    [reminder("r1", "opp-2", false)],
    "opp-1",
  );

  assert.deepEqual(result, []);
});
