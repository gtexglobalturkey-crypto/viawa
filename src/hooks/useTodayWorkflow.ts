import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import { WorkflowController } from "../core/workflow/WorkflowController";

import type {
  WorkflowEngineResult,
  WorkflowState,
  WorkflowTask,
} from "../core/workflow/workflowTypes";

import { executeAction } from "../features/execution";

type ReloadTodayData = () => Promise<void>;

type UseTodayWorkflowResult = {
  currentTask: WorkflowTask | null;
  atlasRecommendedTask: WorkflowTask | null;
  queue: WorkflowTask[];
  completing: boolean;
  isUsingCustomTask: boolean;
  completeTask: () => Promise<void>;
  startTask: () => void;
  selectTask: (task: WorkflowTask) => void;
  resetToRecommendation: () => void;
};

type WorkflowCompletionFeedback = {
  feedbackType: "workflow-task-completed";
  taskId: string;
  taskType: string;
  taskSource: string;
  taskPhase: string;
  taskPriority: string;
  atlasRecommendedTaskId: string | null;
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

type ExecuteActionInput =
  Parameters<typeof executeAction>[0];

type ExecuteActionInputWithFeedback =
  ExecuteActionInput & {
    workflowFeedback:
      WorkflowCompletionFeedback;
  };

const workflowController =
  new WorkflowController();

function createWorkflowState(
  workflow: WorkflowEngineResult,
  completedTaskIds: string[],
): WorkflowState {
  const remainingQueue =
    workflow.queue.filter(
      (task) =>
        !completedTaskIds.includes(
          task.id,
        ),
    );

  return {
    generatedAt:
      new Date().toISOString(),
    currentPhase:
      workflow.currentPhase,
    currentTask:
      remainingQueue[0] ?? null,
    queue: remainingQueue,
    completedTaskIds,
    skippedTaskIds: [],
    plannedWorkCompleted:
      workflow.plannedWorkCompleted,
    suggestedWorkActive:
      workflow.suggestedWorkActive,
  };
}

function mapWorkflowTaskToActionId(
  task: WorkflowTask,
): string {
  switch (task.type) {
    case "reply-email":
      return "information-package";

    case "send-quotation":
      return "quotation";

    case "follow-up-quotation":
      return "revised-quotation";

    case "follow-up-contract":
      return "contract";

    case "relationship-check-in":
      return "thank-you";

    default:
      return task.type;
  }
}

function getTaskRoute(
  task: WorkflowTask,
): string {
  const companyId =
    task.action.entityReference
      ?.companyId;

  const searchParams =
    companyId
      ? `?companyId=${encodeURIComponent(
          companyId,
        )}`
      : "";

  switch (task.type) {
    case "reply-email":
    case "send-quotation":
    case "follow-up-quotation":
    case "follow-up-contract":
      return `/communication${searchParams}`;

    case "relationship-check-in":
    default:
      return `/call${searchParams}`;
  }
}

function readMetadataNumber(
  task: WorkflowTask,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value =
      task.metadata?.[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      const parsedValue =
        Number(
          value
            .trim()
            .replace("%", ""),
        );

      if (
        Number.isFinite(parsedValue)
      ) {
        return parsedValue;
      }
    }
  }

  return null;
}

function readMetadataString(
  task: WorkflowTask,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value =
      task.metadata?.[key];

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value.trim();
    }
  }

  return null;
}

function readMetadataBoolean(
  task: WorkflowTask,
  ...keys: string[]
): boolean {
  for (const key of keys) {
    const value =
      task.metadata?.[key];

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
      const normalizedValue =
        value.trim().toLowerCase();

      if (
        normalizedValue === "true" ||
        normalizedValue === "yes" ||
        normalizedValue === "1" ||
        normalizedValue === "high" ||
        normalizedValue ===
          "critical" ||
        normalizedValue ===
          "recommended"
      ) {
        return true;
      }

      if (
        normalizedValue === "false" ||
        normalizedValue === "no" ||
        normalizedValue === "0" ||
        normalizedValue === "none" ||
        normalizedValue === "low" ||
        normalizedValue === "safe"
      ) {
        return false;
      }
    }
  }

  return false;
}

