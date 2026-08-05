import { isActiveBusinessStatus } from "../../../types/businessStatus";
import type { Opportunity } from "../../../types/database";

// Kritik Akış Düzeltmesi 2 — when a company/fuar combination has more
// than one opportunity for the same exhibition_id (e.g. one already
// lost, a newer one still open), the fuar-only heuristic below cannot
// tell them apart by intent — it can only guess "prefer active, else
// most recent". A specific opportunity requested by id (Today task
// links, "?opportunityId=" in the URL) must always win over that guess:
// its own real id and stage decide the workspace's open/closed state,
// never a sibling's. Scoped to the given selectedExhibitionId so an id
// left over from a since-abandoned fuar selection never leaks in.
function findExplicitOpportunityMatch(
  opportunities: readonly Opportunity[],
  selectedExhibitionId: string | null,
  explicitOpportunityId: string | null | undefined,
): Opportunity | null {
  if (!explicitOpportunityId || !selectedExhibitionId) {
    return null;
  }

  const match = opportunities.find(
    (opportunity) => opportunity.id === explicitOpportunityId,
  );

  return match && match.exhibition_id === selectedExhibitionId
    ? match
    : null;
}

/**
 * Sprint 25.1 — the workspace's opportunity, if any, is derived FROM the
 * sidebar's selected fuar (selectedExhibitionId), never the other way
 * around. This is a plain lookup, not effect-driven state, so there is no
 * synchronization step and therefore no possible staleness: switching
 * the sidebar fuar just re-derives this on the next render.
 *
 * Prefers an active opportunity for that fuar; falls back to the most
 * recent non-active one (opportunities are expected pre-sorted
 * newest-first, as getOpportunitiesByCompany returns them) so a
 * closed/won record for that fuar still surfaces instead of nothing.
 *
 * Kritik Akış Düzeltmesi 2 — explicitOpportunityId (optional), when it
 * resolves to a real opportunity for this exact exhibitionId, is used
 * directly instead of the active-first/most-recent guess below — see
 * findExplicitOpportunityMatch.
 */
export function selectOpportunityForExhibition(
  opportunities: readonly Opportunity[],
  selectedExhibitionId: string | null,
  explicitOpportunityId?: string | null,
): Opportunity | null {
  if (!selectedExhibitionId) {
    return null;
  }

  const explicitMatch = findExplicitOpportunityMatch(
    opportunities,
    selectedExhibitionId,
    explicitOpportunityId,
  );

  if (explicitMatch) {
    return explicitMatch;
  }

  const matches = opportunities.filter(
    (opportunity) =>
      opportunity.exhibition_id === selectedExhibitionId,
  );

  return (
    matches.find((opportunity) =>
      isActiveBusinessStatus(opportunity.stage),
    ) ??
    matches[0] ??
    null
  );
}

/**
 * Sprint 25.2 — the workspace's real "usable for actions" opportunity,
 * as opposed to selectOpportunityForExhibition's informational-only
 * terminal fallback. A terminal (signed/lost) match is exactly as
 * unusable as no match at all here: it is never silently treated as the
 * live opportunity to reuse/reactivate — see BUG-S25-001's sibling
 * requirement that completing a call with only a terminal record for the
 * fuar creates a fresh opportunity instead.
 *
 * sessionOpportunityId (set the moment ensureActiveOpportunity creates a
 * new opportunity in CustomerWorkspace) is checked first so an opportunity
 * created earlier in the same session is reused immediately, without
 * waiting for the `opportunities` prop to refresh from Supabase.
 *
 * Kritik Akış Düzeltmesi 2 — explicitOpportunityId (optional) is tried
 * next, before the fuar-only heuristic, via selectOpportunityForExhibition
 * — same as viewedOpportunity. Still subject to the terminal exclusion
 * just below: an explicitly requested but closed opportunity is exactly
 * as unusable for actions here as no match at all, so it still resolves
 * to null (matching), never reused/reactivated.
 */
export function resolveSessionOpportunity(input: {
  opportunities: readonly Opportunity[];
  selectedExhibitionId: string | null;
  sessionOpportunityId: string | null;
  explicitOpportunityId?: string | null;
}): Opportunity | null {
  const {
    opportunities,
    selectedExhibitionId,
    sessionOpportunityId,
    explicitOpportunityId,
  } = input;

  // RC-05 — sessionOpportunityId can outlive the record it points to
  // becoming terminal within the same session (e.g. it was created
  // earlier for this fuar, then "Katılım Onaylandı" moved it to
  // "signed" without the sidebar fuar ever changing, which is the only
  // thing that clears this id). A terminal sessionMatch must fall
  // through to the same active-only rule below, exactly like this
  // function's own doc comment above already promises for the
  // explicitOpportunityId/fuar-heuristic path — otherwise a just-closed
  // opportunity keeps being treated as reusable for actions.
  if (sessionOpportunityId) {
    const sessionMatch = opportunities.find(
      (opportunity) =>
        opportunity.id === sessionOpportunityId,
    );

    if (
      sessionMatch &&
      isActiveBusinessStatus(sessionMatch.stage)
    ) {
      return sessionMatch;
    }
  }

  const matched = selectOpportunityForExhibition(
    opportunities,
    selectedExhibitionId,
    explicitOpportunityId,
  );

  return matched && isActiveBusinessStatus(matched.stage)
    ? matched
    : null;
}

export type OpportunityCommitDecision =
  | "reuse"
  | "create"
  | "blocked-no-exhibition";

/**
 * Sprint 25.3 — the one rule for how the Commit Engine
 * (CustomerWorkspace.commitWorkspaceSession) may touch an opportunity.
 * There is exactly one caller of this function now: "Görüşmeyi Tamamla".
 * Every other workspace action (note typing, price calculation, follow-up
 * picking) only ever touches the in-memory Exhibition Session draft (see
 * models/exhibitionSessionDraft.ts) and never reaches this decision at
 * all — so, unlike Sprint 25.2.1's version, there is no longer a "defer"
 * outcome to encode a non-completing caller.
 *
 * - A real, active opportunity already exists for the fuar -> "reuse":
 *   update it directly, per the locked rule "aktif opportunity varsa
 *   güncellenir". Never creates a duplicate.
 * - No real opportunity, but a fuar is selected -> "create": a new one is
 *   genuinely needed, subject to the BUG-S25-001 four-active-opportunity
 *   limit inside ensureActiveOpportunity.
 * - No real opportunity and no fuar selected -> "blocked-no-exhibition":
 *   completing without a fuar must not create anything at all.
 */
export function decideOpportunityCommitAction(input: {
  hasSelectedOpportunity: boolean;
  hasSelectedExhibition: boolean;
}): OpportunityCommitDecision {
  if (input.hasSelectedOpportunity) {
    return "reuse";
  }

  return input.hasSelectedExhibition
    ? "create"
    : "blocked-no-exhibition";
}
