import type { ApprovedPriceSnapshot } from "../models/ApprovedPriceSnapshot";

export type CommitApprovedPriceDependencies = {
  approveOpportunityPrice: (input: {
    companyId: string;
    snapshot: ApprovedPriceSnapshot;
  }) => Promise<unknown>;
};

export type CommitApprovedPriceInput = {
  companyId: string;
  snapshot: ApprovedPriceSnapshot;
  onPersisted: (snapshot: ApprovedPriceSnapshot) => void;
};

export type CommitApprovedPriceResult =
  | { success: true }
  | { success: false; error: unknown };

/**
 * Required invariant: onPersisted (which drives the UI/localStorage
 * "approved" state) fires only after the persistent opportunity price
 * update AND the approved_price_snapshots insert have both actually
 * succeeded — never before, and never on a partial failure of either
 * one. approveOpportunityPrice performs both writes as a single atomic
 * database transaction (see the approve_opportunity_price RPC), so
 * there is no window where one succeeds and the other doesn't. Document
 * generation (browser preview and the document-service) reads that
 * persistent snapshot row exclusively, so local state must never claim
 * "approved" ahead of it.
 */
export async function commitApprovedPrice(
  dependencies: CommitApprovedPriceDependencies,
  input: CommitApprovedPriceInput,
): Promise<CommitApprovedPriceResult> {
  try {
    await dependencies.approveOpportunityPrice({
      companyId: input.companyId,
      snapshot: input.snapshot,
    });
  } catch (error) {
    return { success: false, error };
  }

  input.onPersisted(input.snapshot);
  return { success: true };
}
