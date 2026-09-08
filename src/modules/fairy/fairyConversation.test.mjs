import assert from "node:assert/strict";
import test from "node:test";

const { boundFairyConversation } = await import(new URL("./fairyConversation.ts", import.meta.url));

function turn(index, userLength = 1, answerLength = 1) {
  return [
    { role: "user", content: String(index).repeat(userLength) },
    { role: "assistant", content: String(index).repeat(answerLength) },
  ];
}

test("Fairy history contains only the latest four complete turns", () => {
  const messages = [1, 2, 3, 4, 5, 6].flatMap((index) => turn(index));
  assert.deepEqual(boundFairyConversation(messages), messages.slice(-8));
});

test("Fairy drops oldest whole pairs to stay within the aggregate character limit", () => {
  const messages = [1, 2, 3, 4].flatMap((index) => turn(index, 2000, 6000));
  const result = boundFairyConversation(messages);
  assert.deepEqual(result, messages.slice(-4));
  assert.equal(result.reduce((sum, message) => sum + message.content.length, 0), 16000);
});

test("Fairy limits individual messages without altering the original conversation", () => {
  const messages = turn(1, 2500, 8000);
  const before = structuredClone(messages);
  const result = boundFairyConversation(messages);
  assert.equal(result[0].content.length, 2000);
  assert.equal(result[1].content.length, 6000);
  assert.deepEqual(messages, before);
});

test("Fairy excludes unanswered, failed and empty turns instead of sending orphan history", () => {
  assert.deepEqual(boundFairyConversation([
    { role: "assistant", content: "initial introduction" },
    { role: "user", content: "failed question" },
    ...turn(1),
    { role: "user", content: " " },
    { role: "assistant", content: "empty question answer" },
    { role: "user", content: "pending question" },
  ]), turn(1));
});

test("Fairy serializes only role and content, with no UI metadata", () => {
  assert.deepEqual(boundFairyConversation([
    { role: "user", content: "  soru  ", id: "private-ui-id" },
    { role: "assistant", content: "  yanıt  ", internal: "unused" },
  ]), [{ role: "user", content: "soru" }, { role: "assistant", content: "yanıt" }]);
});
