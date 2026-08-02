import {
  getTaskScorePriority,
  TASK_SCORING_RULES,
} from "./ScoringRules";

import type {
  TaskScorePriority,
  TaskScoringRule,
} from "./ScoringRules";
import type { WorkflowTask } from "./workflowTypes";

export type TaskScoreResult = {
  score: number;
  priority: TaskScorePriority;
  reasons: string[];
  badges: string[];
};

type TaskMetadata = Record<
  string,
  unknown
>;

function readString(
  metadata: TaskMetadata,
  keys: string[],
): string {
  for (const key of keys) {
    const value = metadata[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function readNumber(
  metadata: TaskMetadata,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = metadata[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      const normalizedValue =
        value.trim().replace("%", "");

      const parsedValue =
        Number(normalizedValue);

      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return null;
}

function readBoolean(
  metadata: TaskMetadata,
  keys: string[],
): boolean {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value > 0;
    }

    if (typeof value === "string") {
      const normalized =
        value.trim().toLowerCase();

      if (
        normalized === "true" ||
        normalized === "yes" ||
        normalized === "1" ||
        normalized === "recommended" ||
        normalized === "risk" ||
        normalized === "at risk" ||
        normalized === "medium" ||
        normalized === "moderate" ||
        normalized === "high" ||
        normalized === "critical"
      ) {
        return true;
      }

      if (
        normalized === "false" ||
        normalized === "no" ||
        normalized === "0" ||
        normalized === "none" ||
        normalized === "safe" ||
        normalized === "low" ||
        normalized === "not recommended"
      ) {
        return false;
      }
    }
  }

  return false;
}

function normalizeConfidence(
  value: number,
): number {
  if (value <= 1) {
    return Math.min(
      100,
      Math.max(0, value * 100),
    );
  }

  return Math.min(
    100,
    Math.max(0, value),
  );
}

function getTaskMetadata(
  task: WorkflowTask,
): TaskMetadata {
  const record =
    task as unknown as TaskMetadata;

  const nestedMetadata =
    record.metadata;

  if (
    nestedMetadata &&
    typeof nestedMetadata === "object" &&
    !Array.isArray(nestedMetadata)
  ) {
    return {
      ...record,
      ...(nestedMetadata as TaskMetadata),
    };
  }

  return record;
}

function applyRule(
  rule: TaskScoringRule,
  reasons: string[],
  badges: string[],
): number {
  reasons.push(rule.label);
  badges.push(rule.label);

  return rule.points;
}

export class TaskScoreEngine {
  score(
    task: WorkflowTask,
  ): TaskScoreResult {
    const metadata =
      getTaskMetadata(task);

    const reasons: string[] = [];
    const badges: string[] = [];

    let score = 0;

    const daysWaiting =
      readNumber(metadata, [
        "daysWaiting",
        "days_waiting",
        "waitingDays",
        "waiting_days",
      ]) ?? 0;

    const probability =
      readNumber(metadata, [
        "probability",
        "opportunityProbability",
        "opportunity_probability",
      ]) ?? 0;

    const estimatedValue =
      readNumber(metadata, [
        "estimatedValue",
        "estimated_value",
        "opportunityValue",
        "opportunity_value",
      ]) ?? 0;

    const rawAiConfidence =
      readNumber(metadata, [
        "aiConfidence",
        "ai_confidence",
        "confidence",
      ]) ?? 0;

    const aiConfidence =
      normalizeConfidence(
        rawAiConfidence,
      );

    const stage =
      readString(metadata, [
        "stage",
        "opportunityStage",
        "opportunity_stage",
      ]).toLowerCase();

    const taskType =
      readString(metadata, [
        "type",
        "taskType",
        "task_type",
        "source",
      ]).toLowerCase();

    const followUpOverdue =
      readBoolean(metadata, [
        "followUpOverdue",
        "follow_up_overdue",
        "overdue",
        "isOverdue",
        "is_overdue",
      ]);

    const aiRecommended =
      readBoolean(metadata, [
        "aiRecommended",
        "ai_recommended",
        "recommendedByAi",
        "recommended_by_ai",
      ]);

    const aiRisk =
      readBoolean(metadata, [
        "aiRisk",
        "ai_risk",
        "riskDetected",
        "risk_detected",
        "hasRisk",
        "has_risk",
        "risk",
      ]);

    if (followUpOverdue) {
      score += applyRule(
        TASK_SCORING_RULES
          .followUpOverdue,
        reasons,
        badges,
      );
    }

    if (daysWaiting > 7) {
      score += applyRule(
        TASK_SCORING_RULES
          .waitingMoreThanSevenDays,
        reasons,
        badges,
      );
    } else if (daysWaiting > 3) {
      score += applyRule(
        TASK_SCORING_RULES
          .waitingMoreThanThreeDays,
        reasons,
        badges,
      );
    }

    if (probability >= 70) {
      score += applyRule(
        TASK_SCORING_RULES
          .highProbability,
        reasons,
        badges,
      );
    }

    if (
      stage ===
        "quotation-ready" ||
      taskType.includes(
        "quotation-ready",
      )
    ) {
      score += applyRule(
        TASK_SCORING_RULES
          .quotationReady,
        reasons,
        badges,
      );
    }

    if (
      stage === "proposal-ready" ||
      taskType.includes(
        "send-quotation",
      )
    ) {
      score += applyRule(
        TASK_SCORING_RULES
          .proposalReady,
        reasons,
        badges,
      );
    }

    if (
      stage === "contract" ||
      stage === "signed"
    ) {
      score += applyRule(
        TASK_SCORING_RULES.contractStage,
        reasons,
        badges,
      );
    }

    if (estimatedValue >= 50000) {
      score += applyRule(
        TASK_SCORING_RULES
          .highValueOpportunity,
        reasons,
        badges,
      );
    }

    if (aiRisk) {
      score += applyRule(
        TASK_SCORING_RULES
          .aiRiskDetected,
        reasons,
        badges,
      );
    }

    if (aiRecommended) {
      score += applyRule(
        TASK_SCORING_RULES
          .aiRecommended,
        reasons,
        badges,
      );
    }

    if (
      aiConfidence >= 70 &&
      (
        aiRecommended ||
        aiRisk
      )
    ) {
      score += applyRule(
        TASK_SCORING_RULES
          .aiHighConfidence,
        reasons,
        badges,
      );
    }

    return {
      score,
      priority:
        getTaskScorePriority(score),
      reasons: [
        ...new Set(reasons),
      ],
      badges: [
        ...new Set(badges),
      ],
    };
  }
}