import { subscribe } from "./eventBus";
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
  createActiveReminderIfAbsent,
  updateReminder,
} from "../../services/supabase/reminderService";

import {
  createTimelineEvent,
} from "../../services/supabase/timelineService";

import {
  getOpportunity,
  updateOpportunity,
} from "../../services/supabase/opportunityService";

import {
  upsertAiMemory,
} from "../../services/supabase/aiService";

import { findWorkspaceFollowUpActionByExecutionId } from "../../types/workspaceFollowUpAction";
import { isForwardStageTransition } from "../../types/businessStatus";

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
  const followUpAction =
    actionId
      ? findWorkspaceFollowUpActionByExecutionId(
          actionId,
        )
      : null;

  if (followUpAction) {
    return followUpAction.resultingStage;
  }

  switch (actionId) {
    case "information-package":
      return "information-sent";

    case "revised-quotation":
      return "negotiation";

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
      ? "The user completed VIAWA's recommended task."
      : feedback.wasManuallySelected
        ? (
            "The user selected and completed a different " +
            "task instead of VIAWA's first recommendation."
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
      "VIAWA identified an AI risk signal before task completion.",
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
      "VIAWA's recommendation was accepted and completed.",
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

// Sprint 22.9.9 — nextStage/currentStage are resolved by the caller
// (currentStage requires an async Opportunity lookup, only needed when
// there is a candidate stage change at all) so this stays a pure,
// synchronous decision function. A backward transition is skipped
// silently — stage is simply left out of the update — never treated as
// an error.
function buildOpportunityUpdate(
  nextStage: string | null,
  currentStage: string | null | undefined,
  nextTask: string | null,
  reminderDate: string | null,
): OpportunityUpdate | null {
  const update: OpportunityUpdate = {};

  if (
    nextStage !== null &&
    isForwardStageTransition(
      currentStage,
      nextStage,
    )
  ) {
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

    const nextTaskType =
      getNextTaskType(
        payload.actionId,
      );

    if (nextTask) {
      addWorkQueueItem(
        nextTask,
        payload.companyId,
      );
    }

    const reminderDate =
      nextTask
        ? getReminderDate()
        : null;

    let nextActionScheduled = false;

    // RC-03 — this whole "next task" mechanism only ever means one thing:
    // an automatic follow-up reminder FOR THIS OPPORTUNITY's own
    // progression (call review, quotation feedback, contract tracking,
    // ...). It must never create a reminder it can't attach to a real
    // opportunity: an opportunity_id:null / task_type:null row is
    // indistinguishable from a genuine manual company task, so it can
    // never be completed when that opportunity later closes (see the
    // RC-03 diagnostic report — this is exactly how the 4 orphan
    // reminders were produced). When there's no real opportunity context
    // (payload.opportunityId missing) or no matching task type, no
    // reminder is created at all — not "created without a link".
    if (
      payload.companyId &&
      payload.opportunityId &&
      nextTask &&
      nextTaskType &&
      reminderDate
    ) {
      await createActiveReminderIfAbsent({
        companyId: payload.companyId,
        opportunityId:
          payload.opportunityId,
        taskType: nextTaskType,
        title: nextTask,
        dueDate: reminderDate,
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
      const nextStage = getNextStage(
        payload.actionId,
      );

      let currentStage:
        | string
        | null
        | undefined;

      if (nextStage !== null) {
        try {
          const currentOpportunity =
            await getOpportunity(
              payload.opportunityId,
            );

          currentStage =
            currentOpportunity?.stage;
        } catch (lookupError) {
          console.error(
            "Opportunity stage lookup error:",
            lookupError,
          );
        }
      }

      const opportunityUpdate =
        buildOpportunityUpdate(
          nextStage,
          currentStage,
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

function getNextTaskType(
  actionId?: string,
): string | null {
  const normalizedActionId =
    actionId
      ?.trim()
      .toLowerCase() ?? "";

  switch (normalizedActionId) {
    case "information-package":
      return "information-package-follow-up";
    case "quotation":
      return "quotation-feedback";
    case "revised-quotation":
      return "final-offer-negotiation";
    case "contract":
      return "signed-contract-tracking";
    case "make-call":
    case "call":
    case "follow-up":
    case "follow-up-call":
    case "planned-call":
    case "phone-call":
      return "call-result-review";
    default:
      return normalizedActionId.includes("call")
        ? "call-result-review"
        : null;
  }
}
