import type { OpportunityStage } from "./salesAction";

/**
 * Business Status is the single commercial-truth source for an opportunity
 * this sprint: opportunity.stage. It is intentionally separate from
 * operational follow-up (workspaceFollowUpAction.ts) and from AI
 * recommendations — see Sprint 1.1/1.2 notes.
 *
 * Stage ids and their real values are verified against repository usage
 * (workspaceMapper.ts, CompaniesPage.tsx, useCompanyWorkspace.ts,
 * opportunityMapper.ts). No new stage was introduced.
 */
export type BusinessStatus = {
  id: OpportunityStage;

  label: string;

  order: number;

  isTerminal: boolean;
};

const UNKNOWN_BUSINESS_STATUS_LABEL =
  "Durum Tanımsız";

export const BUSINESS_STATUSES: BusinessStatus[] =
  [
    {
      id: "new",
      label: "Yeni",
      order: 0,
      isTerminal: false,
    },
    {
      id: "contacted",
      label: "İletişime Geçildi",
      order: 1,
      isTerminal: false,
    },
    {
      id: "interested",
      label: "İlgileniyor",
      order: 2,
      isTerminal: false,
    },
    {
      id: "information-sent",
      label: "Bilgi Paketi Gönderildi",
      order: 3,
      isTerminal: false,
    },
    // Sprint 22.9.1 — set automatically by
    // CustomerWorkspace.handlePriceCalculated once a Repository price is
    // approved and successfully persisted; not otherwise entered by any
    // other automation this sprint.
    {
      id: "quotation-ready",
      label: "Teklif Hazır",
      order: 4,
      isTerminal: false,
    },
    // Sprint 22.9.2 — set automatically by
    // CustomerWorkspace.handleDocumentConfirmed once the proposal/contract
    // PDF has been generated and its document record successfully
    // persisted; not otherwise entered by any other automation this
    // sprint.
    {
      id: "proposal-ready",
      label: "Teklif Oluşturuldu",
      order: 5,
      isTerminal: false,
    },
    // "quotation-requested" (Sprint 22.9.11) occupied this exact slot
    // before Sprint 22.9.1 introduced "quotation-ready" as the real,
    // currently-produced stage for the same event — it had zero
    // writers and is no longer part of this catalog. See
    // normalizeLegacyOpportunityStage below for how any already-
    // persisted row still containing that old id is handled.
    {
      id: "quotation-sent",
      label: "Sözleşme Gönderildi",
      order: 6,
      isTerminal: false,
    },
    {
      id: "negotiation",
      label: "Görüşme",
      order: 7,
      isTerminal: false,
    },
    {
      id: "contract",
      label: "Sözleşme",
      order: 8,
      isTerminal: false,
    },
    {
      id: "signed",
      label: "İmzalandı",
      order: 9,
      isTerminal: true,
    },
    {
      id: "lost",
      label: "Kaybedildi",
      order: 10,
      isTerminal: true,
    },
    // Sprint 25.5 — the opportunity's actual commercial outcome, set only
    // by "Fırsatı Kapat" → "Kazanıldı" (CustomerWorkspace). Deliberately a
    // different stage from "signed" — see the Signed-vs-Won note on
    // canCloseOpportunity below. Order placed after signed/lost only to
    // keep it last in this list; won/lost are two different terminal
    // outcomes reachable from the same active stages, not a sequence
    // relative to each other.
    {
      id: "won",
      label: "Kazanıldı",
      order: 11,
      isTerminal: true,
    },
  ];

// Sprint 22.9.11 — the one canonical place legacy stage ids are mapped
// to their current replacement. "quotation-requested" → "quotation-
// ready": both represent "this opportunity needs a quotation
// prepared" — Sprint 22.9.1 gave that event a real producer under the
// new id, making the old id dead (zero writers, confirmed via a full
// repo-wide search; zero live Supabase rows also currently hold it).
// Add further aliases here if another stage is ever renamed —
// findBusinessStatus (and everything built on it: labels, ordering,
// the forward-only guard, workspaceMapper's normalizeStage) applies
// this before ever treating a raw string as unrecognized, so an old
// persisted row is never silently downgraded to a semantically wrong
// stage (e.g. "new") or an "unknown status" label.
const LEGACY_STAGE_ALIASES: Record<
  string,
  string
