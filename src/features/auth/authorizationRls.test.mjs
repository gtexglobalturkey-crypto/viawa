import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const applicationUsersMigrationUrl = new URL(
  "../../../supabase/migrations/20260805120000_create_application_users.sql",
  import.meta.url,
);
const coreTablesMigrationUrl = new URL(
  "../../../supabase/migrations/20260805120100_enable_rls_core_tables.sql",
  import.meta.url,
);

const authorizationPredicate =
  /exists \(select 1 from public\.application_users as application_user where application_user\.id = auth\.uid\(\) and application_user\.is_active\)/gi;

test("core-table policies require an active application user for every operation", async () => {
  const migration = await readFile(coreTablesMigrationUrl, "utf8");

  for (const table of [
    "companies",
    "opportunities",
    "exhibitions",
    "reminders",
    "emails",
    "call_notes",
    "timeline_events",
  ]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }

  assert.equal(migration.match(authorizationPredicate)?.length, 5);
  assert.match(migration, /for select to authenticated using \(exists/i);
  assert.match(migration, /for insert to authenticated with check \(exists/i);
  assert.match(
    migration,
    /for update to authenticated using \(exists[\s\S]*with check \(exists/i,
  );
  assert.match(migration, /for delete to authenticated using \(exists/i);
  assert.doesNotMatch(migration, /authenticated (using|with check) \(true\)/i);
});

test("authorization policies are replay-safe and application users remain self-read-only", async () => {
  const [applicationUsersMigration, coreTablesMigration] = await Promise.all([
    readFile(applicationUsersMigrationUrl, "utf8"),
    readFile(coreTablesMigrationUrl, "utf8"),
  ]);

  assert.match(
    applicationUsersMigration,
    /drop policy if exists application_users_select_self/i,
  );
  assert.match(
    applicationUsersMigration,
    /using \(id = auth\.uid\(\)\)/i,
  );
  assert.match(
    applicationUsersMigration,
    /revoke insert, update, delete on public\.application_users from authenticated/i,
  );
  assert.match(
    applicationUsersMigration,
    /grant select on public\.application_users to authenticated/i,
  );
  assert.equal(coreTablesMigration.match(/drop policy if exists %I/gi)?.length, 4);

  const conflictClause = applicationUsersMigration.split(/on conflict \(id\)/i)[1];
  assert.ok(conflictClause);
  assert.doesNotMatch(conflictClause, /\b(role|is_active)\s*=/i);
});
