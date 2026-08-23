import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const {
  buildWorkspacePath,
  getFairScopedOpportunities,
  getKanbanColumnId,
  getLatestCallNoteByCompany,
  KANBAN_COLUMNS,
  matchesCompanyStatusFilter,
  matchesNextAction,
  matchesPresence,
  sortCompanyIdsByLastCallNote,
} = await import(new URL("./companiesKanban.ts", import.meta.url));

const opportunity = (id, stage, exhibition = "fair-1", contact = null) => ({
  id, stage, exhibition_id: exhibition, company_id: `company-${id}`, contact_id: contact,
});

test("Kanban has exactly the four locked presentation columns", () => {
  assert.deepEqual(KANBAN_COLUMNS.map((item) => item.label), ["Yeni", "Bilgilendirme", "Teklif", "Sözleşme"]);
});

test("every active canonical stage maps to its locked visual group", () => {
  assert.equal(getKanbanColumnId("new"), "new");
  assert.equal(getKanbanColumnId("contacted"), "new");
  assert.equal(getKanbanColumnId("interested"), "new");
  assert.equal(getKanbanColumnId("information-sent"), "information");
  assert.equal(getKanbanColumnId("quotation-ready"), "quotation");
  assert.equal(getKanbanColumnId("proposal-ready"), "quotation");
  assert.equal(getKanbanColumnId("quotation-sent"), "contract");
  assert.equal(getKanbanColumnId("negotiation"), "contract");
  assert.equal(getKanbanColumnId("contract"), "contract");
});

test("terminal stages never fabricate a normal Kanban column", () => {
  for (const stage of ["signed", "won", "lost"]) assert.equal(getKanbanColumnId(stage), null);
});

test("fair scoping returns only real records and hides terminal records by default", () => {
  const records = [opportunity("1", "new"), opportunity("2", "signed"), opportunity("3", "contacted", "fair-2")];
  assert.deepEqual(getFairScopedOpportunities(records, "fair-1", false).map((item) => item.id), ["1"]);
  assert.deepEqual(getFairScopedOpportunities(records, "fair-1", true).map((item) => item.id), ["1", "2"]);
  assert.equal(records.length, 3);
});

test("card route preserves company, opportunity, and optional contact context", () => {
  assert.equal(buildWorkspacePath(opportunity("1", "new", "fair-1", "contact-1")), "/call?companyId=company-1&opportunityId=1&contactId=contact-1");
});

test("Son İşlem uses latest saved call-note updated_at and places no-note companies last", () => {
  const notes = [
    { company_id: "a", updated_at: "2026-01-01T00:00:00Z" },
    { company_id: "a", updated_at: "2026-03-01T00:00:00Z" },
    { company_id: "b", updated_at: "2026-02-01T00:00:00Z" },
  ];
  const latest = getLatestCallNoteByCompany(notes);
  assert.equal(latest.get("a"), "2026-03-01T00:00:00Z");
  assert.deepEqual(sortCompanyIdsByLastCallNote(["none", "a", "b"], latest, "newest"), ["a", "b", "none"]);
  assert.deepEqual(sortCompanyIdsByLastCallNote(["none", "a", "b"], latest, "oldest"), ["b", "a", "none"]);
});

test("List status filtering distinguishes all four canonical company statuses", () => {
  const statuses = ["Yeni Firma", "Potansiyel Firma", "Sözleşmeli Firma", "Pasif Firma"];
  for (const selected of statuses) {
    assert.deepEqual(
      statuses.filter((status) => matchesCompanyStatusFilter(status, selected)),
      [selected],
    );
  }
  assert.deepEqual(
    statuses.filter((status) => matchesCompanyStatusFilter(status, "all")),
    statuses,
  );
});

test("planned, unplanned, and overdue next-action semantics use real action/date fields", () => {
  const now = new Date("2026-08-23T12:00:00Z");
  const planned = { next_action: "Ara", next_action_date: "2026-08-24T12:00:00Z" };
  const overdue = { next_action: "Ara", next_action_date: "2026-08-22T12:00:00Z" };
  const unplanned = { next_action: null, next_action_date: null };
  assert.equal(matchesNextAction(planned, "planned", now), true);
  assert.equal(matchesNextAction(overdue, "overdue", now), true);
  assert.equal(matchesNextAction(unplanned, "unplanned", now), true);
  assert.equal(matchesNextAction(overdue, "planned", now), false);
});

test("yes/no presence filters support active, contact, and meeting filters", () => {
  assert.equal(matchesPresence(true, "yes"), true);
  assert.equal(matchesPresence(false, "no"), true);
  assert.equal(matchesPresence(true, "no"), false);
});

test("primary and secondary predicates combine as an intersection", () => {
  const records = [
    { country: "Türkiye", active: true, contact: true, meeting: true },
    { country: "Gana", active: true, contact: true, meeting: true },
  ];
  const result = records.filter((item) =>
    item.country === "Türkiye" &&
    matchesPresence(item.active, "yes") &&
    matchesPresence(item.contact, "yes") &&
    matchesPresence(item.meeting, "yes"),
  );
  assert.equal(result.length, 1);
});
