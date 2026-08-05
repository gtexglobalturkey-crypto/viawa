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

// Kritik Akış Düzeltmesi 2 — a fuar with more than one opportunity
// (one closed, one still open) must resolve to whichever one was
// explicitly requested by id, never to a sibling picked by the
// active-first/most-recent guess.

test("explicit opportunity id wins over the active-first guess: an explicitly requested CLOSED opportunity is returned even though an active sibling exists for the same fuar", () => {
  const opportunities = [
    opportunity("closed", "lost", "ex-1"),
    opportunity("active", "contacted", "ex-1"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
    "closed",
  );
  assert.equal(result.id, "closed");
});

test("explicit opportunity id wins over the active-first guess: an explicitly requested ACTIVE opportunity is returned even though a closed sibling exists for the same fuar (the reported bug)", () => {
  const opportunities = [
    opportunity("closed", "lost", "ex-1"),
    opportunity("active", "contacted", "ex-1"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
    "active",
  );
  assert.equal(result.id, "active");
});

test("explicit opportunity id from a different (stale) exhibition selection is ignored: falls back to the normal fuar match", () => {
  const opportunities = [
    opportunity("other-fuar", "contacted", "ex-2"),
    opportunity("active", "contacted", "ex-1"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
    "other-fuar",
  );
  assert.equal(result.id, "active");
});

test("explicit opportunity id that no longer exists is ignored: falls back to the normal fuar match", () => {
  const opportunities = [
    opportunity("active", "contacted", "ex-1"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
    "deleted-id",
  );
  assert.equal(result.id, "active");
});

test("no explicit opportunity id (undefined): unchanged active-first behavior", () => {
  const opportunities = [
    opportunity("closed", "lost", "ex-1"),
    opportunity("active", "contacted", "ex-1"),
  ];
  const result = selectOpportunityForExhibition(
    opportunities,
    "ex-1",
  );
  assert.equal(result.id, "active");
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

// RC-05 — sessionOpportunityId set earlier in the session (e.g. by
// ensureActiveOpportunity) can outlive the record it points to becoming
// terminal (Katılım Onaylandı -> stage="signed") without the sidebar
// fuar ever changing (the only thing that clears this id). It must not
// keep being treated as the usable-for-actions opportunity once
// terminal — same rule this function already applies to every other
// path.
test("resolveSessionOpportunity: sessionOpportunityId pointing to a now-terminal (signed) record is never returned as actionable", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("just-signed", "signed", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: "just-signed",
  });
  assert.equal(result, null);
});

test("resolveSessionOpportunity: sessionOpportunityId pointing to a now-terminal record falls back to an active sibling for the same fuar", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("just-signed", "signed", "ex-1"),
      opportunity("active", "new", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: "just-signed",
  });
  assert.equal(result.id, "active");
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

// Kritik Akış Düzeltmesi 2 — explicitOpportunityId (URL-requested record).

test("resolveSessionOpportunity: an explicitly requested ACTIVE opportunity is usable for actions, even with a closed sibling for the same fuar", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("closed", "lost", "ex-1"),
      opportunity("active", "contacted", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: null,
    explicitOpportunityId: "active",
  });
  assert.equal(result.id, "active");
});

test("resolveSessionOpportunity: an explicitly requested CLOSED opportunity is still never usable for actions -> null, not reactivated", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("closed", "lost", "ex-1"),
      opportunity("active", "contacted", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: null,
    explicitOpportunityId: "closed",
  });
  assert.equal(result, null);
});

test("resolveSessionOpportunity: sessionOpportunityId still takes priority over explicitOpportunityId", () => {
  const result = resolveSessionOpportunity({
    opportunities: [
      opportunity("just-created", "new", "ex-1"),
      opportunity("requested", "contacted", "ex-1"),
    ],
    selectedExhibitionId: "ex-1",
    sessionOpportunityId: "just-created",
    explicitOpportunityId: "requested",
  });
  assert.equal(result.id, "just-created");
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