function createCompletionFeedback(
  task: WorkflowTask,
  atlasRecommendedTask:
    | WorkflowTask
    | null,
  selectedTaskId: string | null,
  startedAt: string | null,
): WorkflowCompletionFeedback {
  const completedAt =
    new Date().toISOString();

  const startedTimestamp =
    startedAt
      ? new Date(startedAt).getTime()
      : Number.NaN;

  const completedTimestamp =
    new Date(completedAt).getTime();

  const durationSeconds =
    Number.isNaN(startedTimestamp)
      ? null
      : Math.max(
          0,
          Math.round(
            (
              completedTimestamp -
              startedTimestamp
            ) / 1000,
          ),
        );

  const wasAtlasRecommended =
    atlasRecommendedTask?.id ===
    task.id;

  const wasManuallySelected =
    selectedTaskId !== null &&
    selectedTaskId === task.id &&
    !wasAtlasRecommended;

  return {
    feedbackType:
      "workflow-task-completed",
    taskId: task.id,
    taskType: task.type,
    taskSource: task.source,
    taskPhase: task.phase,
    taskPriority: task.priority,
    atlasRecommendedTaskId:
      atlasRecommendedTask?.id ??
      null,
    wasAtlasRecommended,
    wasManuallySelected,
    startedAt,
    completedAt,
    durationSeconds,
    taskScore:
      readMetadataNumber(
        task,
        "taskScoreValue",
      ),
    taskScorePriority:
      readMetadataString(
        task,
        "taskScorePriority",
      ),
    aiConfidence:
      readMetadataNumber(
        task,
        "aiConfidence",
        "ai_confidence",
      ),
    aiRisk:
      readMetadataBoolean(
        task,
        "aiRisk",
        "ai_risk",
      ),
    aiRecommended:
      readMetadataBoolean(
        task,
        "aiRecommended",
        "ai_recommended",
      ),
  };
}

export function useTodayWorkflow(
  workflow: WorkflowEngineResult,
  reloadTodayData: ReloadTodayData,
): UseTodayWorkflowResult {
  const navigate = useNavigate();

  const [
    completedTaskIds,
    setCompletedTaskIds,
  ] = useState<string[]>([]);

  const [
    selectedTaskId,
    setSelectedTaskId,
  ] = useState<string | null>(
    null,
  );

  const [
    completing,
    setCompleting,
  ] = useState(false);

  const taskStartedAtRef =
    useRef<
      Record<string, string>
    >({});

  const workflowState =
    useMemo(
      () =>
        createWorkflowState(
          workflow,
          completedTaskIds,
        ),
      [
        workflow,
        completedTaskIds,
      ],
    );

  const atlasRecommendedTask =
    workflowState.currentTask;

  const selectedTask =
    selectedTaskId
      ? workflowState.queue.find(
          (task) =>
            task.id === selectedTaskId,
        ) ?? null
      : null;

  const currentTask =
    selectedTask ??
    atlasRecommendedTask;

  const isUsingCustomTask =
    Boolean(
      selectedTask &&
        atlasRecommendedTask &&
        selectedTask.id !==
          atlasRecommendedTask.id,
    );

  async function completeTask() {
    if (
      !currentTask ||
      completing
    ) {
      return;
    }

    const taskToComplete =
      currentTask;

    const companyId =
      taskToComplete.action
        .entityReference
        ?.companyId;

    const opportunityId =
      taskToComplete.action
        .entityReference
        ?.opportunityId;

    const reminderId =
      taskToComplete.action
        .entityReference
        ?.reminderId;

    if (!companyId) {
      console.error(
        "Workflow task cannot be completed because companyId is missing.",
        taskToComplete,
      );

      return;
    }

    const startedAt =
      taskStartedAtRef.current[
        taskToComplete.id
      ] ?? null;

    const workflowFeedback =
      createCompletionFeedback(
        taskToComplete,
        atlasRecommendedTask,
        selectedTaskId,
        startedAt,
      );

    setCompleting(true);

    try {
      const actionInput = {
        actionId:
          mapWorkflowTaskToActionId(
            taskToComplete,
          ),
        title:
          taskToComplete.title,
        companyId,
        opportunityId,
        reminderId,
        workflowFeedback,
      } satisfies
        ExecuteActionInputWithFeedback;

      await executeAction(
        actionInput,
      );

      const result =
        await workflowController.completeTask(
          taskToComplete,
          {
            ...workflowState,
            currentTask:
              taskToComplete,
          },
        );

      const nextCompletedTaskIds =
        result.state.completedTaskIds.includes(
          taskToComplete.id,
        )
          ? result.state
              .completedTaskIds
          : [
              ...result.state
                .completedTaskIds,
              taskToComplete.id,
            ];

      setCompletedTaskIds(
        nextCompletedTaskIds,
      );

      delete taskStartedAtRef.current[
        taskToComplete.id
      ];

      setSelectedTaskId(null);

      await reloadTodayData();
    } catch (error) {
      console.error(
        "Workflow task completion failed:",
        error,
      );
    } finally {
      setCompleting(false);
    }
  }

  function startTask() {
    if (!currentTask) {
      return;
    }

    if (
      !taskStartedAtRef.current[
        currentTask.id
      ]
    ) {
      taskStartedAtRef.current[
        currentTask.id
      ] =
        new Date().toISOString();
    }

    navigate(
      getTaskRoute(currentTask),
    );
  }

  function selectTask(
    task: WorkflowTask,
  ) {
    setSelectedTaskId(task.id);
  }

  function resetToRecommendation() {
    setSelectedTaskId(null);
  }

  return {
    currentTask,
    atlasRecommendedTask,
    queue: workflowState.queue,
    completing,
    isUsingCustomTask,
    completeTask,
    startTask,
    selectTask,
    resetToRecommendation,
  };
}