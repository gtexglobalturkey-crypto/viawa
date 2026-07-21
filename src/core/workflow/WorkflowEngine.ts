import { SuggestedWorkGenerator } from "./SuggestedWorkGenerator";
import { TaskScoreEngine } from "./TaskScoreEngine";

import type {
  WorkflowCompletionResult,
  WorkflowEngineResult,
  WorkflowGenerationContext,
  WorkflowPhase,
  WorkflowState,
  WorkflowTask,
  WorkflowTaskCandidate,
  WorkflowTaskPriority,
} from "./workflowTypes";

type UnknownRecord = Record<string, unknown>;

type AiTaskMetadata = {
  aiConfidence?: number;
  aiRisk?: boolean;
  aiRecommended?: boolean;
};

type AiMemoryIndex = Map<
  string,
  UnknownRecord[]
>;

export class WorkflowEngine {
  private readonly suggestedWorkGenerator =
    new SuggestedWorkGenerator();

  private readonly taskScoreEngine =
    new TaskScoreEngine();

  generate(
    context: WorkflowGenerationContext,
  ): WorkflowEngineResult {
    const plannedTasks =
      this.collectTasks(context);

    const plannedQueue =
      this.prepareQueue(plannedTasks);

    const plannedWorkCompleted =
      this.isPlannedWorkCompleted(
        plannedQueue,
      );

    const generatedTasks =
      plannedWorkCompleted
        ? this.suggestedWorkGenerator.generate(
            context,
          )
        : [];

    const queue = this.prepareQueue([
      ...plannedQueue,
      ...generatedTasks,
    ]);

    const currentTask =
      queue[0] ?? null;

    return {
      currentTask,
      queue,
      currentPhase:
        currentTask?.phase ??
        "suggested-work",
      plannedWorkCompleted,
      suggestedWorkActive:
        plannedWorkCompleted &&
        generatedTasks.length > 0,
    };
  }

  completeTask(
    task: WorkflowTask,
    state: WorkflowState,
  ): WorkflowCompletionResult {
    const completedTaskIds = [
      ...state.completedTaskIds,
      task.id,
    ];

    const queue = state.queue.filter(
      (queueTask) =>
        queueTask.id !== task.id,
    );

    const nextTask = queue[0] ?? null;

    const plannedWorkCompleted =
      this.isPlannedWorkCompleted(queue);

    const suggestedWorkActive =
      queue.some(
        (queueTask) =>
          queueTask.phase ===
          "suggested-work",
      );

    return {
      completedTask: task,
      nextTask,
      state: {
        ...state,
        completedTaskIds,
        currentTask: nextTask,
        currentPhase:
          nextTask?.phase ??
          "suggested-work",
        queue,
        plannedWorkCompleted,
        suggestedWorkActive,
      },
    };
  }

  private collectTasks(
    context: WorkflowGenerationContext,
  ): WorkflowTask[] {
    const aiMemoryIndex =
      this.createAiMemoryIndex(
        context.aiMemory ?? [],
      );

    const emailTasks =
      this.collectEmailTasks(
        context.emails,
        context.now,
        aiMemoryIndex,
      );

    const reminderTasks =
      this.collectReminderTasks(
        context.reminders,
        context.now,
        aiMemoryIndex,
      );

    const opportunityTasks =
      this.collectOpportunityTasks(
        context.opportunities,
        context.now,
        reminderTasks,
        aiMemoryIndex,
      );

    return [
      ...emailTasks,
      ...reminderTasks,
      ...opportunityTasks,
    ];
  }

  private prepareQueue(
    tasks: WorkflowTask[],
  ): WorkflowTask[] {
    return this.sortTasks(
      this.scoreTasks(
        this.removeDuplicateTasks(tasks),
      ),
    );
  }

