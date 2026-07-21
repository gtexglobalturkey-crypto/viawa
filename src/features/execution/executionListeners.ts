import { subscribe } from "./eventBus";
import { addMemoryEntry } from "./memoryStore";
import { addTimelineEvent } from "./timelineStore";
import { addWorkQueueItem } from "./workQueueStore";

import type {
  WorkflowCompletionFeedback,
} from "./executeAction";
import type {
  MemoryEntry,
} from "./memoryBuilder";
import type {
  TimelineEvent,
} from "./timelineBuilder";

import {
  createReminder,
  updateReminder,
} from "../../services/supabase/reminderService";

import {
  createTimelineEvent,
} from "../../services/supabase/timelineService";

import {
  updateOpportunity,
} from "../../services/supabase/opportunityService";

import {
  upsertAiMemory,
} from "../../services/supabase/aiService";

let initialized = false;

type ExecutionPayload = {
  actionId?: string;
  title?: string;
  companyId?: string;
  opportunityId?: string;
  reminderId?: string;
  timeline?: TimelineEvent;
  memory?: MemoryEntry;
  workflowFeedback?:
    WorkflowCompletionFeedback;
};

type OpportunityUpdate = {
  stage?: string;
  next_action?: string | null;
  next_action_date?: string | null;
};

function getNextTask(
  actionId?: string,
): string | null {
  const normalizedActionId =
    actionId
      ?.trim()
      .toLowerCase() ?? "";

  switch (normalizedActionId) {
    case "information-package":
      return "Schedule follow-up call";

    case "quotation":
      return "Wait for quotation feedback";

    case "revised-quotation":
      return "Negotiate final offer";

    case "contract":
      return "Track signed contract";

    case "make-call":
    case "call":
    case "follow-up":
    case "follow-up-call":
    case "planned-call":
    case "phone-call":
      return "Review call outcome and complete next action";

    default:
      if (
        normalizedActionId.includes(
          "call",
        )
      ) {
        return "Review call outcome and complete next action";
      }

      return null;
  }
}

function getNextStage(
  actionId?: string,
): string | null {
  switch (actionId) {
    case "information-package":
      return "information-sent";

    case "quotation":
      return "quotation-sent";

    case "revised-quotation":
      return "negotiation";

    case "contract":
      return "contract";

    default:
      return null;
  }
}

function getReminderDate(): string {
  const reminderDate = new Date();

  reminderDate.setDate(
    reminderDate.getDate() + 3,
  );

  reminderDate.setHours(
    10,
    0,
    0,
    0,
  );

  return reminderDate.toISOString();
}

function formatDuration(
  durationSeconds: number | null,
): string {
  if (durationSeconds === null) {
    return "Completion time was not measured.";
  }

  if (durationSeconds < 60) {
    return (
      "The task was completed in " +
      `${durationSeconds} seconds.`
    );
  }

  const durationMinutes =
    Math.max(
      1,
      Math.round(
        durationSeconds / 60,
      ),
    );

  return (
    "The task was completed in " +
    `${durationMinutes} minute${
      durationMinutes === 1
        ? ""
        : "s"
    }.`
  );
}

function buildFeedbackSummary(
  memory: MemoryEntry,
  feedback:
    | WorkflowCompletionFeedback
    | undefined,
): string {
  if (!feedback) {
    return memory.summary;
  }

  const selectionSummary =
    feedback.wasAtlasRecommended
      ? "The user completed Atlas's recommended task."
      : feedback.wasManuallySelected
        ? (
            "The user selected and completed a different " +
            "task instead of Atlas's first recommendation."
          )
        : (
            "The workflow task was completed without a " +
            "recorded recommendation preference."
          );

  const scoreSummary =
    feedback.taskScore !== null
      ? (
          `The task score was ${feedback.taskScore}` +
          `${
            feedback.taskScorePriority
              ? ` with ${feedback.taskScorePriority} priority`
              : ""
          }.`
        )
      : "No task score was available.";

  return [
    memory.summary,
    selectionSummary,
    formatDuration(
      feedback.durationSeconds,
    ),
    scoreSummary,
  ].join(" ");
}

function buildFeedbackRisk(
  memory: MemoryEntry,
  feedback:
    | WorkflowCompletionFeedback
    | undefined,
  nextActionScheduled: boolean,
): string {
  const riskParts: string[] = [];

  if (
    !nextActionScheduled &&
    memory.risk.trim()
  ) {
    riskParts.push(
      memory.risk.trim(),
    );
  }

  if (feedback?.aiRisk) {
    riskParts.push(
      "Atlas identified an AI risk signal before task completion.",
    );
  }

  return riskParts.join(" ").trim();
}

