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
  getExhibition,
  type Exhibition,
} from "../../../services/supabase/exhibitionService";

import {
  getCallNotesByOpportunity,
} from "../../../services/supabase/noteService";

import {
  getContactsByCompany,
} from "../../../services/supabase/contactService";

import type {
  CallNote,
  Contact,
} from "../../../types/database";

export type WorkspaceData = {
  company: Company | null;
  opportunities: Opportunity[];
  timeline: TimelineEvent[];
  reminders: Reminder[];
  emails: EmailRecord[];
  callNotes: CallNote[];
  aiMemory: AiMemory | null;
  exhibitions: Exhibition[];
  contacts: Contact[];
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
  exhibitions: Exhibition[];
  contacts: Contact[];
  // Sprint 22.9.10 — true once a fetch has actually succeeded for
  // `companyId`. Distinguishes "no snapshot exists yet for this
  // company" (a real initial-load failure — safe/expected to show
  // empty + error) from "we already have good data, this particular
  // refresh just failed" (must NOT be wiped).
  loaded: boolean;
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
  exhibitions: [],
  contacts: [],
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
  exhibitions: [],
  contacts: [],
  loaded: false,
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

async function getExhibitionsByOpportunities(
  opportunities: Opportunity[],
): Promise<Exhibition[]> {
  const exhibitionIds = Array.from(
    new Set(
      opportunities
        .map(
          (opportunity) =>
            opportunity.exhibition_id,
        )
        .filter(
          (id): id is string =>
            Boolean(id?.trim()),
        ),
    ),
  );

  if (exhibitionIds.length === 0) {
    return [];
  }

  const exhibitionRecords =
    await Promise.all(
      exhibitionIds.map((id) =>
        getExhibition(id),
      ),
    );

  return exhibitionRecords.filter(
    (
      exhibition,
    ): exhibition is Exhibition =>
      exhibition !== null,
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
    contacts,
  ] = await Promise.all([
    getCompany(companyId),
    getOpportunitiesByCompany(companyId),
    getTimelineEventsByCompany(companyId),
    getRemindersByCompany(companyId),
    getEmailsByCompany(companyId),
    getAiMemoryByCompany(companyId),
    getContactsByCompany(companyId),
  ]);

  const callNotes =
    await getCallNotesByOpportunities(
      opportunities,
    );

  const exhibitions =
    await getExhibitionsByOpportunities(
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
    exhibitions,
    contacts,
    loaded: true,
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

  // Sprint 22.9.10 — overlapping refresh() calls can resolve out of
  // order (each does its own independent Promise.all of several
  // Supabase reads, with no guaranteed resolution order). Every call
  // captures the current counter; if a newer call has since started by
  // the time this one settles, this one's result — success or failure
  // — is discarded instead of overwriting the newer, more relevant
  // state. Smallest safe protection: no new library, no rewrite.
  const latestRequestId = useRef(0);

  const refresh = useCallback(async () => {
    if (companyId === undefined) {
      return;
    }

    const requestId =
      ++latestRequestId.current;

    try {
      const workspaceData =
        await fetchWorkspaceData(companyId);

      if (
        requestId !==
        latestRequestId.current
      ) {
        // Superseded by a newer refresh — its own result (whatever it
        // turns out to be) is what should win, not this stale one.
        return;
      }

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

      if (
        requestId !==
        latestRequestId.current
      ) {
        // A newer refresh is already in flight (or has already
        // committed) — don't let this stale failure clobber it.
        throw loadError;
      }

      setLoadedData((current) => {
        // A valid snapshot for this exact company already exists —
        // this refresh failing must not erase it. Only a genuine
        // initial-load failure (no snapshot for this company yet)
        // falls back to the empty/error state.
        if (
          current.companyId === companyId &&
          current.loaded
        ) {
          return {
            ...current,
            error:
              "Workspace could not be refreshed.",
          };
        }

        return {
          companyId,
          company: null,
          opportunities: [],
          timeline: [],
          reminders: [],
          emails: [],
          callNotes: [],
          aiMemory: null,
          exhibitions: [],
          contacts: [],
          loaded: false,
          error:
            "Workspace could not be loaded.",
        };
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
    exhibitions:
      loadedData.exhibitions,
    contacts: loadedData.contacts,
    loading: false,
    error: loadedData.error,
    refresh,
  };
}
