import type { Company } from "../../services/supabase/companyService";
import type { EmailRecord } from "../../services/supabase/emailService";
import type { Opportunity } from "../../services/supabase/opportunityService";
import type { Reminder } from "../../services/supabase/reminderService";
import type { TimelineEvent } from "../../services/supabase/timelineService";

export type WorkflowAdaptedData = {
  emails: unknown[];
  reminders: unknown[];
  opportunities: unknown[];
  timelineEvents: unknown[];
};

type UnknownRecord = Record<
  string,
  unknown
>;

function formatCompanyName(
  companyName:
    | string
    | null
    | undefined,
): string {
  return (
    companyName
      ?.replace(
        /^company_name\s*:\s*/i,
        "",
      )
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function normalizeId(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function isUsefulId(
  value:
    | string
    | null
    | undefined,
): value is string {
  return Boolean(
    value?.trim(),
  );
}

function createCompanyNameMap(
  companies: Company[],
): Map<string, string> {
  const companyNames =
    new Map<string, string>();

  for (const company of companies) {
    if (
      !isUsefulId(
        company.id,
      )
    ) {
      continue;
    }

    const companyName =
      formatCompanyName(
        company.company_name,
      );

    if (!companyName) {
      continue;
    }

    companyNames.set(
      normalizeId(company.id),
      companyName,
    );
  }

  return companyNames;
}

function toUnknownRecord(
  value: object,
): UnknownRecord {
  return value as UnknownRecord;
}

function isUnknownRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(
  record: UnknownRecord,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value =
      record[key];

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return undefined;
}

function findNestedString(
  record: UnknownRecord,
  keys: string[],
  depth = 0,
): string | undefined {
  const directValue =
    readString(
      record,
      ...keys,
    );

  if (directValue) {
    return directValue;
  }

  if (depth >= 4) {
    return undefined;
  }

  const preferredContainers = [
    "metadata",
    "entityReference",
    "entity_reference",
    "action",
    "payload",
    "data",
    "context",
  ];

  for (
    const containerKey
    of preferredContainers
  ) {
    const nestedValue =
      record[containerKey];

    if (
      !isUnknownRecord(
        nestedValue,
      )
    ) {
      continue;
    }

    const result =
      findNestedString(
        nestedValue,
        keys,
        depth + 1,
      );

    if (result) {
      return result;
    }
  }

  for (
    const value
    of Object.values(record)
  ) {
    if (
      !isUnknownRecord(
        value,
      )
    ) {
      continue;
    }

    const result =
      findNestedString(
        value,
        keys,
        depth + 1,
      );

    if (result) {
      return result;
    }
  }

  return undefined;
}

function readCompanyId(
  record: UnknownRecord,
): string | undefined {
  return findNestedString(
    record,
    [
      "company_id",
      "companyId",
    ],
  );
}

function readOpportunityId(
  record: UnknownRecord,
): string | undefined {
  return findNestedString(
    record,
    [
      "opportunity_id",
      "opportunityId",
    ],
  );
}

function createOpportunityCompanyMap(
  opportunities:
    Opportunity[],
): Map<string, string> {
  const map =
    new Map<string, string>();

  for (
    const opportunity
    of opportunities
  ) {
    const record =
      toUnknownRecord(
        opportunity,
      );

    const opportunityId =
      findNestedString(
        record,
        [
          "id",
          "opportunity_id",
          "opportunityId",
        ],
      );

    const companyId =
      readCompanyId(record);

    if (
      !opportunityId ||
      !companyId
    ) {
      continue;
    }

    map.set(
      normalizeId(
        opportunityId,
      ),
      companyId.trim(),
    );
  }

  return map;
}

function resolveCompanyId(
  record: UnknownRecord,
  opportunityCompanyMap:
    Map<string, string>,
): string | undefined {
  const directCompanyId =
    readCompanyId(record);

  if (directCompanyId) {
    return directCompanyId;
  }

  const opportunityId =
    readOpportunityId(record);

  if (!opportunityId) {
    return undefined;
  }

  return opportunityCompanyMap.get(
    normalizeId(
      opportunityId,
    ),
  );
}

function resolveCompanyName(
  record: UnknownRecord,
  companyId:
    | string
    | undefined,
  companyNames:
    Map<string, string>,
): string | undefined {
  if (companyId) {
    const canonicalName =
      companyNames.get(
        normalizeId(
          companyId,
        ),
      );

    if (canonicalName) {
      return canonicalName;
    }
  }

  const embeddedName =
    findNestedString(
      record,
      [
        "companyName",
        "company_name",
      ],
    );

  const formattedName =
    formatCompanyName(
      embeddedName,
    );

  return (
    formattedName ||
    undefined
  );
}

export function adaptWorkflowData(
  companies: Company[],
  emails: EmailRecord[],
  reminders: Reminder[],
  opportunities:
    Opportunity[],
  timelineEvents:
    TimelineEvent[],
): WorkflowAdaptedData {
  const companyNames =
    createCompanyNameMap(
      companies,
    );

  const opportunityCompanyMap =
    createOpportunityCompanyMap(
      opportunities,
    );

  const adaptedEmails =
    emails.map((email) => {
      const record =
        toUnknownRecord(email);

      const opportunityId =
        readOpportunityId(
          record,
        );

      const companyId =
        resolveCompanyId(
          record,
          opportunityCompanyMap,
        );

      const companyName =
        resolveCompanyName(
          record,
          companyId,
          companyNames,
        );

      return {
        ...email,
        companyId,
        companyName,
        opportunityId,
        emailId:
          findNestedString(
            record,
            [
              "id",
              "email_id",
              "emailId",
            ],
          ),
        createdAt:
          findNestedString(
            record,
            [
              "created_at",
              "createdAt",
            ],
          ),
      };
    });

  const adaptedReminders =
    reminders.map(
      (reminder) => {
        const record =
          toUnknownRecord(
            reminder,
          );

        const opportunityId =
          readOpportunityId(
            record,
          );

        const companyId =
          resolveCompanyId(
            record,
            opportunityCompanyMap,
          );

        const companyName =
          resolveCompanyName(
            record,
            companyId,
            companyNames,
          );

        const dueAt =
          findNestedString(
            record,
            [
              "due_date",
              "dueAt",
              "scheduled_at",
              "scheduledAt",
            ],
          );

        return {
          ...reminder,
          companyId,
          companyName,
          opportunityId,
          reminderId:
            findNestedString(
              record,
              [
                "id",
                "reminder_id",
                "reminderId",
              ],
            ),
          dueAt,
          scheduledAt:
            dueAt,
          createdAt:
            findNestedString(
              record,
              [
                "created_at",
                "createdAt",
              ],
            ),
        };
      },
    );

  const adaptedOpportunities =
    opportunities.map(
      (opportunity) => {
        const record =
          toUnknownRecord(
            opportunity,
          );

        const opportunityId =
          findNestedString(
            record,
            [
              "id",
              "opportunity_id",
              "opportunityId",
            ],
          );

        const companyId =
          resolveCompanyId(
            record,
            opportunityCompanyMap,
          );

        const companyName =
          resolveCompanyName(
            record,
            companyId,
            companyNames,
          );

        return {
          ...opportunity,
          companyId,
          companyName,
          opportunityId,
          opportunityTitle:
            findNestedString(
              record,
              [
                "title",
                "name",
                "opportunity_title",
                "opportunityTitle",
              ],
            ),
          nextAction:
            findNestedString(
              record,
              [
                "next_action",
                "nextAction",
              ],
            ),
          nextActivityAt:
            findNestedString(
              record,
              [
                "next_activity_at",
                "nextActivityAt",
                "follow_up_at",
                "followUpAt",
              ],
            ),
          createdAt:
            findNestedString(
              record,
              [
                "created_at",
                "createdAt",
              ],
            ),
          updatedAt:
            findNestedString(
              record,
              [
                "updated_at",
                "updatedAt",
              ],
            ),
        };
      },
    );

  const adaptedTimelineEvents =
    timelineEvents.map(
      (timelineEvent) => {
        const record =
          toUnknownRecord(
            timelineEvent,
          );

        const opportunityId =
          readOpportunityId(
            record,
          );

        const companyId =
          resolveCompanyId(
            record,
            opportunityCompanyMap,
          );

        const companyName =
          resolveCompanyName(
            record,
            companyId,
            companyNames,
          );

        return {
          ...timelineEvent,
          companyId,
          companyName,
          opportunityId,
          eventId:
            findNestedString(
              record,
              [
                "id",
                "event_id",
                "eventId",
              ],
            ),
          eventType:
            findNestedString(
              record,
              [
                "event_type",
                "eventType",
                "type",
              ],
            ),
          outcome:
            findNestedString(
              record,
              [
                "outcome",
                "result",
                "status",
              ],
            ),
          createdAt:
            findNestedString(
              record,
              [
                "created_at",
                "createdAt",
                "occurred_at",
                "occurredAt",
              ],
            ),
        };
      },
    );

  return {
    emails:
      adaptedEmails,
    reminders:
      adaptedReminders,
    opportunities:
      adaptedOpportunities,
    timelineEvents:
      adaptedTimelineEvents,
  };
}