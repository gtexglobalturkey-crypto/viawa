import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach } from "node:test";

const client = { auth: {}, functions: {} };
globalThis.__fairyTestClient = client;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./client" && context.parentURL?.endsWith("/fairyService.ts")) {
      return { url: "data:text/javascript,export const supabase = globalThis.__fairyTestClient;", shortCircuit: true };
    }
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { askFairy, FairyServiceError } = await import(new URL("./fairyService.ts", import.meta.url));
delete globalThis.__fairyTestClient;

let calls;
beforeEach(() => {
  calls = [];
  client.auth.getSession = async () => ({ data: { session: { user: { id: "user-1" }, access_token: "mock-session-token" } }, error: null });
  client.functions.invoke = async (...args) => {
    calls.push(args);
    return { data: { answer: "Kayıtlara göre yanıt." }, error: null };
  };
});

test("Fairy invokes only its function with the authenticated session and bounded content", async () => {
  const signal = new AbortController().signal;
  const conversation = Array.from({ length: 6 }, (_, index) => [
    { role: "user", content: `Soru ${index}` },
    { role: "assistant", content: `Yanıt ${index}` },
  ]).flat();
  assert.equal(await askFairy({ message: "  Ne bekliyor?  ", conversation }, { userId: "user-1", signal }), "Kayıtlara göre yanıt.");
  assert.equal(calls.length, 1);
  const [name, options] = calls[0];
  assert.equal(name, "fairy");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, "Bearer mock-session-token");
  assert.deepEqual(options.body, { message: "Ne bekliyor?", conversation: conversation.slice(-8) });
  assert.equal(options.signal, signal);
  assert.equal(options.timeout, 65000);
  assert.doesNotMatch(JSON.stringify(options.body), /mock-session-token|user-1/);
});

test("Fairy rejects empty and oversized questions before any invocation", async () => {
  for (const message of ["  ", "a".repeat(2001)]) {
    await assert.rejects(askFairy({ message }, { userId: "user-1" }), FairyServiceError);
  }
  assert.equal(calls.length, 0);
});

test("Fairy does not invoke anonymously or send a previous user's conversation in a new session", async () => {
  for (const session of [null, { user: { id: "user-2" }, access_token: "new-session-token" }]) {
    client.auth.getSession = async () => ({ data: { session }, error: null });
    await assert.rejects(askFairy({ message: "Soru" }, { userId: "user-1" }), /Oturumunuz doğrulanamadı/);
  }
  assert.equal(calls.length, 0);
});

test("Fairy does not invoke if the owning page has already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(askFairy({ message: "Soru" }, { userId: "user-1", signal: controller.signal }), FairyServiceError);
  assert.equal(calls.length, 0);
});

test("Fairy maps structured function errors without displaying raw server text", async () => {
  client.functions.invoke = async () => ({ data: null, error: { context: new Response(JSON.stringify({ code: "FAIRY_NOT_CONFIGURED", error: "secret-internal-detail" }), { status: 503 }) } });
  await assert.rejects(askFairy({ message: "Soru" }, { userId: "user-1" }), { message: "Fairy henüz kullanıma hazır değil." });
});

test("Fairy handles non-JSON auth and gateway failures safely", async () => {
  client.functions.invoke = async () => ({ data: null, error: { context: new Response("internal-gateway-detail", { status: 401 }) } });
  await assert.rejects(askFairy({ message: "Soru" }, { userId: "user-1" }), /Oturumunuz doğrulanamadı/);
  client.functions.invoke = async () => { throw new Error("internal-network-detail"); };
  await assert.rejects(askFairy({ message: "Soru" }, { userId: "user-1" }), { message: "Fairy yanıtı alınamadı. Lütfen tekrar deneyin." });
});

test("Fairy rejects missing, empty, oversized and error-shaped success responses", async () => {
  for (const data of [null, {}, { answer: " " }, { answer: "x".repeat(6001) }, { code: "AI_INCOMPLETE", error: "internal-provider-detail" }]) {
    client.functions.invoke = async () => ({ data, error: null });
    await assert.rejects(askFairy({ message: "Soru" }, { userId: "user-1" }), { message: "Fairy yanıtı tamamlayamadı. Lütfen tekrar deneyin." });
  }
});

test("Fairy keeps unknown server codes on the fixed generic error message", async () => {
  for (const code of ["UNKNOWN_ERROR", "__proto__", "constructor"]) {
    client.functions.invoke = async () => ({ data: { code, error: "secret-internal-detail" }, error: null });
    await assert.rejects(askFairy({ message: "Soru" }, { userId: "user-1" }), { message: "Fairy yanıtı alınamadı. Lütfen tekrar deneyin." });
  }
});
