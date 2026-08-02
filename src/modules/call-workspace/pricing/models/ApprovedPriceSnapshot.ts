import type { PriceInput } from "./PriceInput";
import type { PriceResult } from "./PriceResult";

/**
 * Where an approved calculation's numbers came from.
 * - "exhibition-config": resources/templates/test-data/exhibitions/<fuar>/pricing/pricing.json
 *   (every real fuar, Mining Turkey included, now resolves this way —
 *   there is no more hardcoded-rule special case).
 * - "manual": entered by hand (no repository config existed). Not wired
 *   up yet — no manual-entry UI exists — but the value is modeled for
 *   when one is added.
 */
export type PricingSource =
  | "exhibition-config"
  | "manual";

/**
 * An approved price, permanently tied to the exhibition it was
 * calculated for. Never carried over to a different exhibition or
 * opportunity — see approvedPriceKey(). Once approved, this snapshot
 * never changes even if pricing.json is edited afterward — the config's
 * own version/update time is copied in at approval time precisely so
 * that can be audited later.
 */
export type ApprovedPriceSnapshot = {
  opportunityId: string;

  exhibitionId: string;
  exhibitionName: string;

  pricingSource: PricingSource;
  /** The repository config's own schemaVersion at approval time. */
  pricingSourceVersion?: string;
  /** The repository config's own updatedAt at approval time. */
  pricingConfigUpdatedAt?: string;
  /** The resolved on-disk exhibition folder (e.g. "02_wampex_2026"). */
  matchedRepositoryFolder?: string;

  approvedAt: string;

  priceInput: PriceInput;
  priceResult: PriceResult;
};

/**
 * Composite key for keeping one approved price per opportunity+exhibition
 * pair, instead of a single shared slot that a fuar switch could leak
 * into.
 */
export function approvedPriceKey(
  opportunityId: string,
  exhibitionId: string,
): string {
  return `${opportunityId}:${exhibitionId}`;
}
