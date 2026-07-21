import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getAiMemoryByCompany,
  type AiMemory,
} from "../services/supabase/aiService";
import {
  getCompanies,
  type Company,
} from "../services/supabase/companyService";
import {
  getEmails,
  type EmailRecord,
} from "../services/supabase/emailService";
import {
  getOpportunities,
  type Opportunity,
} from "../services/supabase/opportunityService";
import {
  getReminders,
  type Reminder,
} from "../services/supabase/reminderService";
import {
  getTimelineEvents,
  type TimelineEvent,
} from "../services/supabase/timelineService";

import { useWorkflowEngine } from "./useWorkflowEngine";

export type TodayData = {
  companies: Company[];
  emails: EmailRecord[];
  reminders: Reminder[];
  opportunities: Opportunity[];
  timelineEvents: TimelineEvent[];
  aiMemories: AiMemory[];
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
};

type TodaySnapshot = Pick<
  TodayData,
  | "companies"
  | "emails"
  | "reminders"
  | "opportunities"
  | "timelineEvents"
  | "aiMemories"
>;

const initialTodayData: TodayData = {
  companies: [],
  emails: [],
  reminders: [],
  opportunities: [],
  timelineEvents: [],
  aiMemories: [],
  loading: true,
  isRefreshing: false,
  error: null,
};

function getStartOfToday(): Date {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date;
}

function getStartOfTomorrow(): Date {
  const date = getStartOfToday();

  date.setDate(date.getDate() + 1);

  return date;
}

