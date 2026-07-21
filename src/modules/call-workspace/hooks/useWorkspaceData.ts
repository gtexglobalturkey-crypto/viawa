import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getCompany,
  type Company,
} from "../../../services/supabase/companyService";

import {
  getOpportunitiesByCompany,
  type Opportunity,
} from "../../../services/supabase/opportunityService";

import {
  getTimelineEventsByCompany,
  type TimelineEvent,
} from "../../../services/supabase/timelineService";

import {
  getRemindersByCompany,
  type Reminder,
} from "../../../services/supabase/reminderService";

import {
  getEmailsByCompany,
  type EmailRecord,
} from "../../../services/supabase/emailService";

import {
  getAiMemoryByCompany,
  type AiMemory,
} from "../../../services/supabase/aiService";

import {
  getCallNotesByOpportunity,
} from "../../../services/supabase/noteService";

import type {
  CallNote,
} from "../../../types/database";

export type WorkspaceData = {
  company: Company | null;
  opportunities: Opportunity[];
  timeline: TimelineEvent[];
  reminders: Reminder[];
  emails: EmailRecord[];
  callNotes: CallNote[];
  aiMemory: AiMemory | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

type LoadedWorkspaceData = {
  companyId: string | null;
  company: Company | null;
  opportunities: Opportunity[];
  timeline: TimelineEvent[];
  reminders: Reminder[];
  emails: EmailRecord[];
  callNotes: CallNote[];
  aiMemory: AiMemory | null;
  error: string | null;
};

const emptyWorkspaceData: WorkspaceData = {
  company: null,
  opportunities: [],
  timeline: [],
  reminders: [],
  emails: [],
  callNotes: [],
  aiMemory: null,
  loading: false,
  error: null,
  refresh: async () => {},
};

const initialLoadedData: LoadedWorkspaceData = {
  companyId: null,
  company: null,
  opportunities: [],
  timeline: [],
  reminders: [],
  emails: [],
  callNotes: [],
  aiMemory: null,
  error: null,
};

async function getCallNotesByOpportunities(
  opportunities: Opportunity[],
): Promise<CallNote[]> {
  if (opportunities.length === 0) {
    return [];
  }

  const noteGroups = await Promise.all(
    opportunities.map((opportunity) =>
      getCallNotesByOpportunity(
        opportunity.id,
      ),
    ),
  );

  return noteGroups
    .flat()
    .sort(
      (firstNote, secondNote) =>
        new Date(
          secondNote.updated_at,
        ).getTime() -
        new Date(
          firstNote.updated_at,
        ).getTime(),
    );
}

async function fetchWorkspaceData(
  companyId: string,
): Promise<LoadedWorkspaceData> {
  const [
    company,
    opportunities,
    timeline,
    reminders,
    emails,
    aiMemory,
  ] = await Promise.all([
    getCompany(companyId),
    getOpportunitiesByCompany(companyId),
    getTimelineEventsByCompany(companyId),
    getRemindersByCompany(companyId),
    getEmailsByCompany(companyId),
    getAiMemoryByCompany(companyId),
  ]);

  const callNotes =
    await getCallNotesByOpportunities(
      opportunities,
    );

  return {
    companyId,
    company,
    opportunities,
    timeline,
    reminders,
    emails,
    callNotes,
    aiMemory,
    error: null,
  };
}

export function useWorkspaceData(
  companyId?: string,
  refreshVersion = 0,
): WorkspaceData {
  const [loadedData, setLoadedData] =
    useState<LoadedWorkspaceData>(
      initialLoadedData,
    );

  const pendingRefreshes = useRef<
    Array<{
      data: LoadedWorkspaceData;
      resolve: () => void;
    }>
  >([]);

  useEffect(() => {
    pendingRefreshes.current =
      pendingRefreshes.current.filter(
        (pendingRefresh) => {
          if (
            pendingRefresh.data !== loadedData
          ) {
            return true;
          }

          pendingRefresh.resolve();
          return false;
        },
      );
  }, [loadedData]);

  const refresh = useCallback(async () => {
    if (companyId === undefined) {
      return;
    }

    try {
      const workspaceData =
        await fetchWorkspaceData(companyId);

      const committed = new Promise<void>(
        (resolve) => {
          pendingRefreshes.current.push({
            data: workspaceData,
            resolve,
          });
        },
      );

      setLoadedData(workspaceData);
      await committed;
    } catch (loadError: unknown) {
        console.error(
          "Workspace loading error:",
          loadError,
        );

      setLoadedData({
        companyId,
        company: null,
        opportunities: [],
        timeline: [],
        reminders: [],
        emails: [],
        callNotes: [],
        aiMemory: null,
        error:
          "Workspace could not be loaded.",
      });

      throw loadError;
    }
  }, [companyId]);

  useEffect(() => {
    void refresh().catch(() => {
      // The hook exposes the load failure through
      // its error state.
    });

  }, [refresh, refreshVersion]);

  if (companyId === undefined) {
    return emptyWorkspaceData;
  }

  if (
    loadedData.companyId !== companyId
  ) {
    return {
      ...emptyWorkspaceData,
      loading: true,
      refresh,
    };
  }

  return {
    company: loadedData.company,
    opportunities:
      loadedData.opportunities,
    timeline: loadedData.timeline,
    reminders: loadedData.reminders,
    emails: loadedData.emails,
    callNotes: loadedData.callNotes,
    aiMemory: loadedData.aiMemory,
    loading: false,
    error: loadedData.error,
    refresh,
  };
}
