import { publish } from "./eventBus";
import { buildExecutionResult } from "./executionEngine";
import { initializeExecutionListeners } from "./executionListeners";
import { mapActionToEvent } from "./eventMapper";
import { buildMemoryEntry } from "./memoryBuilder";
import { buildTimelineEvent } from "./timelineBuilder";

initializeExecutionListeners();

export type WorkflowCompletionFeedback = {
  feedbackType:
    "workflow-task-completed";
  taskId: string;
  taskType: string;
  taskSource: string;
  taskPhase: string;
  taskPriority: string;
  atlasRecommendedTaskId:
    | string
    | null;
  wasAtlasRecommended: boolean;
  wasManuallySelected: boolean;
  startedAt: string | null;
  completedAt: string;
  durationSeconds: number | null;
  taskScore: number | null;
  taskScorePriority: string | null;
  aiConfidence: number | null;
  aiRisk: boolean;
  aiRecommended: boolean;
};

export type ExecuteActionInput = {
  actionId: string;
  title: string;
  companyId: string;
  opportunityId?: string | null;
  reminderId?: string | null;
  description?: string | null;
  workflowFeedback?:
    WorkflowCompletionFeedback;
};

function normalizeValue(
  value: string | null | undefined,
) {
  return value?.trim() ?? "";
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    normalizeValue(value);

  return normalizedValue || null;
}

function normalizeOptionalNumber(
  value: number | null | undefined,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return value;
}

function normalizeWorkflowFeedback(
  feedback:
    | WorkflowCompletionFeedback
    | undefined,
):
  | WorkflowCompletionFeedback
  | undefined {
  if (!feedback) {
    return undefined;
  }

  return {
    feedbackType:
      "workflow-task-completed",
    taskId:
      normalizeValue(
        feedback.taskId,
      ),
    taskType:
      normalizeValue(
        feedback.taskType,
      ),
    taskSource:
      normalizeValue(
        feedback.taskSource,
      ),
    taskPhase:
      normalizeValue(
        feedback.taskPhase,
      ),
    taskPriority:
      normalizeValue(
        feedback.taskPriority,
      ),
    atlasRecommendedTaskId:
      normalizeOptionalString(
        feedback.atlasRecommendedTaskId,
      ),
    wasAtlasRecommended:
      feedback.wasAtlasRecommended ===
      true,
    wasManuallySelected:
      feedback.wasManuallySelected ===
      true,
    startedAt:
      normalizeOptionalString(
        feedback.startedAt,
      ),
    completedAt:
      normalizeValue(
        feedback.completedAt,
      ) ||
      new Date().toISOString(),
    durationSeconds:
      normalizeOptionalNumber(
        feedback.durationSeconds,
      ),
    taskScore:
      normalizeOptionalNumber(
        feedback.taskScore,
      ),
    taskScorePriority:
      normalizeOptionalString(
        feedback.taskScorePriority,
      ),
    aiConfidence:
      normalizeOptionalNumber(
        feedback.aiConfidence,
      ),
    aiRisk:
      feedback.aiRisk === true,
    aiRecommended:
      feedback.aiRecommended === true,
  };
}