  private collectEmailTasks(
    emails: unknown[],
    now: string,
    aiMemoryIndex: AiMemoryIndex,
  ): WorkflowTask[] {
    return emails
      .map((email) =>
        this.toRecord(email),
      )
      .filter(
        (email): email is UnknownRecord =>
          email !== null,
      )
      .filter((email) =>
        this.isPendingEmail(email),
      )
      .map((email, index) => {
        const emailId =
          this.readString(
            email,
            "id",
            "emailId",
            "email_id",
          ) ?? `pending-email-${index}`;

        const companyId =
          this.readString(
            email,
            "companyId",
            "company_id",
          );

        const opportunityId =
          this.readString(
            email,
            "opportunityId",
            "opportunity_id",
          );

        const companyName =
          this.cleanCompanyName(
            this.readString(
              email,
              "companyName",
              "company_name",
            ) ?? "Customer",
          );

        const contactName =
          this.cleanOptionalStoredText(
            this.readString(
              email,
              "contactName",
              "contact_name",
              "recipientName",
              "recipient_name",
            ),
          );

        const subject =
          this.cleanStoredText(
            this.readString(
              email,
              "subject",
            ) ?? "Pending email",
          );

        const createdAt =
          this.readString(
            email,
            "createdAt",
            "created_at",
          ) ?? now;

        const aiMetadata =
          this.getAiTaskMetadata(
            companyId,
            aiMemoryIndex,
          );

        return {
          id: `email-${emailId}`,
          source: "email",
          type: "reply-email",
          phase: "inbox-first",
          status: "pending",
          priority: "critical",
          title: `Complete email: ${subject}`,
          description:
            contactName !== undefined
              ? `${contactName} at ${companyName}`
              : companyName,
          reason:
            "Pending customer communication should be handled before starting other work.",
          companyName,
          contactName,
          createdAt,
          estimatedMinutes: 5,
          action: {
            label: "Open email",
            route: "/communication",
            entityReference: {
              companyId,
              opportunityId,
              emailId,
            },
          },
          metadata: {
            ...aiMetadata,
          },
        } satisfies WorkflowTask;
      });
  }

  private collectReminderTasks(
    reminders: unknown[],
    now: string,
    aiMemoryIndex: AiMemoryIndex,
  ): WorkflowTask[] {
    return reminders
      .map((reminder) =>
        this.toRecord(reminder),
      )
      .filter(
        (
          reminder,
        ): reminder is UnknownRecord =>
          reminder !== null,
      )
      .filter((reminder) =>
        this.isPendingReminder(reminder),
      )
      .map((reminder, index) => {
        const reminderId =
          this.readString(
            reminder,
            "id",
            "reminderId",
            "reminder_id",
          ) ?? `reminder-${index}`;

        const companyId =
          this.readString(
            reminder,
            "companyId",
            "company_id",
          );

        const opportunityId =
          this.readString(
            reminder,
            "opportunityId",
            "opportunity_id",
          );

        const companyName =
          this.cleanCompanyName(
            this.readString(
              reminder,
              "companyName",
              "company_name",
            ) ?? "Customer",
          );

        const contactName =
          this.cleanOptionalStoredText(
            this.readString(
              reminder,
              "contactName",
              "contact_name",
            ),
          );

        const title =
          this.normalizeTaskTitle(
            this.readString(
              reminder,
              "title",
            ) ?? `Call ${companyName}`,
          );

        const scheduledAt =
          this.readString(
            reminder,
            "scheduledAt",
            "scheduled_at",
            "dueAt",
            "due_at",
            "remindAt",
            "remind_at",
          );

        const createdAt =
          this.readString(
            reminder,
            "createdAt",
            "created_at",
          ) ?? now;

        const priority =
          this.getTimeBasedPriority(
            scheduledAt,
            now,
          );

        const aiMetadata =
          this.getAiTaskMetadata(
            companyId,
            aiMemoryIndex,
          );

        return {
          id: `reminder-${reminderId}`,
          source: "planned-call",
          type: "make-call",
          phase: "planned-calls",
          status: "pending",
          priority,
          title,
          description:
            contactName !== undefined
              ? `${contactName} at ${companyName}`
              : companyName,
          reason:
            priority === "critical"
              ? "This planned activity is overdue."
              : "This activity is part of today's planned work.",
          companyName,
          contactName,
          scheduledAt,
          dueAt: scheduledAt,
          createdAt,
          estimatedMinutes: 10,
          action: {
            label: "Start call",
            route:
              companyId !== undefined
                ? `/call?companyId=${companyId}`
                : "/call",
            entityReference: {
              companyId,
              opportunityId,
              reminderId,
            },
          },
          metadata: {
            ...aiMetadata,
          },
        } satisfies WorkflowTask;
      });
  }

