import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baseline = await readFile(
  new URL("../../../supabase/migrations/20260723000000_create_viawa_schema_baseline.sql", import.meta.url),
  "utf8",
);
const applicationUsers = await readFile(
  new URL("../../../supabase/migrations/20260805120000_create_application_users.sql", import.meta.url),
  "utf8",
);

test("baseline creates every pre-history VIAWA relation without application data", () => {
  for (const relation of [
    "companies", "contacts", "exhibitions", "opportunities", "reminders",
    "emails", "call_notes", "timeline_events", "ai_memory", "ai_memories", "tasks",
  ]) {
    assert.match(baseline, new RegExp(`create table public\\.${relation}\\s*\\(`, "i"));
  }
  assert.doesNotMatch(baseline, /\b(insert into|copy\s+public\.|delete from|update\s+public\.)\b/i);
  assert.doesNotMatch(baseline, /generated_documents|contract_numbers|application_users/i);
});

test("schema migrations do not seed environment-specific application identities", () => {
  assert.doesNotMatch(applicationUsers, /insert into public\.application_users/i);
  assert.doesNotMatch(applicationUsers, /@[a-z0-9.-]+/i);
});