function parseDate(
  value: string | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

function getReminderTime(
  reminder: Reminder,
): number {
  return (
    parseDate(
      reminder.due_date,
    )?.getTime() ??
    Number.MAX_SAFE_INTEGER
  );
}

function sortRemindersByDueDate(
  reminders: Reminder[],
): Reminder[] {
  return [...reminders].sort(
    (first, second) =>
      getReminderTime(first) -
      getReminderTime(second),
  );
}

function isCallReminder(
  reminder: Reminder,
): boolean {
  const title =
    reminder.title
      ?.replace(/\s+/g, " ")
      .trim()
      .toLowerCase() ?? "";

  return (
    title.includes("call") ||
    title.includes("follow up") ||
    title.includes("follow-up") ||
    title.includes("followup")
  );
}

function formatCompanyName(
  companyName: string | null | undefined,
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

function hasUsefulAiMemory(
  memory: AiMemory,
): boolean {
  return Boolean(
    memory.summary?.trim() ||
      memory.recommendation?.trim() ||
      memory.risk?.trim(),
  );
}

function hasActiveRisk(
  memory: AiMemory,
): boolean {
  const normalizedRisk =
    memory.risk
      ?.replace(/\s+/g, " ")
      .trim()
      .toLowerCase() ?? "";

  if (!normalizedRisk) {
    return false;
  }

  const noRiskValues = new Set([
    "none",
    "n/a",
    "no risk",
    "no risk.",
    "no risk detected",
    "no risk detected.",
    "no immediate risk detected",
    "no immediate risk detected.",
  ]);

  if (
    noRiskValues.has(
      normalizedRisk,
    )
  ) {
    return false;
  }

  if (
    normalizedRisk.startsWith(
      "no immediate risk detected if",
    )
  ) {
    return false;
  }

  return true;
}

async function loadTodaySnapshot(): Promise<TodaySnapshot> {
  const [
    companies,
    emails,
    reminders,
    opportunities,
    timelineEvents,
  ] = await Promise.all([
    getCompanies(),
    getEmails(),
    getReminders(),
    getOpportunities(),
    getTimelineEvents(),
  ]);

  const memoryResults =
    await Promise.allSettled(
      companies.map(
        (company) =>
          getAiMemoryByCompany(
            company.id,
          ),
      ),
    );

  const aiMemories =
    memoryResults.flatMap(
      (result) => {
        if (
          result.status ===
            "fulfilled" &&
          result.value
        ) {
          return [
            result.value,
          ];
        }

        return [];
      },
    );

  return {
    companies,
    emails,
    reminders,
    opportunities,
    timelineEvents,
    aiMemories,
  };
}

export function useTodayData() {
  const [data, setData] =
    useState<TodayData>(
      initialTodayData,
    );

  const isMountedRef =
    useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function initializeTodayData() {
      try {
        const snapshot =
          await loadTodaySnapshot();

        if (!isActive) {
          return;
        }

        setData({
          ...snapshot,
          loading: false,
          isRefreshing: false,
          error: null,
        });
      } catch {
        if (!isActive) {
          return;
        }

        setData({
          ...initialTodayData,
          loading: false,
          isRefreshing: false,
          error:
            "Günlük özet yüklenemedi.",
        });
      }
    }

    void initializeTodayData();

    return () => {
      isActive = false;
    };
  }, []);

  const reload = useCallback(
    async (): Promise<void> => {
      if (
        !isMountedRef.current
      ) {
        return;
      }

      setData((current) => ({
        ...current,
        isRefreshing: true,
        error: null,
      }));

      try {
        const snapshot =
          await loadTodaySnapshot();

        if (
          !isMountedRef.current
        ) {
          return;
        }

        setData({
          ...snapshot,
          loading: false,
          isRefreshing: false,
          error: null,
        });
      } catch {
        if (
          !isMountedRef.current
        ) {
          return;
        }

        setData((current) => ({
          ...current,
          loading: false,
          isRefreshing: false,
          error:
            "Günlük özet yenilenemedi.",
        }));
      }
    },
    [],
  );

  const companyNames = useMemo(
    () =>
      new Map(
        data.companies.map(
          (company) => [
            company.id,
            formatCompanyName(
              company.company_name,
            ),
          ],
        ),
      ),
    [data.companies],
  );

  const draftEmails = useMemo(
    () =>
      data.emails.filter(
        (email) =>
          email.status ===
          "draft",
      ),
    [data.emails],
  );

  const activeReminders = useMemo(
    () =>
      data.reminders.filter(
        (reminder) =>
          !reminder.completed,
      ),
    [data.reminders],
  );

  const overdueReminders =
    useMemo(() => {
      const today =
        getStartOfToday();

      const reminders =
        activeReminders.filter(
          (reminder) => {
            const dueDate =
              parseDate(
                reminder.due_date,
              );

            return Boolean(
              dueDate &&
                dueDate <
                  today,
            );
          },
        );

      return sortRemindersByDueDate(
        reminders,
      );
    }, [activeReminders]);

  const todayReminders =
    useMemo(() => {
      const today =
        getStartOfToday();

      const tomorrow =
        getStartOfTomorrow();

      const reminders =
        activeReminders.filter(
          (reminder) => {
            const dueDate =
              parseDate(
                reminder.due_date,
              );

            if (!dueDate) {
              return false;
            }

            return (
              dueDate >= today &&
              dueDate <
                tomorrow
            );
          },
        );

      return sortRemindersByDueDate(
        reminders,
      );
    }, [activeReminders]);

  const upcomingReminders =
    useMemo(() => {
      const tomorrow =
        getStartOfTomorrow();

      const reminders =
        activeReminders.filter(
          (reminder) => {
            const dueDate =
              parseDate(
                reminder.due_date,
              );

            return Boolean(
              dueDate &&
                dueDate >=
                  tomorrow,
            );
          },
        );

      return sortRemindersByDueDate(
        reminders,
      ).slice(0, 5);
    }, [activeReminders]);

  const pendingCalls = useMemo(
    () =>
      sortRemindersByDueDate(
        activeReminders.filter(
          isCallReminder,
        ),
      ),
    [activeReminders],
  );

  const usefulAiMemories =
    useMemo(
      () =>
        data.aiMemories.filter(
          hasUsefulAiMemory,
        ),
      [data.aiMemories],
    );

  const aiReady = useMemo(() => {
    if (
      data.companies.length ===
      0
    ) {
      return 0;
    }

    return Math.round(
      (data.aiMemories.length /
        data.companies.length) *
        100,
    );
  }, [
    data.aiMemories.length,
    data.companies.length,
  ]);

  const aiFocusMemory =
    useMemo(() => {
      if (
        usefulAiMemories.length ===
        0
      ) {
        return null;
      }

      return [
        ...usefulAiMemories,
      ].sort(
        (first, second) =>
          second.confidence -
          first.confidence,
      )[0];
    }, [usefulAiMemories]);

  const highestRiskMemories =
    useMemo(
      () =>
        usefulAiMemories
          .filter(
            hasActiveRisk,
          )
          .sort(
            (first, second) =>
              second.confidence -
              first.confidence,
          )
          .slice(0, 3),
      [usefulAiMemories],
    );

  const workflow =
    useWorkflowEngine({
      companies:
        data.companies,
      emails:
        data.emails,
      reminders:
        data.reminders,
      opportunities:
        data.opportunities,
      timelineEvents:
        data.timelineEvents,
      aiMemories:
        data.aiMemories,
      callNotes: [],
    });

  return {
    ...data,
    reload,
    refresh: reload,
    companyNames,
    draftEmails,
    activeReminders,
    overdueReminders,
    todayReminders,
    upcomingReminders,
    pendingCalls,
    aiReady,
    usefulAiMemories,
    aiFocusMemory,
    highestRiskMemories,
    workflow,
    currentWorkflowTask:
      workflow.currentTask,
    workflowQueue:
      workflow.queue,
    currentWorkflowPhase:
      workflow.currentPhase,
    plannedWorkCompleted:
      workflow.plannedWorkCompleted,
    suggestedWorkActive:
      workflow.suggestedWorkActive,
  };
}