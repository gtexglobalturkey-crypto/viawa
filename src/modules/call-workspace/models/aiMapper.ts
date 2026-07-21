import type {
  AiMemory,
} from "../../../types/database";

import type {
  OpportunityStage,
} from "../../../types/salesAction";

import type {
  WorkspaceAi,
  WorkspaceAiMemory,
} from "./workspaceViewModel";

import {
  formatWorkspaceDate,
  formatWorkspaceLabel,
} from "./workspaceFormatters";

function getConfidenceLabel(
  confidence: number,
): string {
  if (confidence >= 75) {
    return `High · ${confidence}%`;
  }

  if (confidence >= 40) {
    return `Medium · ${confidence}%`;
  }

  return `Low · ${confidence}%`;
}

function getDefaultRisk(
  stage: OpportunityStage,
): string {
  switch (stage) {
    case "quotation-sent":
    case "negotiation":
      return "The customer may compare the offer with competitors before making a decision.";

    case "contract":
      return "The main risk is delay in internal approval or contract review.";

    case "signed":
      return "No critical sales risk is currently recorded.";

    case "lost":
      return "The opportunity has been marked as lost. Record the reason and a future reactivation date.";

    default:
      return "The customer may need additional information before moving to the next stage.";
  }
}

function createAiMemories(
  aiMemory: AiMemory | null,
): WorkspaceAiMemory[] {
  if (!aiMemory?.summary) {
    return [];
  }

  return [
    {
      id: aiMemory.id,
      category: "general",
      categoryLabel: "General",
      content: aiMemory.summary,
      importance: Math.max(
        1,
        Math.min(
          10,
          Math.round(
            aiMemory.confidence / 10,
          ),
        ),
      ),
      createdAt: aiMemory.created_at,
      dateLabel: formatWorkspaceDate(
        aiMemory.created_at,
      ),
    },
  ];
}

type MapWorkspaceAiInput = {
  companyName: string;
  stage: OpportunityStage;
  nextAction: string;
  aiMemory: AiMemory | null;
};

export function mapWorkspaceAi({
  companyName,
  stage,
  nextAction,
  aiMemory,
}: MapWorkspaceAiInput): WorkspaceAi {
  const confidence = Math.max(
    0,
    Math.min(
      100,
      aiMemory?.confidence ?? 50,
    ),
  );

  return {
    confidence,
    confidenceLabel:
      getConfidenceLabel(confidence),

    conversationSummary:
      aiMemory?.summary ??
      `${companyName} is currently at the ${formatWorkspaceLabel(
        stage,
      )} stage.`,

    latestMemory:
      aiMemory?.summary ??
      "No AI memory recorded yet.",

    riskAnalysis:
      aiMemory?.risk ??
      getDefaultRisk(stage),

    nextBestAction:
      aiMemory?.recommendation ??
      nextAction,

    memories:
      createAiMemories(aiMemory),

    createdAt:
      aiMemory?.created_at ?? null,

    updatedAt:
      aiMemory?.updated_at ?? null,
  };
}