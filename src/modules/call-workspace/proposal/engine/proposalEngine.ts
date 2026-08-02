import { buildProposal } from "./buildProposal";

import type { ProposalInput } from "../models/ProposalInput";
import type { ProposalResult } from "../models/ProposalResult";

function validateProposalInput(
  input: ProposalInput,
): void {
  if (!input.companyId.trim()) {
    throw new Error(
      "Company id is required.",
    );
  }

  if (!input.companyName.trim()) {
    throw new Error(
      "Company name is required.",
    );
  }

  if (!input.exhibitionId.trim()) {
    throw new Error(
      "Exhibition id is required.",
    );
  }

  if (!input.exhibitionName.trim()) {
    throw new Error(
      "Exhibition name is required.",
    );
  }

  if (input.standAreaSqm <= 0) {
    throw new Error(
      "Stand area must be greater than 0.",
    );
  }

  if (!input.validityDate.trim()) {
    throw new Error(
      "Proposal validity date is required.",
    );
  }

  if (!input.paymentTerms.trim()) {
    throw new Error(
      "Payment terms are required.",
    );
  }

  if (!input.representativeName.trim()) {
    throw new Error(
      "Representative name is required.",
    );
  }

  if (
    input.priceResult.grandTotal < 0
  ) {
    throw new Error(
      "Proposal grand total cannot be negative.",
    );
  }
}

export function runProposalEngine(
  input: ProposalInput,
): ProposalResult {
  validateProposalInput(input);

  return buildProposal(input);
}