function buildFeedbackRecommendation(
  memory: MemoryEntry,
  feedback:
    | WorkflowCompletionFeedback
    | undefined,
  nextActionScheduled: boolean,
): string {
  const recommendationParts: string[] =
    [];

  if (nextActionScheduled) {
    recommendationParts.push(
      "The next customer action was scheduled successfully.",
    );
  } else if (memory.nextStep.trim()) {
    recommendationParts.push(
      memory.nextStep.trim(),
    );
  }

  if (!feedback) {
    return recommendationParts
      .join(" ")
      .trim();
  }

  if (feedback.wasAtlasRecommended) {
    recommendationParts.push(
      "Atlas's recommendation was accepted and completed.",
      "Use this outcome as a positive signal for similar tasks.",
    );

    return recommendationParts
      .join(" ")
      .trim();
  }

  if (feedback.wasManuallySelected) {
    recommendationParts.push(
      "The user preferred a manually selected task.",
      "Compare similar future recommendations with this choice.",
    );

    return recommendationParts
      .join(" ")
      .trim();
  }

  recommendationParts.push(
    "Use the completed workflow result to improve future task ordering.",
  );

  return recommendationParts
    .join(" ")
    .trim();
}

function getFeedbackConfidence(
  memory: MemoryEntry,
  feedback:
    | WorkflowCompletionFeedback
    | undefined,
): number {
  if (
    feedback?.aiConfidence !== null &&
    feedback?.aiConfidence !==
      undefined &&
    Number.isFinite(
      feedback.aiConfidence,
    )
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        feedback.aiConfidence,
      ),
    );
  }

  return memory.confidence;
}

async function saveAiMemory(
  companyId: string,
  memory: MemoryEntry,
  nextActionScheduled: boolean,
  feedback?:
    WorkflowCompletionFeedback,
) {
  await upsertAiMemory({
    company_id: companyId,
    summary:
      buildFeedbackSummary(
        memory,
        feedback,
      ),
    risk:
      buildFeedbackRisk(
        memory,
        feedback,
        nextActionScheduled,
      ),
    recommendation:
      buildFeedbackRecommendation(
        memory,
        feedback,
        nextActionScheduled,
      ),
    confidence:
      getFeedbackConfidence(
        memory,
        feedback,
      ),
  });
}

async function saveTimelineEvent(
  companyId: string,
  opportunityId: string | undefined,
  timeline: TimelineEvent,
) {
  await createTimelineEvent({
    company_id: companyId,
    opportunity_id:
      opportunityId ?? null,
    type: timeline.eventType,
    title: timeline.title,
    description: timeline.text,
  });
}

function buildOpportunityUpdate(
  actionId: string | undefined,
  nextTask: string | null,
  reminderDate: string | null,
): OpportunityUpdate | null {
  const nextStage =
    getNextStage(actionId);

  const update: OpportunityUpdate = {};

  if (nextStage !== null) {
    update.stage = nextStage;
  }

  if (
    nextTask !== null &&
    reminderDate !== null
  ) {
    update.next_action = nextTask;
    update.next_action_date =
      reminderDate;
  }

  return Object.keys(update).length > 0
    ? update
    : null;
}

export function initializeExecutionListeners() {
  if (initialized) {
    return;
  }

  subscribe(async (event) => {
    const payload =
      event.payload as
        | ExecutionPayload
        | undefined;

    if (!payload) {
      return;
    }

    if (payload.timeline) {
      addTimelineEvent(
        payload.timeline,
      );
    }

    if (payload.memory) {
      addMemoryEntry(
        payload.memory,
      );
    }

    if (payload.reminderId) {
      await updateReminder(
        payload.reminderId,
        {
          completed: true,
        },
      );
    }

    if (
      payload.companyId &&
      payload.timeline
    ) {
      await saveTimelineEvent(
        payload.companyId,
        payload.opportunityId,
        payload.timeline,
      );
    }

    const nextTask =
      getNextTask(
        payload.actionId,
      );

    if (nextTask) {
      addWorkQueueItem(
        nextTask,
      );
    }

    const reminderDate =
      nextTask
        ? getReminderDate()
        : null;

    let nextActionScheduled = false;

    if (
      payload.companyId &&
      nextTask &&
      reminderDate
    ) {
      await createReminder({
        company_id:
          payload.companyId,
        title: nextTask,
        due_date:
          reminderDate,
        completed: false,
      });

      nextActionScheduled = true;
    }

    if (
      payload.companyId &&
      payload.memory
    ) {
      await saveAiMemory(
        payload.companyId,
        payload.memory,
        nextActionScheduled,
        payload.workflowFeedback,
      );
    }

    if (payload.opportunityId) {
      const opportunityUpdate =
        buildOpportunityUpdate(
          payload.actionId,
          nextTask,
          reminderDate,
        );

      if (opportunityUpdate) {
        await updateOpportunity(
          payload.opportunityId,
          opportunityUpdate,
        );
      }
    }
  });

  initialized = true;
}