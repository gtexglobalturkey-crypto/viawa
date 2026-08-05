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

const {
  createEmptyStandMaterialsFormState,
  standMaterialsFormStateFromRecord,
  toggleStandMaterialSelection,
  updateStandMaterialQuantity,
  parseExtraInformationLines,
} = await import(
  new URL("./standMaterialsFormState.ts", import.meta.url)
);

// Sprint 25.8 — Test scenario 1: nothing selected is a fully valid,
// savable state (every material defaults to unselected, no quantity).
test("createEmptyStandMaterialsFormState: every material starts unselected with no quantity", () => {
  const state = createEmptyStandMaterialsFormState();
  const keys = Object.keys(state);

  assert.equal(keys.length, 12);
  for (const key of keys) {
    assert.equal(state[key].selected, false);
    assert.equal(state[key].quantity, null);
  }
});

// Sprint 25.8 — Test scenario 2: selecting a material defaults its
// quantity to 1.
test("toggleStandMaterialSelection: first-time selection defaults quantity to 1", () => {
  const state = createEmptyStandMaterialsFormState();
  const next = toggleStandMaterialSelection(state, "Table");

  assert.equal(next.Table.selected, true);
  assert.equal(next.Table.quantity, 1);
});

// Sprint 25.8 — Test scenario 3 (persistence round-trip is exercised at
// the calling layer): here, confirms the quantity a user enters is what
// actually lands in the form state, and that state round-trips through
// standMaterialsFormStateFromRecord exactly as a reopen would replay it.
test("updateStandMaterialQuantity then round-tripping through a saved record preserves the value", () => {
  let state = createEmptyStandMaterialsFormState();
  state = toggleStandMaterialSelection(state, "Table");
  state = updateStandMaterialQuantity(state, "Table", "3");

  assert.equal(state.Table.quantity, 3);

  const reopened = standMaterialsFormStateFromRecord(state);
  assert.equal(reopened.Table.selected, true);
  assert.equal(reopened.Table.quantity, 3);
});

// Sprint 25.8 — Test scenario 4: multiple materials can be selected
// independently.
test("multiple materials can be selected independently", () => {
  let state = createEmptyStandMaterialsFormState();
  state = toggleStandMaterialSelection(state, "Table");
  state = toggleStandMaterialSelection(state, "Chair");
  state = toggleStandMaterialSelection(state, "Shelf");

  assert.equal(state.Table.selected, true);
  assert.equal(state.Chair.selected, true);
  assert.equal(state.Shelf.selected, true);
  assert.equal(state.HangingRail.selected, false);
});

// Sprint 25.8 — Test scenario 5: unchecking a material marks it
// unselected (the mapping already treats selected=false as "not
// checked" in the PDF — see participationContractMapping.ts).
test("toggleStandMaterialSelection: unchecking marks the material unselected", () => {
  let state = createEmptyStandMaterialsFormState();
  state = toggleStandMaterialSelection(state, "Table");
  assert.equal(state.Table.selected, true);

  state = toggleStandMaterialSelection(state, "Table");
  assert.equal(state.Table.selected, false);
});

// Behavior rule 6: a previously entered quantity survives an uncheck/
// recheck cycle instead of resetting to 1 or being lost.
test("unchecking then rechecking a material preserves its previously entered quantity", () => {
  let state = createEmptyStandMaterialsFormState();
  state = toggleStandMaterialSelection(state, "Table");
  state = updateStandMaterialQuantity(state, "Table", "5");
  assert.equal(state.Table.quantity, 5);

  state = toggleStandMaterialSelection(state, "Table");
  assert.equal(state.Table.selected, false);
  assert.equal(
    state.Table.quantity,
    5,
    "quantity must be preserved while unchecked",
  );

  state = toggleStandMaterialSelection(state, "Table");
  assert.equal(state.Table.selected, true);
  assert.equal(
    state.Table.quantity,
    5,
    "re-checking must restore the preserved quantity, not reset to 1",
  );
});

// Behavior rule 4: quantity only ever accepts a positive integer.
test("updateStandMaterialQuantity: rejects zero, negative, decimal and non-numeric input", () => {
  let state = createEmptyStandMaterialsFormState();
  state = toggleStandMaterialSelection(state, "Table");
  state = updateStandMaterialQuantity(state, "Table", "4");

  for (const invalid of ["0", "-1", "2.5", "abc", "  "]) {
    const attempted = updateStandMaterialQuantity(
      state,
      "Table",
      invalid,
    );
    assert.equal(
      attempted.Table.quantity,
      invalid.trim() === "" ? null : 4,
      `input ${JSON.stringify(invalid)} should not commit an invalid quantity`,
    );
  }
});

test("updateStandMaterialQuantity: an empty string clears the quantity", () => {
  let state = createEmptyStandMaterialsFormState();
  state = toggleStandMaterialSelection(state, "Table");
  state = updateStandMaterialQuantity(state, "Table", "");

  assert.equal(state.Table.quantity, null);
});

// Sprint 25.8 — Test scenario 7: reopening the form must reproduce
// exactly what was saved, including materials that were never touched
// (still default to unselected/no quantity) and null/undefined records
// (a brand-new opportunity).
test("standMaterialsFormStateFromRecord: reloads a saved selection exactly, and defaults safely for null/undefined", () => {
  const saved = {
    Table: { selected: true, quantity: 2 },
    Chair: { selected: false, quantity: 4 },
  };

  const reloaded = standMaterialsFormStateFromRecord(saved);
  assert.equal(reloaded.Table.selected, true);
  assert.equal(reloaded.Table.quantity, 2);
  assert.equal(reloaded.Chair.selected, false);
  assert.equal(
    reloaded.Chair.quantity,
    4,
    "an unselected material's previously entered quantity is still preserved on reload",
  );
  assert.equal(reloaded.Shelf.selected, false);
  assert.equal(reloaded.Shelf.quantity, null);

  assert.deepEqual(
    standMaterialsFormStateFromRecord(null),
    createEmptyStandMaterialsFormState(),
  );
  assert.deepEqual(
    standMaterialsFormStateFromRecord(undefined),
    createEmptyStandMaterialsFormState(),
  );
});

// Sprint 25.8 — Test scenario 7/8: the extra-information textarea is
// stored as up to 3 trimmed, non-empty lines; a blank/whitespace-only
// note produces an empty array (never a stray blank-string line that
// could render as an empty placeholder paragraph in the PDF).
test("parseExtraInformationLines: trims, drops blank lines, and caps at 3", () => {
  assert.deepEqual(
    parseExtraInformationLines(
      "  Ekstra masa lazım  \n\nİkinci not\n",
    ),
    ["Ekstra masa lazım", "İkinci not"],
  );

  assert.deepEqual(
    parseExtraInformationLines("Bir\nİki\nÜç\nDört"),
    ["Bir", "İki", "Üç"],
  );
});

test("parseExtraInformationLines: empty or whitespace-only input produces an empty array, never a blank line", () => {
  assert.deepEqual(parseExtraInformationLines(""), []);
  assert.deepEqual(parseExtraInformationLines("   \n  \n"), []);
});
