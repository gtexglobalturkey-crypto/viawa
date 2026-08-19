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

const { describeSignInError } = await import(
  new URL("./describeSignInError.ts", import.meta.url)
);

test("invalid credentials: exact Turkish sentence, not the raw Supabase text", () => {
  assert.equal(
    describeSignInError({ message: "Invalid login credentials" }),
    "E-posta veya şifre hatalı.",
  );
});

test("matching is case-insensitive", () => {
  assert.equal(
    describeSignInError({ message: "INVALID LOGIN CREDENTIALS" }),
    "E-posta veya şifre hatalı.",
  );
});

test("email not confirmed", () => {
  assert.equal(
    describeSignInError({ message: "Email not confirmed" }),
    "E-posta adresiniz henüz doğrulanmamış.",
  );
});

test("a 403 status is treated as a disabled account regardless of message text", () => {
  assert.equal(
    describeSignInError({
      message: "User is banned",
      status: 403,
    }),
    "Hesabınız devre dışı bırakılmış.",
  );
});

test("message text alone (banned/disabled) is also recognized without a 403 status", () => {
  assert.equal(
    describeSignInError({ message: "This account has been disabled" }),
    "Hesabınız devre dışı bırakılmış.",
  );
});

test("an unrecognized error never leaks the raw Supabase message to the user", () => {
  const result = describeSignInError({
    message: "some internal Supabase implementation detail",
  });

  assert.equal(result, "Giriş yapılamadı. Lütfen tekrar deneyin.");
  assert.ok(!result.includes("Supabase"));
});
