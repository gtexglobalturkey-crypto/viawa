import { salesActions } from "../../../data/reference/salesActions";
import { OpportunityStage, SalesAction } from "../../../types/salesAction";

export function getRecommendedSalesAction(
  stage: OpportunityStage
): SalesAction {
  const action = salesActions.find((item) =>
    item.recommendedStages.includes(stage)
  );

  return action ?? salesActions[0];
}

export function getNextOpportunityStage(
  actionId: string,
  currentStage: OpportunityStage
): OpportunityStage {
  switch (actionId) {
    case "information-package":
      return "information-sent";

    case "quotation":
      return "quotation-sent";

    case "revised-quotation":
      return "negotiation";

    case "contract":
      return "contract";

    case "thank-you":
      return "signed";

    default:
      return currentStage;
  }
}