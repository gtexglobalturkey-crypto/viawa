import type { ApprovedPriceSnapshot } from "../models/ApprovedPriceSnapshot";

export type CommitApprovedPriceDependencies = {
  updateOpportunity: (
    opportunityId: string,
    patch: Record<string, unknown>,
  ) => Promise<unknown>;
  saveApprovedPriceSnapshot: (input: {
    companyId: string;
    snapshot: ApprovedPriceSnapshot;
  }) => Promise<unknown>;
};

export type CommitApprovedPriceInput = {
  companyId: string;
  opportunityId: string;
  opportunityPricePatch: Record<string, unknown>;
  snapshot: ApprovedPriceSnapshot;
  onPersisted: (snapshot: ApprovedPriceSnapshot) => void;
};

export type CommitApprovedPriceResult =
  | { success: true }
  | { success: false; error: unknown };

/**
 * Required invariant: onPersisted (which drives the UI/localStorage
 * "approved" state) fires only after the persistent
 * approved_price_snapshots insert has actually succeeded — never before,
 * and never on failure. Document generation (browser preview and the
 * document-service) reads that persistent row exclusively, so local state
 * must never claim "approved" ahead of it.
 */
export async function commitApprovedPrice(
  dependencies: CommitApprovedPriceDependencies,
  input: CommitApprovedPriceInput,
): Promise<CommitApprovedPriceResult> {
  try {
    await dependencies.updateOpportunity(
      input.opportunityId,
      input.opportunityPricePatch,
    );
    await dependencies.saveApprovedPriceSnapshot({
      companyId: input.companyId,
      snapshot: input.snapshot,
    });
  } catch (error) {
    return { success: false, error };
  }

  input.onPersisted(input.snapshot);
  return { success: true };
}