> = {
  "quotation-requested": "quotation-ready",
};

export function normalizeLegacyOpportunityStage(
  rawValue: string,
): string {
  const normalizedValue = rawValue
    .trim()
    .toLowerCase();

  return (
    LEGACY_STAGE_ALIASES[
      normalizedValue
    ] ?? rawValue
  );
}

function normalize(
  value: string,
): string {
  return value.trim().toLowerCase();
}

export function findBusinessStatus(
  rawValue: string | null | undefined,
): BusinessStatus | null {
  if (!rawValue || !rawValue.trim()) {
    return null;
  }

  const normalizedValue = normalize(
    normalizeLegacyOpportunityStage(
      rawValue,
    ),
  );

  return (
    BUSINESS_STATUSES.find(
      (status) =>
        normalize(status.id) ===
        normalizedValue,
    ) ?? null
  );
}

/**
 * Returns the safe, user-facing Turkish label for a raw opportunity.stage
 * value. Returns undefined only when the input itself is empty/missing so
 * callers can apply their own contextual empty-state text (e.g. "no
 * opportunity yet" vs "no stage assigned"). Non-empty but unrecognized
 * values never leak the raw technical string — they resolve to a generic
 * safe fallback label instead.
 */
export function getBusinessStatusLabel(
  rawValue: string | null | undefined,
): string | undefined {
  if (!rawValue || !rawValue.trim()) {
    return undefined;
  }

  return (
    findBusinessStatus(rawValue)?.label ??
    UNKNOWN_BUSINESS_STATUS_LABEL
  );
}

export function isTerminalBusinessStatus(
  rawValue: string | null | undefined,
): boolean {
  return (
    findBusinessStatus(rawValue)
      ?.isTerminal ?? false
  );
}

// The inverse of isTerminalBusinessStatus — kept as a named helper so call
// sites read as "is this opportunity active" rather than a double negative.
export function isActiveBusinessStatus(
  rawValue: string | null | undefined,
): boolean {
  return !isTerminalBusinessStatus(rawValue);
}

// Sprint 25 (BUG-S25-001) — the single shared source for the per-company
// active-opportunity cap. Enforced in three places that must all agree on
// this same number: the CompanyDetailPage UI (counter/card limit/warning),
// createOpportunity() in opportunityService.ts, and the
// enforce_active_opportunity_limit trigger in
// supabase/migrations/20260801100000_enforce_active_opportunity_limit.sql
// (which hardcodes 4 in SQL since it can't import this constant — keep
// both in sync if this ever changes).
export const MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY = 4;

export function countActiveOpportunities<
  T extends { stage: string | null | undefined },
>(opportunities: readonly T[]): number {
  return opportunities.filter((opportunity) =>
    isActiveBusinessStatus(opportunity.stage),
  ).length;
}

// Shared by the frontend pre-check (CustomerWorkspace) and the service
// pre-check (opportunityService) so both ask exactly the same question
// against the same cap. Neither is the actual guarantee — see the trigger
// noted above for that.
export function hasReachedActiveOpportunityLimit<
  T extends { stage: string | null | undefined },
>(opportunities: readonly T[]): boolean {
  return (
    countActiveOpportunities(opportunities) >=
    MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY
  );
}

export const COMPANY_STATUS_LABELS = [
  "Yeni Firma",
  "Potansiyel Firma",
  "Sözleşmeli Firma",
  "Pasif Firma",
] as const;

export type CompanyStatusLabel =
  (typeof COMPANY_STATUS_LABELS)[number];

type CompanyStatusOpportunity = {
  stage: string | null | undefined;
};

/**
 * The single company-level status resolver. Company status is derived from
 * the complete opportunity collection, never from the persisted company
 * status field or from one selected opportunity.
 */
