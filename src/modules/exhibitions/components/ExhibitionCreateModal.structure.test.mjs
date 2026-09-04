import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modal = await readFile(
  new URL("./ExhibitionCreateModal.tsx", import.meta.url),
  "utf8",
);
const sidebar = await readFile(
  new URL("./ExhibitionSidebarSection.tsx", import.meta.url),
  "utf8",
);

test("exhibition creation uses one native form submission path", () => {
  assert.match(modal, /<form onSubmit=\{handleSubmit\} noValidate>/);
  assert.match(modal, /type="submit"/);
  assert.doesNotMatch(modal, /onClick=\{\(\) =>\s*void handleSubmit/);
  assert.match(modal, /event\.preventDefault\(\)/);
  assert.match(modal, /isSubmittingRef\.current/);
});

test("failed submissions stay visible and preserve the entered values", () => {
  assert.match(modal, /if \(created\) \{\s*onClose\(\);\s*\} else \{/);
  assert.match(modal, /setSubmissionError\(/);
  assert.match(modal, /submissionError && \(/);
});

test("saving blocks every modal dismissal path", () => {
  assert.match(modal, /event\.key === "Escape" && !isSaving/);
  assert.match(modal, /event\.target ===\s*event\.currentTarget[\s\S]*if \(!isSaving\)/);
  assert.ok(
    [...modal.matchAll(/disabled=\{isSaving\}/g)].length >= 3,
    "close, cancel, and submit buttons must be disabled while saving",
  );
});

test("date order is validated and successful creation selects the exhibition", () => {
  assert.match(modal, /endDate < startDate/);
  assert.match(modal, /errors\.endDate/);
  assert.match(sidebar, /onSelectExhibition\(\s*supabaseExhibition\.id/);
  assert.match(sidebar, /setIsExpanded\(true\)/);
});