  private collectOpportunityTasks(
    opportunities: unknown[],
    now: string,
    reminderTasks: WorkflowTask[],
    aiMemoryIndex: AiMemoryIndex,
  ): WorkflowTask[] {
    return opportunities
      .map((opportunity) =>
        this.toRecord(opportunity),
      )
      .filter(
        (
          opportunity,
        ): opportunity is UnknownRecord =>
          opportunity !== null,
      )
      .filter((opportunity) =>
        this.requiresFollowUp(opportunity),
      )
      .filter(
        (opportunity) =>
          !this.hasMatchingReminderTask(
            opportunity,
            reminderTasks,
          ),
      )
      .map((opportunity, index) => {
        const opportunityId =
          this.readString(
            opportunity,
            "id",
            "opportunityId",
            "opportunity_id",
          ) ?? `opportunity-${index}`;

        const companyId =
          this.readString(
            opportunity,
            "companyId",
            "company_id",
          );

        const companyName =
          this.cleanCompanyName(
            this.readString(
              opportunity,
              "companyName",
              "company_name",
            ) ?? "Customer",
          );

        const opportunityTitle =
          this.cleanStoredText(
            this.readString(
              opportunity,
              "title",
              "opportunityTitle",
              "opportunity_title",
            ) ?? "Sales opportunity",
          );

        const stage =
          this.readString(
            opportunity,
            "stage",
          ) ?? "contacted";

        const nextAction =
          this.cleanOptionalTaskTitle(
            this.readString(
              opportunity,
              "nextAction",
              "next_action",
            ),
          );

        const dueAt =
          this.readString(
            opportunity,
            "nextActivityAt",
            "next_activity_at",
            "followUpAt",
            "follow_up_at",
            "dueAt",
            "due_at",
          );

        const createdAt =
          this.readString(
            opportunity,
            "createdAt",
            "created_at",
          ) ?? now;

        const taskType =
          stage === "quotation-sent"
            ? "follow-up-quotation"
            : stage === "contract"
              ? "follow-up-contract"
              : "follow-up";

        const priority =
          this.getTimeBasedPriority(
            dueAt,
            now,
          );

        const aiMetadata =
          this.getAiTaskMetadata(
            companyId,
            aiMemoryIndex,
          );

        return {
          id: `opportunity-${opportunityId}`,
          source:
            stage === "quotation-requested"
              ? "quotation"
              : stage === "contract"
                ? "contract"
                : "follow-up",
          type: taskType,
          phase: "follow-ups",
          status: "pending",
          priority,
          title:
            nextAction ??
            this.getOpportunityTaskTitle(
              stage,
              companyName,
            ),
          description: opportunityTitle,
          reason:
            priority === "critical"
              ? "This opportunity has an overdue next action."
              : "This active opportunity requires a clear next step.",
          companyName,
          opportunityTitle,
          dueAt,
          createdAt,
          estimatedMinutes:
            stage === "quotation-requested"
              ? 15
              : 10,
          action: {
            label:
              stage === "quotation-requested"
                ? "Prepare quotation"
                : "Open opportunity",
            route:
              companyId !== undefined
                ? `/companies/${companyId}`
                : "/companies",
            entityReference: {
              companyId,
              opportunityId,
            },
          },
          metadata: {
            stage,
            ...aiMetadata,
          },
        } satisfies WorkflowTask;
      });
  }

