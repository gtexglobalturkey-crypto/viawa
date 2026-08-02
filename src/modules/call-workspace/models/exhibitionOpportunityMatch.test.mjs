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
  selectOpportunityForExhibition,
  resolveSessionOpportunity,
  decideOpportunityCommitAction,
} = await import(
  new URL("./exhibitionOpportunityMatch.ts", import.meta.url)
);

function opportunity(id, stage, exhibitionId) {
  return { id, stage, exhibition_id: exhibitionId };
}

test("no exhibition selected: no opportunity, regardless of what exists", () => {
  const opportunities = [opportunity("a", "new", "ex-1")];
  assert.equal(
    selectOpportunityForExhibition(opportunities, null),
    null,
  );
});

test("no opportunities exist for the selected exhibition: null (workspace still opens)", () => {
  const opportunities = [opportunity("a", "new", "ex-1")];
  assert.equal(
    selectOpportunityForExhibition(opportunities, "ex-2"),
    null,
  );
});

test("a company with no opportunities at all: null for any exhibition", () => {
  assert.equal(
    selectOpportunityForExhibition([], "ex-1"),
    null,
  );
});

test("exactly one active opportunity for the selected exhibition: matched", () => {
  const opportunities = [
    opportunity("a", "new", "ex-1"),
    opportunity("b", "contacted", "ex-2"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
  );
  assert.equal(result.id, "a");
});

test("signed/lost opportunities for the selected exhibition are not preferred over an active one", () => {
  const opportunities = [
    opportunity("terminal", "signed", "ex-1"),
    opportunity("active", "contacted", "ex-1"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
  );
  assert.equal(result.id, "active");
});

test("only a terminal opportunity exists for the exhibition: it is still shown (fallback), not null", () => {
  const opportunities = [
    opportunity("terminal", "lost", "ex-1"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
  );
  assert.equal(result.id, "terminal");
});

test("switching the selected exhibition re-derives independently (no leftover state)", () => {
  const opportunities = [
    opportunity("a", "new", "ex-1"),
    opportunity("b", "contacted", "ex-2"),
  ];
  assert.equal(
    selectOpportunityForExhibition(opportunities, "ex-1").id,
    "a",
  );
  assert.equal(
    selectOpportunityForExhibition(opportunities, "ex-2").id,
    "b",
  );
  assert.equal(
    selectOpportunityForExhibition(opportunities, "ex-3"),
    null,
  );
});

// Sprint 25.2 — resolveSessionOpportunity: the workspace's real,
// usable-for-actions opportunity (as opposed to
// selectOpportunityForExhibition's informational-only terminal fallback).

test("resolveSessionOpportunity: no opportunity exists for the fuar -> null (workspace still opens, draft mode)", () => {
  const result = resolveSessionOpportunity({
    opportunities: [opportunity("a", "new", "ex-2")],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: null,
  });
  assert.equal(result, null);
});

test("resolveSessionOpportunity: an active match for the fuar is returned", () => {
  const result = resolveSessionOpportunity({
    opportunities: [opportunity("a", "contacted", "ex-1")],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: null,
  });
  assert.equal(result.id, "a");
});

test("resolveSessionOpportunity: only a terminal match for the fuar -> null, never silently reactivated", () => {
  const result = resolveSessionOpportunity({
    opportunities: [opportunity("terminal", "signed", "ex-1")],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: null,
  });
  assert.equal(result, null);
});

test("resolveSessionOpportunity: a terminal match alongside an active one for the same fuar still returns the active one", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("terminal", "lost", "ex-1"),
      opportunity("active", "new", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: null,
  });
  assert.equal(result.id, "active");
});

test("resolveSessionOpportunity: sessionOpportunityId is reused immediately, before the opportunities prop would otherwise show it", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("just-created", "new", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: "just-created",
  });
  assert.equal(result.id, "just-created");
});

test("resolveSessionOpportunity: a stale sessionOpportunityId no longer present falls back to the normal fuar match", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("current", "contacted", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: "no-longer-exists",
  });
  assert.equal(result.id, "current");
});

test("resolveSessionOpportunity: no fuar selected -> null regardless of sessionOpportunityId", () => {
  const result = resolveSessionOpportunity({
    opportunities: [opportunity("a", "new", "ex-1")],
    selectedExhibitionId: null,
    sessionOpportunityId: null,
  });
  assert.equal(result, null);
});

// Sprint 25.3 — decideOpportunityCommitAction: the single rule for how
// the Commit Engine (the sole "Görüşmeyi Tamamla" caller) may touch an
// opportunity. There is no "defer" outcome anymore — every other
// workspace action never reaches this function at all (it only ever
// touches the Exhibition Session draft), so this always runs in
// "completing" mode.

test("decideOpportunityCommitAction: an existing opportunity is always reused, never duplicated", () => {
  assert.equal(
    decideOpportunityCommitAction({
      hasSelectedOpportunity: true,
      hasSelectedExhibition: true,
    }),
    "reuse",
  );
  assert.equal(
    decideOpportunityCommitAction({
      hasSelectedOpportunity: true,
      hasSelectedExhibition: false,
    }),
    "reuse",
  );
});

test("decideOpportunityCommitAction: no existing opportunity but a fuar selected -> create", () => {
  assert.equal(
    decideOpportunityCommitAction({
      hasSelectedOpportunity: false,
      hasSelectedExhibition: true,
    }),
    "create",
  );
});

test("decideOpportunityCommitAction: no existing opportunity and no fuar at all -> blocked, never creates", () => {
  assert.equal(
    decideOpportunityCommitAction({
      hasSelectedOpportunity: false,
      hasSelectedExhibition: false,
    }),
    "blocked-no-exhibition",
  );
});