function buildActionDescription(
  actionId: string,
  title: string,
) {
  const searchableValue =
    `${actionId} ${title}`.toLowerCase();

  if (
    searchableValue.includes(
      "information-package",
    ) ||
    searchableValue.includes(
      "information package",
    )
  ) {
    return "The information package was sent to the customer.";
  }

  if (
    searchableValue.includes(
      "revised-quotation",
    ) ||
    searchableValue.includes(
      "revised quotation",
    )
  ) {
    return "A revised quotation was sent to the customer.";
  }

  if (
    searchableValue.includes(
      "quotation",
    ) ||
    searchableValue.includes(
      "quote",
    )
  ) {
    return "A quotation was sent to the customer.";
  }

  if (
    searchableValue.includes(
      "contract",
    )
  ) {
    return "The contract was sent to the customer for review.";
  }

  if (
    searchableValue.includes(
      "additional-document",
    ) ||
    searchableValue.includes(
      "additional document",
    )
  ) {
    return "The requested additional documents were sent to the customer.";
  }

  if (
    searchableValue.includes(
      "follow-up-call",
    ) ||
    searchableValue.includes(
      "follow up call",
    ) ||
    searchableValue.includes(
      "follow-up call",
    )
  ) {
    return "The customer follow-up call was completed.";
  }

  if (
    searchableValue.includes(
      "call",
    ) ||
    searchableValue.includes(
      "phone",
    )
  ) {
    return (
      "The customer call was completed. The call " +
      "outcome and agreed next action were recorded."
    );
  }

  if (
    searchableValue.includes(
      "schedule-meeting",
    ) ||
    searchableValue.includes(
      "schedule meeting",
    ) ||
    searchableValue.includes(
      "meeting",
    )
  ) {
    return "A customer meeting was scheduled.";
  }

  if (
    searchableValue.includes(
      "thank-you",
    ) ||
    searchableValue.includes(
      "thank you",
    )
  ) {
    return (
      "A thank-you message was sent to the customer. " +
      "The completed interaction was recorded in the " +
      "customer history."
    );
  }

  if (
    searchableValue.includes(
      "email",
    ) ||
    searchableValue.includes(
      "mail",
    )
  ) {
    return (
      "The customer email was sent successfully. " +
      "The communication was recorded for future " +
      "follow-up and opportunity context."
    );
  }

  return (
    `${title} was completed successfully. ` +
    "The result was recorded in the customer timeline " +
    "and VIAWA memory."
  );
}

export async function executeAction({
  actionId,
  title,
  companyId,
  opportunityId,
  reminderId,
  description: descriptionOverride,
  workflowFeedback,
}: ExecuteActionInput) {
  const normalizedActionId =
    normalizeValue(actionId);

  const normalizedTitle =
    normalizeValue(title);

  const normalizedCompanyId =
    normalizeValue(companyId);

  const normalizedOpportunityId =
    normalizeValue(
      opportunityId,
    ) || undefined;

  const normalizedReminderId =
    normalizeValue(
      reminderId,
    ) || undefined;

  const normalizedWorkflowFeedback =
    normalizeWorkflowFeedback(
      workflowFeedback,
    );

  if (!normalizedActionId) {
    throw new Error(
      "Action ID is required.",
    );
  }

  if (!normalizedTitle) {
    throw new Error(
      "Action title is required.",
    );
  }

  if (!normalizedCompanyId) {
    throw new Error(
      "Company ID is required.",
    );
  }

  const eventType =
    mapActionToEvent(
      normalizedActionId,
    );

  const description =
    normalizeValue(descriptionOverride) ||
    buildActionDescription(
      normalizedActionId,
      normalizedTitle,
    );

  const timeline =
    buildTimelineEvent(
      normalizedTitle,
      description,
      eventType,
    );

  const memory =
    buildMemoryEntry(
      normalizedTitle,
      description,
      eventType,
    );

  const result =
    buildExecutionResult(
      normalizedActionId,
      normalizedTitle,
    );

  const completedAt =
    new Date().toISOString();

  await publish({
    type: eventType,
    payload: {
      actionId:
        normalizedActionId,
      title:
        normalizedTitle,
      companyId:
        normalizedCompanyId,
      opportunityId:
        normalizedOpportunityId,
      reminderId:
        normalizedReminderId,
      completedAt,
      result,
      timeline,
      memory,
      workflowFeedback:
        normalizedWorkflowFeedback,
    },
  });

  return {
    actionId:
      normalizedActionId,
    title:
      normalizedTitle,
    companyId:
      normalizedCompanyId,
    opportunityId:
      normalizedOpportunityId,
    reminderId:
      normalizedReminderId,
    eventType,
    completedAt,
    result,
    timeline,
    memory,
    workflowFeedback:
      normalizedWorkflowFeedback,
  };
}
