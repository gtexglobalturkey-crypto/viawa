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

const OPPORTUNITY_STAGES: OpportunityStage[] = [
  "new",
  "contacted",
  "interested",
  "information-sent",
  "quotation-requested",
  "quotation-sent",
  "negotiation",
  "contract",
  "signed",
  "lost",
];

export function normalizeOpportunityStage(
  stage: string,
): OpportunityStage {
  if (
    OPPORTUNITY_STAGES.includes(
      stage as OpportunityStage,
    )
  ) {
    return stage as OpportunityStage;
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

    case "quotation-requested":
      return "Prepare the quotation.";

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

      currency: "",

      formattedEstimatedValue:
        formatEstimatedValue(
          opportunity.estimated_value,
        ),

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