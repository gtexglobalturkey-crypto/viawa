import { isActiveBusinessStatus } from "../../../types/businessStatus";
import type { Opportunity } from "../../../types/database";

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
 */
export function selectOpportunityForExhibition(
  opportunities: readonly Opportunity[],
  selectedExhibitionId: string | null,
): Opportunity | null {
  if (!selectedExhibitionId) {
    return null;
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
 */
export function resolveSessionOpportunity(input: {
  opportunities: readonly Opportunity[];
  selectedExhibitionId: string | null;
  sessionOpportunityId: string | null;
}): Opportunity | null {
  const {
    opportunities,
    selectedExhibitionId,
    sessionOpportunityId,
  } = input;

  if (sessionOpportunityId) {
    const sessionMatch = opportunities.find(
      (opportunity) =>
        opportunity.id === sessionOpportunityId,
    );

    if (sessionMatch) {
      return sessionMatch;
    }
  }

  const matched = selectOpportunityForExhibition(
    opportunities,
    selectedExhibitionId,
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
