import assert from "node:assert/strict";
import test from "node:test";

const { getRecoveryUrlState, validateNewPassword } = await import("./recoveryUrl.ts");

test("normal login URL is not a recovery callback", () => {
  assert.equal(getRecoveryUrlState("https://viawa.example/"), "none");
});

test("implicit recovery callback is detected", () => {
  assert.equal(getRecoveryUrlState("https://viawa.example/reset-password#access_token=secret&type=recovery"), "callback");
});

test("PKCE code is not mixed into this client's implicit flow", () => {
  assert.equal(getRecoveryUrlState("https://viawa.example/reset-password?code=opaque"), "none");
});

test("invalid callback error is detected without exposing its value", () => {
  assert.equal(getRecoveryUrlState("https://viawa.example/reset-password?error=access_denied"), "error");
});

test("password confirmation and minimum length are validated", () => {
  assert.match(validateNewPassword("short", "short"), /8/);
  assert.match(validateNewPassword("long-enough", "different"), /eşleşmiyor/);
  assert.equal(validateNewPassword("long-enough", "long-enough"), null);
});
