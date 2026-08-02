import type { ApprovedPriceSnapshot } from "../models/ApprovedPriceSnapshot";

export type ReconcileApprovedPriceDependencies = {
  loadPersistentSnapshot: (input: {
    opportunityId: string;
    exhibitionId: string;
  }) => Promise<ApprovedPriceSnapshot | null>;
};

export type ReconciledApprovedPrice =
  | { approved: true; snapshot: ApprovedPriceSnapshot }
  | { approved: false };

/**
 * The persistent approved_price_snapshots row is the only source of truth
 * document generation reads. A locally-cached "approved" entry (kept only
 * so the UI survives a page reload without a network round trip) is never
 * trusted on its own: this always confirms against the persistent row
 * before anything treats the price as approved, so a stale local entry
 * with no matching persistent row is reported as not approved rather than
 * silently honored.
 */
export async function reconcileApprovedPrice(
  dependencies: ReconcileApprovedPriceDependencies,
  input: { opportunityId: string; exhibitionId: string },
): Promise<ReconciledApprovedPrice> {
  const persisted = await dependencies.loadPersistentSnapshot(input);

  return persisted
    ? { approved: true, snapshot: persisted }
    : { approved: false };
}
