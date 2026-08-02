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
  EMPTY_EXHIBITION_SESSION_DRAFT,
  NO_EXHIBITION_SESSION_KEY,
  getSessionDraft,
  migrateNoExhibitionDraft,
  sessionKeyFor,
  withSessionDraft,
  withSessionDraftCleared,
} = await import(
  new URL("./exhibitionSessionDraft.ts", import.meta.url)
);

function priceDraft(value) {
  return {
    result: { grandTotal: value },
    meta: { exhibitionId: "ex-1" },
  };
}

test("sessionKeyFor: a real exhibition id is its own key; null falls back to the sentinel", () => {
  assert.equal(sessionKeyFor("ex-1"), "ex-1");
  assert.equal(sessionKeyFor(null), NO_EXHIBITION_SESSION_KEY);
});

test("getSessionDraft: an untouched fuar (or no fuar at all) returns the empty draft", () => {
  assert.deepEqual(
    getSessionDraft({}, "ex-1"),
    EMPTY_EXHIBITION_SESSION_DRAFT,
  );
  assert.deepEqual(
    getSessionDraft({}, null),
    EMPTY_EXHIBITION_SESSION_DRAFT,
  );
});

test("withSessionDraft: patches only the targeted fuar's session", () => {
  let store = withSessionDraft({}, "ex-1", { note: "ex-1 note" });
  store = withSessionDraft(store, "ex-2", { note: "ex-2 note" });

  assert.equal(getSessionDraft(store, "ex-1").note, "ex-1 note");
  assert.equal(getSessionDraft(store, "ex-2").note, "ex-2 note");
});

test("withSessionDraft: switching fuar back and forth never blends the two drafts (Sprint 25.3 Section 6/7)", () => {
  let store = withSessionDraft({}, "ex-1", { note: "for ex-1" });
  store = withSessionDraft(store, "ex-2", { note: "for ex-2" });
  store = withSessionDraft(store, "ex-1", { note: "for ex-1, edited" });

  assert.equal(getSessionDraft(store, "ex-1").note, "for ex-1, edited");
  assert.equal(getSessionDraft(store, "ex-2").note, "for ex-2");
});

test("withSessionDraft: a patch merges onto the existing draft rather than replacing it", () => {
  let store = withSessionDraft({}, "ex-1", { note: "hello" });
  store = withSessionDraft(store, "ex-1", {
    priceResult: priceDraft(100),
  });

  const draft = getSessionDraft(store, "ex-1");
  assert.equal(draft.note, "hello");
  assert.equal(draft.priceResult.result.grandTotal, 100);
});

test("withSessionDraft: the no-fuar session is keyed independently from any real fuar", () => {
  let store = withSessionDraft({}, null, { note: "general note" });
  store = withSessionDraft(store, "ex-1", { note: "ex-1 note" });

  assert.equal(getSessionDraft(store, null).note, "general note");
  assert.equal(getSessionDraft(store, "ex-1").note, "ex-1 note");
});

test("withSessionDraftCleared: removes only the targeted fuar's session, leaving every other fuar untouched", () => {
  let store = withSessionDraft({}, "ex-1", { note: "ex-1 note" });
  store = withSessionDraft(store, "ex-2", { note: "ex-2 note" });

  const cleared = withSessionDraftCleared(store, "ex-1");

  assert.deepEqual(
    getSessionDraft(cleared, "ex-1"),
    EMPTY_EXHIBITION_SESSION_DRAFT,
  );
  assert.equal(getSessionDraft(cleared, "ex-2").note, "ex-2 note");
});

test("withSessionDraftCleared: a no-op commit target (never touched) leaves the store as-is", () => {
  const store = withSessionDraft({}, "ex-1", { note: "ex-1 note" });
  const cleared = withSessionDraftCleared(store, "ex-2");

  assert.deepEqual(cleared, store);
});

test("migrateNoExhibitionDraft: a general note written before any fuar was selected carries into the first fuar picked afterward", () => {
  let store = withSessionDraft({}, null, { note: "general note" });
  store = migrateNoExhibitionDraft(store, "ex-1");

  assert.equal(getSessionDraft(store, "ex-1").note, "general note");
  assert.deepEqual(
    getSessionDraft(store, null),
    EMPTY_EXHIBITION_SESSION_DRAFT,
  );
});

test("migrateNoExhibitionDraft: never overwrites a fuar that already has its own session", () => {
  let store = withSessionDraft({}, null, { note: "general note" });
  store = withSessionDraft(store, "ex-1", { note: "ex-1's own note" });
  store = migrateNoExhibitionDraft(store, "ex-1");

  assert.equal(getSessionDraft(store, "ex-1").note, "ex-1's own note");
  // The no-fuar draft is left in place too, since nothing was migrated.
  assert.equal(getSessionDraft(store, null).note, "general note");
});

test("migrateNoExhibitionDraft: an empty no-fuar session migrates nothing", () => {
  const result = migrateNoExhibitionDraft({}, "ex-1");

  assert.deepEqual(result, {});
});

test("migrateNoExhibitionDraft: moving back to no-fuar (null target) is a no-op", () => {
  const store = withSessionDraft({}, null, { note: "general note" });
  const result = migrateNoExhibitionDraft(store, null);

  assert.deepEqual(result, store);
});
