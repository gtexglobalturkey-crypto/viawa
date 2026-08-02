export type TaskScorePriority =
  | "critical"
  | "high"
  | "normal"
  | "low";

export type TaskScoringRule = {
  id: string;
  label: string;
  points: number;
};

export const TASK_SCORING_RULES = {
  followUpOverdue: {
    id: "follow-up-overdue",
    label: "Follow-up overdue",
    points: 30,
  },

  waitingMoreThanSevenDays: {
    id: "waiting-more-than-seven-days",
    label: "Waiting more than 7 days",
    points: 20,
  },

  waitingMoreThanThreeDays: {
    id: "waiting-more-than-three-days",
    label: "Waiting more than 3 days",
    points: 10,
  },

  highProbability: {
    id: "high-probability",
    label: "High probability opportunity",
    points: 15,
  },

  quotationReady: {
    id: "quotation-ready",
    label: "Quotation ready",
    points: 20,
  },

  proposalReady: {
    id: "proposal-ready",
    label: "Proposal ready to send",
    points: 20,
  },

  contractStage: {
    id: "contract-stage",
    label: "Contract stage",
    points: 25,
  },

  highValueOpportunity: {
    id: "high-value-opportunity",
    label: "High value opportunity",
    points: 20,
  },

  aiRecommended: {
    id: "ai-recommended",
    label: "AI recommended",
    points: 10,
  },

  aiHighConfidence: {
    id: "ai-high-confidence",
    label: "High-confidence AI signal",
    points: 10,
  },

  aiRiskDetected: {
    id: "ai-risk-detected",
    label: "AI risk detected",
    points: 20,
  },
} satisfies Record<
  string,
  TaskScoringRule
>;

export function getTaskScorePriority(
  score: number,
): TaskScorePriority {
  if (score >= 70) {
    return "critical";
  }

  if (score >= 40) {
    return "high";
  }

  if (score >= 20) {
    return "normal";
  }

  return "low";
}