  private createAiMemoryIndex(
    aiMemories: unknown[],
  ): AiMemoryIndex {
    const index: AiMemoryIndex =
      new Map();

    for (const value of aiMemories) {
      const memory =
        this.toRecord(value);

      if (memory === null) {
        continue;
      }

      const companyId =
        this.findNestedString(
          memory,
          "companyId",
          "company_id",
        );

      if (companyId === undefined) {
        continue;
      }

      const existingMemories =
        index.get(companyId) ?? [];

      existingMemories.push(memory);

      index.set(
        companyId,
        existingMemories,
      );
    }

    for (const memories of index.values()) {
      memories.sort(
        (firstMemory, secondMemory) =>
          this.getAiMemoryTimestamp(
            secondMemory,
          ) -
          this.getAiMemoryTimestamp(
            firstMemory,
          ),
      );
    }

    return index;
  }

  private getAiTaskMetadata(
    companyId: string | undefined,
    aiMemoryIndex: AiMemoryIndex,
  ): AiTaskMetadata {
    if (companyId === undefined) {
      return {};
    }

    const memories =
      aiMemoryIndex.get(companyId);

    if (
      memories === undefined ||
      memories.length === 0
    ) {
      return {};
    }

    let aiConfidence:
      | number
      | undefined;

    let aiRisk:
      | boolean
      | undefined;

    let aiRecommended:
      | boolean
      | undefined;

    for (const memory of memories) {
      if (aiConfidence === undefined) {
        aiConfidence =
          this.readAiConfidence(memory);
      }

      if (aiRisk === undefined) {
        aiRisk =
          this.readAiRisk(memory);
      }

      if (aiRecommended === undefined) {
        aiRecommended =
          this.readAiRecommended(memory);
      }

      if (
        aiConfidence !== undefined &&
        aiRisk !== undefined &&
        aiRecommended !== undefined
      ) {
        break;
      }
    }

    return {
      ...(aiConfidence !== undefined
        ? { aiConfidence }
        : {}),
      ...(aiRisk !== undefined
        ? { aiRisk }
        : {}),
      ...(aiRecommended !== undefined
        ? { aiRecommended }
        : {}),
    };
  }

  private readAiConfidence(
    memory: UnknownRecord,
  ): number | undefined {
    const value =
      this.findNestedValue(
        memory,
        "aiConfidence",
        "ai_confidence",
        "confidence",
        "confidenceScore",
        "confidence_score",
      );

    return this.normalizeConfidence(
      value,
    );
  }

  private readAiRisk(
    memory: UnknownRecord,
  ): boolean | undefined {
    const value =
      this.findNestedValue(
        memory,
        "aiRisk",
        "ai_risk",
        "riskDetected",
        "risk_detected",
        "hasRisk",
        "has_risk",
        "risk",
        "riskLevel",
        "risk_level",
        "riskScore",
        "risk_score",
      );

    return this.normalizeRisk(value);
  }

  private readAiRecommended(
    memory: UnknownRecord,
  ): boolean | undefined {
    const value =
      this.findNestedValue(
        memory,
        "aiRecommended",
        "ai_recommended",
        "recommended",
        "isRecommended",
        "is_recommended",
        "recommendation",
        "recommendedAction",
        "recommended_action",
        "nextBestAction",
        "next_best_action",
      );

    return this.normalizeRecommended(
      value,
    );
  }

  private normalizeConfidence(
    value: unknown,
  ): number | undefined {
    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      if (value <= 1) {
        return Math.round(
          Math.max(0, value) * 100,
        );
      }

      return Math.round(
        Math.min(
          100,
          Math.max(0, value),
        ),
      );
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized =
      value.trim().toLowerCase();

    if (normalized.length === 0) {
      return undefined;
    }

    const numericValue =
      Number(
        normalized.replace("%", ""),
      );

    if (Number.isFinite(numericValue)) {
      if (
        !normalized.includes("%") &&
        numericValue <= 1
      ) {
        return Math.round(
          Math.max(0, numericValue) *
            100,
        );
      }

      return Math.round(
        Math.min(
          100,
          Math.max(0, numericValue),
        ),
      );
    }

    switch (normalized) {
      case "high":
      case "very high":
        return 90;

      case "medium":
      case "moderate":
        return 60;

      case "low":
        return 30;

      default:
        return undefined;
    }
  }

