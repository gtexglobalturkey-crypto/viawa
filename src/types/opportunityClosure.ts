/**
 * Sprint 25.5 — Opportunity Lifecycle Completion (Won / Lost).
 *
 * "business_status" (won/lost) itself lives on opportunity.stage — see
 * businessStatus.ts's OpportunityClosureOutcome/closureOutcomeToStage.
 * This file holds everything specific to *closing* an opportunity that
 * doesn't belong in that more general stage-catalog file: the fixed Lost
 * reason catalog, the exact timeline text "Fırsatı Kapat" writes, and the
 * pure aggregation the future Organizer Report screen will read from
 * (Section 7 — "data only, no report screen yet").
 */

export type LostReasonId =
  | "price-too-high"
  | "chose-other-exhibition"
  | "no-budget"
  | "bad-timing"
  | "product-not-suitable"
  | "decision-postponed"
  | "withdrew-participation"
  | "exhibition-cancelled"
  | "will-reconsider"
  | "other";

export type LostReasonOption = {
  id: LostReasonId;
  emoji: string;
  label: string;
};

// Order matches the locked list in the sprint spec exactly — this is the
// display order in the "Katılmadı" reason picker.
export const LOST_REASON_OPTIONS: readonly LostReasonOption[] = [
  { id: "price-too-high", emoji: "💰", label: "Fiyat yüksek bulundu" },
  { id: "chose-other-exhibition", emoji: "🏢", label: "Başka fuar tercih edildi" },
  { id: "no-budget", emoji: "💸", label: "Bütçe bulunamadı" },
  { id: "bad-timing", emoji: "📅", label: "Zaman uygun değildi" },
  { id: "product-not-suitable", emoji: "📦", label: "Ürün / Hizmet fuara uygun değildi" },
  { id: "decision-postponed", emoji: "⏳", label: "Karar ertelendi" },
  { id: "withdrew-participation", emoji: "🚫", label: "Katılımdan vazgeçti" },
  { id: "exhibition-cancelled", emoji: "❌", label: "Fuar iptal edildi" },
  { id: "will-reconsider", emoji: "🔄", label: "Tekrar değerlendirilecek" },
  { id: "other", emoji: "✍️", label: "Diğer" },
];

const LOST_REASON_IDS: ReadonlySet<string> = new Set(
  LOST_REASON_OPTIONS.map((option) => option.id),
);

export function isLostReasonId(
  value: string,
): value is LostReasonId {
  return LOST_REASON_IDS.has(value);
}

export function getLostReasonOption(
  id: string | null | undefined,
): LostReasonOption | undefined {
  if (!id) {
    return undefined;
  }

  return LOST_REASON_OPTIONS.find(
    (option) => option.id === id,
  );
}

// Falls back to the raw stored value for a reason id that predates this
// catalog or was entered some other way — never silently shows nothing.
export function getLostReasonLabel(
  id: string | null | undefined,
): string | undefined {
  if (!id) {
    return undefined;
  }

  return getLostReasonOption(id)?.label ?? id;
}

// Sprint 25.5 Section 2 — exact required wording.
export function buildWonTimelineDescription(): string {
  return [
    "Opportunity başarıyla kapatıldı.",
    "",
    "Sonuç:",
    "Kazandı.",
  ].join("\n");
}

// Sprint 25.5 Section 3 — exact required wording, plus an optional note
// line only ever appended for the "Diğer" reason (the only one that ever
// carries a closure_note).
export function buildLostTimelineDescription(input: {
  reasonId: string;
  note?: string | null;
}): string {
  const reasonLabel =
    getLostReasonLabel(input.reasonId) ?? input.reasonId;

  const lines = [
    "Opportunity kapatıldı.",
    "",
    "Sonuç:",
    "Katılmadı.",
    "",
    "Sebep:",
    reasonLabel,
  ];

  const trimmedNote = input.note?.trim();

  if (input.reasonId === "other" && trimmedNote) {
    lines.push("", "Not:", trimmedNote);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------
// Section 7 — Organizer Report Hazırlığı (data only, no report screen).
// ---------------------------------------------------------------------

type ClosureAwareOpportunity = {
  company_id: string;
  stage: string | null | undefined;
  closure_reason?: string | null;
  price_stand_area_sqm?: number | null;
  price_currency?: string | null;
  price_grand_total?: number | null;
};

export type WonSummary = {
  companiesWon: number;
  totalAreaSqm: number;
  // Grouped by currency rather than a single total — summing different
  // currencies together would silently produce a meaningless number.
  amountByCurrency: Readonly<Record<string, number>>;
};

export function computeWonSummary(
  opportunities: readonly ClosureAwareOpportunity[],
): WonSummary {
  const won = opportunities.filter(
    (opportunity) => opportunity.stage === "won",
  );

  const companiesWon = new Set(
    won.map((opportunity) => opportunity.company_id),
  ).size;

  const totalAreaSqm = won.reduce(
    (sum, opportunity) =>
      sum + (opportunity.price_stand_area_sqm ?? 0),
    0,
  );

  const amountByCurrency: Record<string, number> = {};

  for (const opportunity of won) {
    if (
      opportunity.price_grand_total == null ||
      !opportunity.price_currency
    ) {
      continue;
    }

    amountByCurrency[opportunity.price_currency] =
      (amountByCurrency[opportunity.price_currency] ?? 0) +
      opportunity.price_grand_total;
  }

  return { companiesWon, totalAreaSqm, amountByCurrency };
}

export type LostReasonBreakdownEntry = {
  reasonId: string;
  label: string;
  count: number;
};

// Only counts Lost opportunities that actually recorded a reason via
// "Fırsatı Kapat" — a pre-existing 'lost' row from before this sprint
// (no closure_reason) contributes to nothing here, rather than being
// miscounted as an "unknown reason". Sorted by count, most common first
// — matches the sprint's own example ordering.
export function computeLostReasonBreakdown(
  opportunities: readonly ClosureAwareOpportunity[],
): LostReasonBreakdownEntry[] {
  const counts = new Map<string, number>();

  for (const opportunity of opportunities) {
    if (
      opportunity.stage !== "lost" ||
      !opportunity.closure_reason
    ) {
      continue;
    }

    const key = opportunity.closure_reason;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reasonId, count]) => ({
      reasonId,
      label: getLostReasonLabel(reasonId) ?? reasonId,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
