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

const { WorkflowEngine } = await import(
  new URL("./WorkflowEngine.ts", import.meta.url)
);

const NOW = "2026-08-04T09:00:00.000Z";

function reminder(id, overrides = {}) {
  return {
    id,
    company_id: "company-1",
    opportunity_id: null,
    task_type: "manual-opportunity-follow-up",
    title: `Reminder ${id}`,
    due_date: "2026-08-01T07:00:00.000Z",
    completed: false,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function opportunity(id, stage) {
  return {
    id,
    company_id: "company-1",
    stage,
  };
}

function baseContext(overrides = {}) {
  return {
    now: NOW,
    emails: [],
    reminders: [],
    opportunities: [],
    timelineEvents: [],
    aiMemory: [],
    callNotes: [],
    ...overrides,
  };
}

function hasReminderTask(result, reminderId) {
  return result.queue.some(
    (task) => task.id === `reminder-${reminderId}`,
  );
}

// Kritik Akış Düzeltmesi 9 — collectReminderTasks must never surface a
// reminder-derived Today task once the reminder's own opportunity has
// reached a terminal stage, even if the reminder row itself is still
// completed:false (the exact "orphan reminder" scenario proven live —
// see the diagnostic report). Manual reminders (opportunity_id: null)
// and reminders whose opportunity can't be found in this context must
// be entirely unaffected.

test("completed:false + active opportunity: task IS produced", () => {
  const result = new WorkflowEngine().generate(
    baseContext({
      reminders: [
        reminder("r1", {
          opportunity_id: "opp-active",
        }),
      ],
      opportunities: [
        opportunity("opp-active", "contacted"),
      ],
    }),
  );

  assert.equal(hasReminderTask(result, "r1"), true);
});

test("completed:false + lost opportunity: task is NOT produced", () => {
  const result = new WorkflowEngine().generate(
    baseContext({
      reminders: [
        reminder("r1", {
          opportunity_id: "opp-lost",
        }),
      ],
      opportunities: [
        opportunity("opp-lost", "lost"),
      ],
    }),
  );

  assert.equal(hasReminderTask(result, "r1"), false);
});

test("completed:false + signed opportunity: task is NOT produced", () => {
  const result = new WorkflowEngine().generate(
    baseContext({
      reminders: [
        reminder("r1", {
          opportunity_id: "opp-signed",
        }),
      ],
      opportunities: [
        opportunity("opp-signed", "signed"),
      ],
    }),
  );

  assert.equal(hasReminderTask(result, "r1"), false);
});

test("completed:false + opportunity_id:null (manual task): task IS produced", () => {
  const result = new WorkflowEngine().generate(
    baseContext({
      reminders: [
        reminder("r1", {
          opportunity_id: null,
        }),
      ],
      opportunities: [
        opportunity("opp-lost", "lost"),
      ],
    }),
  );

  assert.equal(hasReminderTask(result, "r1"), true);
});

test("completed:true + active opportunity: task is NOT produced (unchanged pre-existing behavior)", () => {
  const result = new WorkflowEngine().generate(
    baseContext({
      reminders: [
        reminder("r1", {
          opportunity_id: "opp-active",
          completed: true,
        }),
      ],
      opportunities: [
        opportunity("opp-active", "contacted"),
      ],
    }),
  );

  assert.equal(hasReminderTask(result, "r1"), false);
});

test("opportunity_id set but not found in this context: existing behavior preserved (task still produced)", () => {
  const result = new WorkflowEngine().generate(
    baseContext({
      reminders: [
        reminder("r1", {
          opportunity_id: "opp-missing",
        }),
      ],
      opportunities: [],
    }),
  );

  assert.equal(hasReminderTask(result, "r1"), true);
});

// Kritik Akış Düzeltmesi 5 (Today görevlerinin tamamlanması) — bunun
// bir "üçüncü katman" olduğunu, ilk ikisinin (kapanış anında reminder
// tamamlama, ve şimdi burada WorkflowEngine'in kendi bağımsız kontrolü)
// birbirinden habersiz çalıştığını doğrulayan bir senaryo: aynı anda
// hem lost hem signed birden fazla reminder, karışık completed
// durumlarıyla.
test("mixed reminders across multiple terminal and active opportunities resolve independently", () => {
  const result = new WorkflowEngine().generate(
    baseContext({
      reminders: [
        reminder("open-active", {
          opportunity_id: "opp-active",
        }),
        reminder("open-lost", {
          opportunity_id: "opp-lost",
        }),
        reminder("open-signed", {
          opportunity_id: "opp-signed",
        }),
        reminder("open-manual", {
          opportunity_id: null,
        }),
      ],
      opportunities: [
        opportunity("opp-active", "contacted"),
        opportunity("opp-lost", "lost"),
        opportunity("opp-signed", "signed"),
      ],
    }),
  );

  assert.equal(hasReminderTask(result, "open-active"), true);
  assert.equal(hasReminderTask(result, "open-lost"), false);
  assert.equal(hasReminderTask(result, "open-signed"), false);
  assert.equal(hasReminderTask(result, "open-manual"), true);
});
