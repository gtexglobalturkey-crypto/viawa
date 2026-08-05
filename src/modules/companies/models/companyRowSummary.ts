import {
  isTerminalBusinessStatus,
  type CompanyStatusLabel,
} from "../../../types/businessStatus";
import type { Opportunity } from "../../../types/database";

export type CompanyRowSummary = {
  activeOpportunities: Opportunity[];
  nextOpportunity: Opportunity | null;
  companyStatus: CompanyStatusLabel;
};

// Kritik Akış Düzeltmesi 7 — the Companies list row is fed ONLY by a
// company's active (non-terminal) opportunities. A Kaybedildi/İmzalar
// Tamamlandı opportunity must never surface its stale stage/next_action
// here — that history lives in Timeline/Katılım Geçmişi/Belge Arşivi
// (CompanyDetailPage), not in this summary. Deliberately only two
// possible statuses ("Potansiyel Firma"/"Pasif Firma") — unlike
// businessStatus.resolveCompanyStatus's four-state, terminal-aware
// model, which is still used unchanged elsewhere (e.g. CompanyDetailPage).
export function resolveCompanyRowSummary(
  companyOpportunities: readonly Opportunity[],
): CompanyRowSummary {
  const activeOpportunities =
    companyOpportunities.filter(
      (opportunity) =>
        !isTerminalBusinessStatus(
          opportunity.stage,
        ),
    );

  const orderedActiveOpportunities = [
    ...activeOpportunities,
  ].sort((first, second) => {
    const firstDate = first.next_action_date
      ? new Date(
          first.next_action_date,
        ).getTime()
      : Number.POSITIVE_INFINITY;

    const secondDate = second.next_action_date
      ? new Date(
          second.next_action_date,
        ).getTime()
      : Number.POSITIVE_INFINITY;

    return firstDate - secondDate;
  });

  const nextOpportunity =
    orderedActiveOpportunities[0] ?? null;

  return {
    activeOpportunities,
    nextOpportunity,
    companyStatus:
      activeOpportunities.length > 0
        ? "Potansiyel Firma"
        : "Pasif Firma",
  };
}
