import type {
  Opportunity,
} from "../../../types/database";

import type {
  OpportunityStage,
} from "../../../types/salesAction";

import type {
  WorkspaceOpportunity,
} from "./workspaceViewModel";

import {
  formatWorkspaceDate,
  formatWorkspaceLabel,
} from "./workspaceFormatters";

import { normalizeLegacyOpportunityStage } from "../../../types/businessStatus";

const OPPORTUNITY_STAGES: OpportunityStage[] = [
  "new",
  "contacted",
  "interested",
  "information-sent",
  "quotation-ready",
  "proposal-ready",
  "quotation-sent",
  "negotiation",
  "contract",
  "signed",
  "lost",
  // Sprint 25.5 — set only by "Fırsatı Kapat"; without this, a won
  // opportunity's stage would be silently normalized back to "new" here.
  "won",
];

export function normalizeOpportunityStage(
  stage: string,
): OpportunityStage {
  // Sprint 22.9.11 — map any old persisted stage id to its current
  // replacement (e.g. "quotation-requested" → "quotation-ready")
  // before validating, so a legacy row lands on the correct stage
  // instead of being silently reset to "new".
  const migratedStage =
    normalizeLegacyOpportunityStage(
      stage,
    );

  if (
    OPPORTUNITY_STAGES.includes(
      migratedStage as OpportunityStage,
    )
  ) {
    return migratedStage as OpportunityStage;
  }

  return "new";
}

export function getDefaultNextAction(
  stage: OpportunityStage,
): string {
  switch (stage) {
    case "new":
      return "Make the first contact.";

    case "contacted":
      return "Confirm interest and send the information package.";

    case "interested":
      return "Prepare and send the information package.";

    case "information-sent":
      return "Follow up and confirm whether the documents were reviewed.";

    case "quotation-ready":
      return "Generate the quotation document from the approved price.";

    case "proposal-ready":
      return "Review and send the generated proposal to the customer.";

    case "quotation-sent":
      return "Schedule a quotation follow-up.";

    case "negotiation":
      return "Clarify objections and prepare a revised offer if needed.";

    case "contract":
      return "Follow up on contract review and signature.";

    case "signed":
      return "Send a thank-you message and complete onboarding.";

    case "lost":
      return "Record the reason for loss and define a future reactivation date.";

    case "won":
      return "Opportunity closed — no further action needed.";
  }
}

function getInterestLevelLabel(
  interestLevel: number,
): string {
  if (interestLevel >= 75) {
    return "High";
  }

  if (interestLevel >= 40) {
    return "Medium";
  }

  return "Low";
}

function formatEstimatedValue(
  value?: number | null,
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return "Not calculated";
  }

  return value.toLocaleString("en-US");
}

type MapWorkspaceOpportunityInput = {
  opportunity: Opportunity;
  lastContactAt: string | null;
};

type WorkspaceOpportunityResult = {
  opportunity: WorkspaceOpportunity;
  stage: OpportunityStage;
  nextAction: string;
};

export function mapWorkspaceOpportunity({
  opportunity,
  lastContactAt,
}: MapWorkspaceOpportunityInput): WorkspaceOpportunityResult {
  const stage =
    normalizeOpportunityStage(
      opportunity.stage,
    );

  const nextAction =
    opportunity.next_action ??
    getDefaultNextAction(stage);

  return {
    stage,
    nextAction,

    opportunity: {
      id: opportunity.id,
      companyId: opportunity.company_id,
      exhibitionId:
        opportunity.exhibition_id,

      title: "Participation Opportunity",

      stage,
      stageLabel:
        formatWorkspaceLabel(stage),

      interestLevel:
        opportunity.interest_level,

      interestLevelLabel:
        getInterestLevelLabel(
          opportunity.interest_level,
        ),

      estimatedValue:
        opportunity.estimated_value,

      currency:
        opportunity.price_currency ?? "",

      formattedEstimatedValue:
        formatEstimatedValue(
          opportunity.price_grand_total ??
            opportunity.estimated_value,
        ),

      standTypeLabel:
        opportunity.price_stand_type ?? "—",

      priceCalculatedAt:
        opportunity.price_calculated_at ?? null,

      priceCalculatedDateLabel:
        formatWorkspaceDate(
          opportunity.price_calculated_at,
        ),

      quotationSent:
        ["quotation-sent", "negotiation", "contract", "signed", "won"].includes(stage),

      probability:
        opportunity.interest_level,

      probabilityLabel:
        `${opportunity.interest_level}%`,

      nextAction,

      nextActionAt:
        opportunity.next_action_date,

      nextActionDateLabel:
        formatWorkspaceDate(
          opportunity.next_action_date,
        ),

      lastContactAt,

      lastContactDateLabel:
        formatWorkspaceDate(
          lastContactAt,
        ),

      owner:
        opportunity.owner ??
        "Not assigned",

      createdAt:
        opportunity.created_at,

      updatedAt:
        opportunity.updated_at,
    },
  };
}
