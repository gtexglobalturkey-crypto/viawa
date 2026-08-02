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

const { resolveDropboxSignTestMode } = await import(
  new URL("./testModeResolution.ts", import.meta.url)
);

// SPRINT 26.2.2 — Test 1: test mode env true -> test_mode "1" (i.e. this
// resolver returns true).
test("resolveDropboxSignTestMode: \"true\" -> test mode", () => {
  assert.equal(resolveDropboxSignTestMode("true"), true);
});

// SPRINT 26.2.2 — Test 2: production env false -> test mode disabled.
test("resolveDropboxSignTestMode: \"false\" -> production (not test mode)", () => {
  assert.equal(resolveDropboxSignTestMode("false"), false);
});

test("resolveDropboxSignTestMode: undefined (unset secret) -> stays test mode (fail-safe)", () => {
  assert.equal(resolveDropboxSignTestMode(undefined), true);
});

test("resolveDropboxSignTestMode: empty string -> stays test mode (fail-safe)", () => {
  assert.equal(resolveDropboxSignTestMode(""), true);
});

test("resolveDropboxSignTestMode: a typo/garbage value never silently disables test mode", () => {
  assert.equal(resolveDropboxSignTestMode("flase"), true);
  assert.equal(resolveDropboxSignTestMode("0"), true);
  assert.equal(resolveDropboxSignTestMode("FALSE "), false);
});

test("resolveDropboxSignTestMode: trims and lowercases before comparing", () => {
  assert.equal(resolveDropboxSignTestMode("  False  "), false);
  assert.equal(resolveDropboxSignTestMode("TRUE"), true);
});
