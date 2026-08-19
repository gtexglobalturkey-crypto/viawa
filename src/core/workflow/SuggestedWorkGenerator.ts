import type {
  WorkflowGenerationContext,
  WorkflowTask,
  WorkflowTaskPriority,
} from "./workflowTypes";

type UnknownRecord = Record<string, unknown>;

export class SuggestedWorkGenerator {
  generate(
    context: WorkflowGenerationContext,
  ): WorkflowTask[] {
    const suggestions = [
      ...this.generateUnreachableCustomerTasks(
        context.timelineEvents,
        context.now,
      ),
      ...this.generateWaitingOpportunityTasks(
        context.opportunities,
        context.now,
      ),
      ...this.generateDraftEmailTasks(
        context.emails,
        context.now,
      ),
      ...this.generateMissingRecordTasks(
        context.opportunities,
        context.now,
      ),
    ];

    return this.removeDuplicates(suggestions);
  }

  private generateUnreachableCustomerTasks(
    timelineEvents: unknown[],
    now: string,
  ): WorkflowTask[] {
    return timelineEvents
      .map((event) => this.toRecord(event))
      .filter(
        (event): event is UnknownRecord =>
          event !== null,
      )
      .filter((event) =>
        this.isRecentUnreachableEvent(
          event,
          now,
        ),
      )
      .map((event, index) => {
        const eventId =
          this.readString(
            event,
            "id",
            "eventId",
            "event_id",
          ) ?? `unreachable-${index}`;

        const companyId = this.readString(
          event,
          "companyId",
          "company_id",
        );

        const opportunityId =
          this.readString(
            event,
            "opportunityId",
            "opportunity_id",
        );

        const companyName =
          this.readString(
            event,
            "companyName",
            "company_name",
          ) ?? "Müşteri";

        const contactName =
          this.readString(
            event,
            "contactName",
            "contact_name",
          );

        const createdAt =
          this.readString(
            event,
            "createdAt",
            "created_at",
            "occurredAt",
            "occurred_at",
          ) ?? now;

        return {
          id: `suggested-unreachable-${eventId}`,
          source: "planned-call",
          type: "make-call",
          phase: "suggested-work",
          status: "pending",
          priority: "high",
          title: `Call ${companyName} again`,
          description:
            contactName !== undefined
              ? `${contactName} could not be reached previously.`
              : "The customer could not be reached previously.",
          reason:
            "A recent unanswered call should be retried before the opportunity becomes inactive.",
          companyName,
          contactName,
          createdAt,
          estimatedMinutes: 8,
          action: {
            label: "Start call",
            route:
              companyId !== undefined
                ? `/call?companyId=${companyId}`
                : "/call",
            entityReference: {
              companyId,
              opportunityId,
            },
          },
          metadata: {
            suggestionType:
              "recently-unreachable",
          },
        };
      });
  }

