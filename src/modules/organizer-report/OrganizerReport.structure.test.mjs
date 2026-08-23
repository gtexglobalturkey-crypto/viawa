import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("./OrganizerReportPage.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("./services/organizerReportService.ts", import.meta.url), "utf8");
const router = await readFile(new URL("../../core/router/AppRouter.tsx", import.meta.url), "utf8");
const edge = await readFile(new URL("../../../supabase/functions/organizer-report/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../../../supabase/migrations/20260823090000_create_organizer_report_snapshots.sql", import.meta.url), "utf8");

test("route is exhibition scoped and report renders persisted snapshot fields", () => {
  assert.match(router, /\/exhibitions\/:id\/organizer-report/);
  assert.match(page, /report\.snapshot\.pipelineCounts/);
  assert.match(page, /report\.snapshot\.potentialSqm/);
  assert.match(page, /report\.snapshot\.companies/);
  assert.match(page, /window\.print\(\)/);
});

test("browser sends only scope and period while server computes authoritative values", () => {
  assert.match(service, /body: \{ exhibitionId, \.\.\.period \}/);
  assert.doesNotMatch(service, /pipelineCounts|potentialSqm|companies:/);
  assert.match(edge, /buildOrganizerReportSnapshot/);
  assert.match(edge, /crypto\.randomUUID/);
  assert.match(edge, /application_users/);
});

test("snapshot table is immutable and browser cannot insert, update, or delete", () => {
  assert.match(migration, /before update or delete/i);
  assert.match(migration, /revoke all .* authenticated/i);
  assert.doesNotMatch(migration, /for insert\s+to authenticated/i);
  assert.match(migration, /report_id text not null unique/i);
});

test("snapshot reads use direct active membership without unresolved auth helpers", () => {
  assert.doesNotMatch(migration, /is_active_application_(?:user|admin)/i);
  assert.match(
    migration,
    /exists\s*\(\s*select 1\s*from public\.application_users as application_user\s*where application_user\.id = auth\.uid\(\)\s*and application_user\.is_active\s*\)/i,
  );
  assert.match(migration, /for select\s+to authenticated/i);
});

test("migration scope is limited to Organizer Report objects", () => {
  const changedPublicObjects = [...migration.matchAll(/(?:table|function|trigger|policy|index)\s+(?:if not exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)]
    .map((match) => match[1])
    .filter((name) => !["exists", "if", "language", "on"].includes(name));
  assert.ok(changedPublicObjects.length > 0);
  assert.equal(
    changedPublicObjects.every((name) => name.includes("organizer_report")),
    true,
  );
});

test("report markup contains no private CRM fields", () => {
  for (const forbidden of ["contact_person", "phone", "opportunity_id", "created_by", "call_notes"]) {
    assert.equal(page.includes(forbidden), false);
  }
});