export function resolveCompanyStatus(
  opportunities: readonly CompanyStatusOpportunity[],
): CompanyStatusLabel {
  if (opportunities.length === 0) {
    return "Yeni Firma";
  }

  const normalizedStages = opportunities.map(
    ({ stage }) =>
      normalizeLegacyOpportunityStage(
        stage ?? "",
      )
        .trim()
        .toLowerCase(),
  );

  if (
    normalizedStages.some(
      (stage) =>
        stage === "signed" || stage === "won",
    )
  ) {
    return "Sözleşmeli Firma";
  }

  const hasActiveOpportunity =
    opportunities.some(({ stage }, index) => {
      const normalizedStage =
        normalizedStages[index];

      return (
        normalizedStage !== "closed" &&
        !isTerminalBusinessStatus(stage)
      );
    });

  return hasActiveOpportunity
    ? "Potansiyel Firma"
    : "Pasif Firma";
}

export function getBusinessStatusOrder(
  rawValue: string | null | undefined,
): number {
  const status =
    findBusinessStatus(rawValue);

  return status
    ? status.order
    : BUSINESS_STATUSES.length;
}

// Sprint 25.3 prepared this type expecting Won to reuse the "signed"
// stage; Sprint 25.5 ("Signed ≠ Won" — signed means only that the
// contract itself was signed, Won is the user's explicit "Kazanıldı"
// verdict) corrects that mapping to the real, dedicated "won" stage.
export type OpportunityClosureOutcome =
  | "won"
  | "lost";

export function closureOutcomeToStage(
  outcome: OpportunityClosureOutcome,
): OpportunityStage {
  return outcome === "won" ? "won" : "lost";
}

// RC-05 — "Fırsatı Kapat"/Workspace'in terminal kararı artık
// isTerminalBusinessStatus ile aynı ortak kataloğu okuyor, kendi ayrı bir
// terminal listesi tutmuyor. Sprint 25.5'in "signed hâlâ kapatılabilir,
// yalnızca won/lost lifecycle'ı bitirir" kararı artık geçersiz: Katılım
// Onaylandı akışı (CustomerWorkspace.completeCustomerSignatureWonTransition)
// stage="signed" yazdığı anda satış tamamlanmış sayılıyor ve fırsat
// terminaldir — ayrı bir "Kazanıldı" onayı beklenmiyor (RC-05 kilitli ürün
// kararı). Kataloğun kendisi zaten "signed"i isTerminal: true işaretliyor
// (Company Detail/aktif fırsat sayacı/limit hep bunu kullanıyordu) — bu
// fonksiyon artık onunla çelişmiyor. A missing/empty stage still can't be
// closed (there is nothing to close).
export function canCloseOpportunity(
  rawValue: string | null | undefined,
): boolean {
  if (!rawValue || !rawValue.trim()) {
    return false;
  }

  return !isTerminalBusinessStatus(rawValue);
}

/**
 * Sprint 22.9.9 — the one canonical forward-only guard for every
 * Opportunity stage writer (handlePriceCalculated,
 * handleDocumentConfirmed, completeCustomerSignatureWonTransition, and
 * the shared execution pipeline in executionListeners.ts). Reuses
 * BUSINESS_STATUSES' existing `order` directly via findBusinessStatus —
 * no second ordering system.
 *
 * Deliberately NOT built on getBusinessStatusOrder's "unknown → highest
 * order" fallback: that fallback is right for sorting/prioritizing a
 * status whose value is already trusted, but wrong here — an
 * unrecognized or empty currentStage (e.g. a stage value not yet
 * migrated into BUSINESS_STATUSES, or a failed lookup upstream) would
 * otherwise be treated as "already past every real stage" and
 * permanently block every future write for that record. Instead, an
 * unrecognized current or next stage is treated as "no ordering
 * constraint" (transition allowed) — the same as this guard not having
 * existed at all, matching "no lifecycle behavior changes beyond these
 * fixes."
 */
export function isForwardStageTransition(
  currentStage: string | null | undefined,
  nextStage: string,
): boolean {
  const currentStatus =
    findBusinessStatus(currentStage);
  const nextStatus =
    findBusinessStatus(nextStage);

  if (!currentStatus || !nextStatus) {
    return true;
  }

  return (
    nextStatus.order >= currentStatus.order
  );
}