  private generateWaitingOpportunityTasks(
    opportunities: unknown[],
    now: string,
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
        this.isWaitingOpportunity(
          opportunity,
          now,
        ),
      )
      .map((opportunity, index) => {
        const opportunityId =
          this.readString(
            opportunity,
            "id",
            "opportunityId",
            "opportunity_id",
          ) ?? `waiting-${index}`;

        const companyId = this.readString(
          opportunity,
          "companyId",
          "company_id",
        );

        const companyName =
          this.readString(
            opportunity,
            "companyName",
            "company_name",
          ) ?? "Müşteri";

        const opportunityTitle =
          this.readString(
            opportunity,
            "title",
            "opportunityTitle",
            "opportunity_title",
          ) ?? "Sales opportunity";

        const stage =
          this.readString(
            opportunity,
            "stage",
          ) ?? "contacted";

        const updatedAt =
          this.readString(
            opportunity,
            "updatedAt",
            "updated_at",
            "lastContactAt",
            "last_contact_at",
          ) ?? now;

        const waitingDays =
          this.getElapsedDays(
            updatedAt,
            now,
          );

        return {
          id: `suggested-waiting-${opportunityId}`,
          source:
            stage === "quotation-sent"
              ? "quotation"
              : stage === "contract"
                ? "contract"
                : "follow-up",
          type:
            stage === "quotation-sent"
              ? "follow-up-quotation"
              : stage === "contract"
                ? "follow-up-contract"
                : "follow-up",
          phase: "suggested-work",
          status: "pending",
          priority:
            this.getWaitingPriority(
              waitingDays,
            ),
          title:
            this.getWaitingTaskTitle(
              stage,
              companyName,
            ),
          description: opportunityTitle,
          reason: `${companyName} has been waiting for ${waitingDays} days without a recorded next action.`,
          companyName,
          opportunityTitle,
          createdAt: updatedAt,
          estimatedMinutes: 10,
          action: {
            label: "Open opportunity",
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
            suggestionType:
              "waiting-opportunity",
            waitingDays,
          },
        };
      });
  }

  private generateDraftEmailTasks(
    emails: unknown[],
    now: string,
  ): WorkflowTask[] {
    return emails
      .map((email) => this.toRecord(email))
      .filter(
        (email): email is UnknownRecord =>
          email !== null,
      )
      .filter((email) =>
        this.isOldDraftEmail(email, now),
      )
      .map((email, index) => {
        const emailId =
          this.readString(
            email,
            "id",
            "emailId",
            "email_id",
          ) ?? `draft-${index}`;

        const companyId = this.readString(
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
          this.readString(
            email,
            "companyName",
            "company_name",
          ) ?? "Müşteri";

        const subject =
          this.readString(
            email,
            "subject",
          ) ?? "Taslak e-posta";

        const createdAt =
          this.readString(
            email,
            "createdAt",
            "created_at",
          ) ?? now;

        return {
          id: `suggested-draft-${emailId}`,
          source: "email",
          type: "reply-email",
          phase: "suggested-work",
          status: "pending",
          priority: "medium",
          title: `Finish and send: ${subject}`,
          description: companyName,
          reason:
            "This email draft has been waiting and should be completed before it becomes outdated.",
          companyName,
          createdAt,
          estimatedMinutes: 5,
          action: {
            label: "Open draft",
            // Sprint 25.1 / Adım 4 — route removed: nothing ever read
            // WorkflowTaskAction.route (confirmed via a repo-wide
            // search), the real navigation is built entirely in
            // useTodayWorkflow.ts's getTaskRoute from entityReference
            // below. route is optional on the shared type, so dropping
            // it here doesn't affect anything else that uses it.
            entityReference: {
              companyId,
              opportunityId,
              emailId,
            },
          },
          metadata: {
            suggestionType:
              "waiting-draft",
          },
        };
      });
  }

  private generateMissingRecordTasks(
    opportunities: unknown[],
    now: string,
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
        this.hasMissingCriticalData(
          opportunity,
        ),
      )
      .map((opportunity, index) => {
        const opportunityId =
          this.readString(
            opportunity,
            "id",
            "opportunityId",
            "opportunity_id",
          ) ?? `missing-data-${index}`;

        const companyId = this.readString(
          opportunity,
          "companyId",
          "company_id",
        );

        const companyName =
          this.readString(
            opportunity,
            "companyName",
            "company_name",
          ) ?? "Müşteri";

        const opportunityTitle =
          this.readString(
            opportunity,
            "title",
            "opportunityTitle",
            "opportunity_title",
          ) ?? "Sales opportunity";

        const missingFields =
          this.getMissingFields(
            opportunity,
          );

        const createdAt =
          this.readString(
            opportunity,
            "createdAt",
            "created_at",
          ) ?? now;

        return {
          id: `suggested-cleanup-${opportunityId}`,
          source: "crm-cleanup",
          type: "complete-record",
          phase: "suggested-work",
          status: "pending",
          priority: "low",
          title: `Complete ${companyName} record`,
          description: `Missing: ${missingFields.join(", ")}`,
          reason:
            "Completing this record will allow VIAWA to prepare more accurate future actions.",
          companyName,
          opportunityTitle,
          createdAt,
          estimatedMinutes: 4,
          action: {
            label: "Complete record",
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
            suggestionType:
              "missing-record-data",
            missingFieldCount:
              missingFields.length,
          },
        };
      });
  }

  private isRecentUnreachableEvent(
    event: UnknownRecord,
    now: string,
  ): boolean {
    const type =
      this.readString(
        event,
        "type",
        "eventType",
        "event_type",
      )?.toLowerCase() ?? "";

    const outcome =
      this.readString(
        event,
        "outcome",
        "result",
        "status",
      )?.toLowerCase() ?? "";

    const createdAt = this.readString(
      event,
      "createdAt",
      "created_at",
      "occurredAt",
      "occurred_at",
    );

    const unreachable =
      type.includes("unreachable") ||
      outcome.includes("unreachable") ||
      outcome.includes("no-answer") ||
      outcome.includes("no answer");

    if (
      !unreachable ||
      createdAt === undefined
    ) {
      return false;
    }

    const elapsedDays =
      this.getElapsedDays(
        createdAt,
        now,
      );

    return elapsedDays >= 1 &&
      elapsedDays <= 3;
  }

  private isWaitingOpportunity(
    opportunity: UnknownRecord,
    now: string,
  ): boolean {
    const stage =
      this.readString(
        opportunity,
        "stage",
      )?.toLowerCase();

    if (
      stage === undefined ||
      stage === "signed" ||
      stage === "lost"
    ) {
      return false;
    }

    const nextAction = this.readString(
      opportunity,
      "nextAction",
      "next_action",
    );

    const nextActivityAt =
      this.readString(
        opportunity,
        "nextActivityAt",
        "next_activity_at",
        "followUpAt",
        "follow_up_at",
      );

    if (
      nextAction !== undefined ||
      nextActivityAt !== undefined
    ) {
      return false;
    }

    const updatedAt =
      this.readString(
        opportunity,
        "updatedAt",
        "updated_at",
        "lastContactAt",
        "last_contact_at",
      );

    if (updatedAt === undefined) {
      return false;
    }

    return (
      this.getElapsedDays(
        updatedAt,
        now,
      ) >= 5
    );
  }

  private isOldDraftEmail(
    email: UnknownRecord,
    now: string,
  ): boolean {
    const status =
      this.readString(
        email,
        "status",
      )?.toLowerCase();

    if (status !== "draft") {
      return false;
    }

    const createdAt = this.readString(
      email,
      "createdAt",
      "created_at",
    );

    if (createdAt === undefined) {
      return false;
    }

    return (
      this.getElapsedDays(
        createdAt,
        now,
      ) >= 1
    );
  }

  private hasMissingCriticalData(
    opportunity: UnknownRecord,
  ): boolean {
    return (
      this.getMissingFields(
        opportunity,
      ).length > 0
    );
  }

  private getMissingFields(
    opportunity: UnknownRecord,
  ): string[] {
    const missingFields: string[] = [];

    if (
      this.readString(
        opportunity,
        "nextAction",
        "next_action",
      ) === undefined
    ) {
      missingFields.push("next action");
    }

    if (
      this.readString(
        opportunity,
        "stage",
      ) === undefined
    ) {
      missingFields.push("stage");
    }

    if (
      this.readString(
        opportunity,
        "companyId",
        "company_id",
      ) === undefined
    ) {
      missingFields.push("company");
    }

    return missingFields;
  }

  private getWaitingTaskTitle(
    stage: string,
    companyName: string,
  ): string {
    switch (stage) {
      case "quotation-sent":
        return `Check quotation status with ${companyName}`;

      case "contract":
        return `Check contract status with ${companyName}`;

      case "negotiation":
        return `Continue negotiation with ${companyName}`;

      default:
        return `Reconnect with ${companyName}`;
    }
  }

  private getWaitingPriority(
    waitingDays: number,
  ): WorkflowTaskPriority {
    if (waitingDays >= 10) {
      return "high";
    }

    if (waitingDays >= 7) {
      return "medium";
    }

    return "low";
  }

  private getElapsedDays(
    dateValue: string,
    now: string,
  ): number {
    const dateTime =
      new Date(dateValue).getTime();

    const nowTime =
      new Date(now).getTime();

    if (
      Number.isNaN(dateTime) ||
      Number.isNaN(nowTime)
    ) {
      return 0;
    }

    const difference =
      Math.max(0, nowTime - dateTime);

    return Math.floor(
      difference /
        (24 * 60 * 60 * 1000),
    );
  }

  private removeDuplicates(
    tasks: WorkflowTask[],
  ): WorkflowTask[] {
    const uniqueTasks =
      new Map<string, WorkflowTask>();

    for (const task of tasks) {
      if (!uniqueTasks.has(task.id)) {
        uniqueTasks.set(task.id, task);
      }
    }

    return Array.from(
      uniqueTasks.values(),
    );
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
        return value;
      }
    }

    return undefined;
  }
}
