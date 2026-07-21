import type {
  Opportunity,
} from "../../../types/database";

import type {
  OpportunityStage,
} from "../../../types/salesAction";

import type {
  WorkspaceExhibition,
} from "./workspaceViewModel";

import {
  formatWorkspaceLabel,
} from "./workspaceFormatters";

type MapWorkspaceExhibitionInput = {
  opportunity: Opportunity;
  stage: OpportunityStage;
};

export function mapWorkspaceExhibition({
  opportunity,
  stage,
}: MapWorkspaceExhibitionInput): WorkspaceExhibition {
  const quotationStarted =
    stage === "quotation-requested" ||
    stage === "quotation-sent" ||
    stage === "negotiation" ||
    stage === "contract" ||
    stage === "signed";

  return {
    id: opportunity.exhibition_id,
    name: "Exhibition Participation",
    hall: "Not assigned",
    booth: "Not assigned",

    standSizeSqm: null,
    standSizeLabel: "Not decided",

    floorPlanStatus:
      stage === "information-sent"
        ? "Floor Plan Sent"
        : "Floor Plan Pending",

    quotationStatus: quotationStarted
      ? formatWorkspaceLabel(stage)
      : "Quotation Pending",
  };
}