  private normalizeRisk(
    value: unknown,
  ): boolean | undefined {
    if (typeof value === "boolean") {
      return value;
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value > 0;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized =
      value.trim().toLowerCase();

    if (normalized.length === 0) {
      return undefined;
    }

    if (
      normalized === "false" ||
      normalized === "none" ||
      normalized === "no" ||
      normalized === "safe" ||
      normalized === "low" ||
      normalized === "0"
    ) {
      return false;
    }

    if (
      normalized === "true" ||
      normalized === "yes" ||
      normalized === "risk" ||
      normalized === "at risk" ||
      normalized === "medium" ||
      normalized === "moderate" ||
      normalized === "high" ||
      normalized === "critical" ||
      normalized === "1"
    ) {
      return true;
    }

    return false;
  }

  private normalizeRecommended(
    value: unknown,
  ): boolean | undefined {
    if (typeof value === "boolean") {
      return value;
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value > 0;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized =
      value.trim().toLowerCase();

    if (normalized.length === 0) {
      return undefined;
    }

    if (
      normalized === "false" ||
      normalized === "no" ||
      normalized === "none" ||
      normalized === "not recommended" ||
      normalized === "0"
    ) {
      return false;
    }

    return true;
  }

  private getAiMemoryTimestamp(
    memory: UnknownRecord,
  ): number {
    const dateValue =
      this.findNestedString(
        memory,
        "updatedAt",
        "updated_at",
        "createdAt",
        "created_at",
        "timestamp",
      );

    if (dateValue === undefined) {
      return 0;
    }

    const timestamp =
      new Date(dateValue).getTime();

    return Number.isNaN(timestamp)
      ? 0
      : timestamp;
  }

  private findNestedString(
    record: UnknownRecord,
    ...keys: string[]
  ): string | undefined {
    const value =
      this.findNestedValue(
        record,
        ...keys,
      );

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value.trim();
    }

    return undefined;
  }

  private findNestedValue(
    record: UnknownRecord,
    ...keys: string[]
  ): unknown {
    const visited =
      new Set<unknown>();

    return this.searchNestedValue(
      record,
      keys,
      visited,
      0,
    );
  }

  private searchNestedValue(
    value: unknown,
    keys: string[],
    visited: Set<unknown>,
    depth: number,
  ): unknown {
    if (
      depth > 5 ||
      typeof value !== "object" ||
      value === null ||
      visited.has(value)
    ) {
      return undefined;
    }

    visited.add(value);

    if (!Array.isArray(value)) {
      const record =
        value as UnknownRecord;

      for (const key of keys) {
        if (
          Object.prototype.hasOwnProperty.call(
            record,
            key,
          )
        ) {
          const matchedValue =
            record[key];

          if (
            matchedValue !== undefined &&
            matchedValue !== null
          ) {
            return matchedValue;
          }
        }
      }

      for (const nestedValue of Object.values(
        record,
      )) {
        const result =
          this.searchNestedValue(
            nestedValue,
            keys,
            visited,
            depth + 1,
          );

        if (result !== undefined) {
          return result;
        }
      }

      return undefined;
    }

    for (const nestedValue of value) {
      const result =
        this.searchNestedValue(
          nestedValue,
          keys,
          visited,
          depth + 1,
        );

      if (result !== undefined) {
        return result;
      }
    }

    return undefined;
  }

  private hasMatchingReminderTask(
    opportunity: UnknownRecord,
    reminderTasks: WorkflowTask[],
  ): boolean {
    const opportunityId =
      this.readString(
        opportunity,
        "id",
        "opportunityId",
        "opportunity_id",
      );

    const companyId =
      this.readString(
        opportunity,
        "companyId",
        "company_id",
      );

    const companyName =
      this.readString(
        opportunity,
        "companyName",
        "company_name",
      );

    return reminderTasks.some(
      (reminderTask) => {
        const entityReference =
          reminderTask.action.entityReference;

        const reminderOpportunityId =
          entityReference?.opportunityId;

        const reminderCompanyId =
          entityReference?.companyId;

        if (
          opportunityId !== undefined &&
          reminderOpportunityId !== undefined
        ) {
          return (
            opportunityId ===
            reminderOpportunityId
          );
        }

        if (
          companyId !== undefined &&
          reminderCompanyId !== undefined
        ) {
          return (
            companyId ===
            reminderCompanyId
          );
        }

        if (
          companyName !== undefined &&
          reminderTask.companyName !==
            undefined
        ) {
          return (
            this.normalizeText(companyName) ===
            this.normalizeText(
              reminderTask.companyName,
            )
          );
        }

        return false;
      },
    );
  }

  private scoreTasks(
    tasks: WorkflowTask[],
  ): WorkflowTaskCandidate[] {
    return tasks.map((task) => {
      const taskScore =
        this.taskScoreEngine.score(task);

      return {
        ...task,
        score:
          this.calculateScore(task) +
          taskScore.score,
        metadata: {
          ...(task.metadata ?? {}),
          taskScoreValue:
            taskScore.score,
          taskScorePriority:
            taskScore.priority,
          taskScoreReasons:
            JSON.stringify(
              taskScore.reasons,
            ),
          taskScoreBadges:
            JSON.stringify(
              taskScore.badges,
            ),
        },
      } satisfies WorkflowTaskCandidate;
    });
  }

  private calculateScore(
    task: WorkflowTask,
  ): number {
    return (
      this.getPriorityScore(task.priority) +
      this.getPhaseScore(task.phase) +
      this.getOverdueScore(task)
    );
  }

  private getPriorityScore(
    priority: WorkflowTaskPriority,
  ): number {
    switch (priority) {
      case "critical":
        return 1000;

      case "high":
        return 700;

      case "medium":
        return 400;

      case "low":
        return 100;
    }
  }

  private getPhaseScore(
    phase: WorkflowPhase,
  ): number {
    switch (phase) {
      case "inbox-first":
        return 500;

      case "planned-calls":
        return 400;

      case "customer-responses":
        return 300;

      case "follow-ups":
        return 200;

      case "suggested-work":
        return 100;
    }
  }

  private getOverdueScore(
    task: WorkflowTask,
  ): number {
    const dateValue =
      task.dueAt ?? task.scheduledAt;

    if (dateValue === undefined) {
      return 0;
    }

    const taskTime =
      new Date(dateValue).getTime();

    if (Number.isNaN(taskTime)) {
      return 0;
    }

    return taskTime < Date.now()
      ? 250
      : 0;
  }

  private sortTasks(
    tasks: WorkflowTaskCandidate[],
  ): WorkflowTask[] {
    return [...tasks]
      .sort((firstTask, secondTask) => {
        if (
          secondTask.score !==
          firstTask.score
        ) {
          return (
            secondTask.score -
            firstTask.score
          );
        }

        return (
          this.getTaskDate(firstTask) -
          this.getTaskDate(secondTask)
        );
      })
      .map((candidate) =>
        this.removeCandidateScore(candidate),
      );
  }

  private removeCandidateScore(
    candidate: WorkflowTaskCandidate,
  ): WorkflowTask {
    return {
      id: candidate.id,
      source: candidate.source,
      type: candidate.type,
      phase: candidate.phase,
      status: candidate.status,
      priority: candidate.priority,
      title: candidate.title,
      description: candidate.description,
      reason: candidate.reason,
      companyName: candidate.companyName,
      contactName: candidate.contactName,
      opportunityTitle:
        candidate.opportunityTitle,
      scheduledAt: candidate.scheduledAt,
      dueAt: candidate.dueAt,
      createdAt: candidate.createdAt,
      estimatedMinutes:
        candidate.estimatedMinutes,
      action: candidate.action,
      metadata: candidate.metadata,
    };
  }

  private getTaskDate(
    task: WorkflowTask,
  ): number {
    const dateValue =
      task.dueAt ??
      task.scheduledAt ??
      task.createdAt;

    const timestamp =
      new Date(dateValue).getTime();

    return Number.isNaN(timestamp)
      ? Number.MAX_SAFE_INTEGER
      : timestamp;
  }

  private isPendingEmail(
    email: UnknownRecord,
  ): boolean {
    const status =
      this.readString(
        email,
        "status",
      )?.toLowerCase() ?? "";

    const direction =
      this.readString(
        email,
        "direction",
      )?.toLowerCase();

    const requiresReply =
      this.readBoolean(
        email,
        "requiresReply",
        "requires_reply",
        "needsReply",
        "needs_reply",
      ) ?? false;

    const isDraft =
      status === "draft" ||
      status === "pending";

    const isIncomingReply =
      direction === "incoming" &&
      requiresReply;

    return isDraft || isIncomingReply;
  }

  private isPendingReminder(
    reminder: UnknownRecord,
  ): boolean {
    const completed =
      this.readBoolean(
        reminder,
        "completed",
        "isCompleted",
        "is_completed",
      ) ?? false;

    const status =
      this.readString(
        reminder,
        "status",
      )?.toLowerCase();

    return (
      !completed &&
      status !== "completed" &&
      status !== "cancelled"
    );
  }

  private requiresFollowUp(
    opportunity: UnknownRecord,
  ): boolean {
    const stage =
      this.readString(
        opportunity,
        "stage",
      )?.toLowerCase();

    const nextAction =
      this.readString(
        opportunity,
        "nextAction",
        "next_action",
      );

    const dueAt =
      this.readString(
        opportunity,
        "nextActivityAt",
        "next_activity_at",
        "followUpAt",
        "follow_up_at",
        "dueAt",
        "due_at",
      );

    if (
      stage === "signed" ||
      stage === "lost"
    ) {
      return false;
    }

    return (
      nextAction !== undefined ||
      dueAt !== undefined ||
      stage === "quotation-requested" ||
      stage === "quotation-sent" ||
      stage === "negotiation" ||
      stage === "contract"
    );
  }

  private getOpportunityTaskTitle(
    stage: string,
    companyName: string,
  ): string {
    switch (stage) {
      case "quotation-requested":
        return `Prepare quotation for ${companyName}`;

      case "quotation-sent":
        return `Follow up quotation with ${companyName}`;

      case "negotiation":
        return `Continue negotiation with ${companyName}`;

      case "contract":
        return `Follow up contract with ${companyName}`;

      default:
        return `Follow up with ${companyName}`;
    }
  }

  private getTimeBasedPriority(
    dateValue: string | undefined,
    now: string,
  ): WorkflowTaskPriority {
    if (dateValue === undefined) {
      return "medium";
    }

    const dueTime =
      new Date(dateValue).getTime();

    const nowTime =
      new Date(now).getTime();

    if (
      Number.isNaN(dueTime) ||
      Number.isNaN(nowTime)
    ) {
      return "medium";
    }

    if (dueTime < nowTime) {
      return "critical";
    }

    const difference =
      dueTime - nowTime;

    const oneDay =
      24 * 60 * 60 * 1000;

    if (difference <= oneDay) {
      return "high";
    }

    return "medium";
  }

  private isPlannedWorkCompleted(
    queue: WorkflowTask[],
  ): boolean {
    return !queue.some(
      (task) =>
        task.phase !== "suggested-work",
    );
  }

  private removeDuplicateTasks(
    tasks: WorkflowTask[],
  ): WorkflowTask[] {
    const uniqueTasks =
      new Map<string, WorkflowTask>();

    for (const task of tasks) {
      const duplicateKey =
        this.createTaskDuplicateKey(task);

      const existingTask =
        uniqueTasks.get(duplicateKey);

      if (existingTask === undefined) {
        uniqueTasks.set(
          duplicateKey,
          task,
        );

        continue;
      }

      if (
        this.shouldReplaceDuplicate(
          existingTask,
          task,
        )
      ) {
        uniqueTasks.set(
          duplicateKey,
          task,
        );
      }
    }

    return Array.from(
      uniqueTasks.values(),
    );
  }

  private createTaskDuplicateKey(
    task: WorkflowTask,
  ): string {
    const entityReference =
      task.action.entityReference;

    const opportunityId =
      entityReference?.opportunityId;

    if (opportunityId !== undefined) {
      return `opportunity:${opportunityId}`;
    }

    const reminderId =
      entityReference?.reminderId;

    if (reminderId !== undefined) {
      return `reminder:${reminderId}`;
    }

    const emailId =
      entityReference?.emailId;

    if (emailId !== undefined) {
      return `email:${emailId}`;
    }

    const companyId =
      entityReference?.companyId;

    if (companyId !== undefined) {
      return [
        "company",
        companyId,
        this.normalizeText(task.title),
      ].join(":");
    }

    return [
      "task",
      task.source,
      this.normalizeText(task.title),
      this.normalizeText(
        task.companyName ?? "",
      ),
    ].join(":");
  }

  private shouldReplaceDuplicate(
    existingTask: WorkflowTask,
    candidateTask: WorkflowTask,
  ): boolean {
    const existingRank =
      this.getSourceRank(existingTask);

    const candidateRank =
      this.getSourceRank(candidateTask);

    if (candidateRank !== existingRank) {
      return candidateRank > existingRank;
    }

    return (
      this.getPriorityScore(
        candidateTask.priority,
      ) >
      this.getPriorityScore(
        existingTask.priority,
      )
    );
  }

  private getSourceRank(
    task: WorkflowTask,
  ): number {
    switch (task.source) {
      case "email":
        return 400;

      case "planned-call":
        return 300;

      case "quotation":
        return 200;

      case "contract":
        return 200;

      case "follow-up":
        return 100;

      default:
        return 0;
    }
  }


  private cleanStoredText(
    value: string,
  ): string {
    const cleanedValue = value
      .replace(
        /^(company_name|company|reminder|title|task|action|next_action|next action)\s*[:=-]\s*/i,
        "",
      )
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\d+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return cleanedValue || value.trim();
  }

  private cleanOptionalStoredText(
    value: string | undefined,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const cleanedValue =
      this.cleanStoredText(value);

    return cleanedValue.length > 0
      ? cleanedValue
      : undefined;
  }

  private cleanCompanyName(
    value: string,
  ): string {
    const cleanedValue =
      this.cleanStoredText(value);

    return cleanedValue || "Customer";
  }

  private normalizeTaskTitle(
    value: string,
  ): string {
    const cleanedValue =
      this.cleanStoredText(value);

    const normalizedValue =
      cleanedValue.toLowerCase();

    if (
      normalizedValue === "follow up" ||
      normalizedValue === "followup"
    ) {
      return "Follow up with the customer";
    }

    if (normalizedValue === "waiting") {
      return "Review pending customer action";
    }

    if (
      normalizedValue === "quotation request" ||
      normalizedValue === "quotation requested"
    ) {
      return "Prepare the quotation";
    }

    if (
      normalizedValue === "information package" ||
      normalizedValue === "info package"
    ) {
      return "Send the information package";
    }

    return cleanedValue;
  }

  private cleanOptionalTaskTitle(
    value: string | undefined,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const cleanedValue =
      this.normalizeTaskTitle(value);

    return cleanedValue.length > 0
      ? cleanedValue
      : undefined;
  }

  private normalizeText(
    value: string,
  ): string {
    return value
      .trim()
      .toLocaleLowerCase("en-US")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private toRecord(
    value: unknown,
  ): UnknownRecord | null {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      return null;
    }

    return value as UnknownRecord;
  }

  private readString(
    record: UnknownRecord,
    ...keys: string[]
  ): string | undefined {
    for (const key of keys) {
      const value = record[key];

      if (
        typeof value === "string" &&
        value.trim().length > 0
      ) {
        return value.trim();
      }
    }

    return undefined;
  }

  private readBoolean(
    record: UnknownRecord,
    ...keys: string[]
  ): boolean | undefined {
    for (const key of keys) {
      const value = record[key];

      if (typeof value === "boolean") {
        return value;
      }
    }

    return undefined;
  }
}