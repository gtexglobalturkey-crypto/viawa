import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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

const { resolveExhibitionRoot } = await import(
  new URL("./resolveExhibitionRoot.ts", import.meta.url)
);

// Sprint 25.10 — these are the real, currently-committed UAT test-data
// folders (resources/templates/test-data/exhibitions/). This test
// exercises the real filesystem deliberately, not a fixture — its whole
// point is to catch exactly the kind of drift that broke this resolver
// before (a folder rename left a stale hardcoded reference behind).

test("resolveExhibitionRoot: 'Mining Türkiye 2027' matches the real 'Mining Türkiye 2027' folder", () => {
  const result = resolveExhibitionRoot(
    "Mining Türkiye 2027",
    null,
  );
  assert.ok(result, "expected a match, got null");
  assert.equal(result.folderName, "Mining Türkiye 2027");
});

test("resolveExhibitionRoot: 'WAMPEX 2027' matches the real 'WAMPEX 2027' folder", () => {
  const result = resolveExhibitionRoot("WAMPEX 2027", null);
  assert.ok(result, "expected a match, got null");
  assert.equal(result.folderName, "WAMPEX 2027");
});

test("resolveExhibitionRoot: matching is trim/case/diacritic-insensitive and never crosses to the other exhibition's folder", () => {
  const mining = resolveExhibitionRoot(
    "  mining TÜRKİYE 2027  ",
    null,
  );
  assert.equal(mining?.folderName, "Mining Türkiye 2027");

  const wampex = resolveExhibitionRoot(
    "  wampex 2027  ",
    null,
  );
  assert.equal(wampex?.folderName, "WAMPEX 2027");

  assert.notEqual(
    mining.folderName,
    wampex.folderName,
    "the two exhibitions must never resolve to the same folder",
  );
});

// A name whose year has drifted out of sync with the on-disk folder
// (the exact real-world situation for the Supabase "Mining Türkiye
// 2026" exhibitions-table row, whose actual dates are in 2027) still
// resolves correctly — trailing years are deliberately not part of the
// matched identity (templates are reused year over year).
test("resolveExhibitionRoot: a mismatched trailing year still matches the same template folder", () => {
  const result = resolveExhibitionRoot(
    "Mining Türkiye 2026",
    null,
  );
  assert.equal(result?.folderName, "Mining Türkiye 2027");
});

// The short name (Kısa Adı) fallback is tried when the full free-text
// name shares nothing with any on-disk folder.
test("resolveExhibitionRoot: falls back to the short name when the full name matches nothing", () => {
  const result = resolveExhibitionRoot(
    "west african fair",
    "WAMPEX",
  );
  assert.equal(result?.folderName, "WAMPEX 2027");
});

test("resolveExhibitionRoot: an exhibition name matching no folder at all (and no usable short name) returns null, never a wrong folder", () => {
  const result = resolveExhibitionRoot(
    "west african fair",
    null,
  );
  assert.equal(result, null);
});

// Sprint 25.10 — previously hardcoded a specific folder name
// ("01_mining_show_2025") that went stale the moment the on-disk
// folders were renamed, silently returning null forever after. This
// must always resolve to *some* real, currently-existing folder.
test("resolveExhibitionRoot: the no-exhibition-specified default resolves to a real, currently-existing folder", () => {
  const result = resolveExhibitionRoot(null, null);
  assert.ok(
    result,
    "the default fallback must not be null when exhibition folders exist on disk",
  );

  assert.ok(
    existsSync(result.absolutePath),
    `default-resolved folder must actually exist: ${result.absolutePath}`,
  );
});
