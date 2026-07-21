import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import { useWorkspaceHeader } from "../../components/layout/workspaceHeaderContext";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../features/auth/AuthContext";
import {
  executeAction,
  getWorkQueue,
} from "../../features/execution";
import {
  createCallNote,
} from "../../services/supabase/noteService";
import {
  createReminder,
} from "../../services/supabase/reminderService";
import {
  createTimelineEvent,
} from "../../services/supabase/timelineService";

import { useWorkspaceData } from "./hooks/useWorkspaceData";

import { AiCopilot } from "./components/AiCopilot";

import { CustomerPanel } from "./components/CustomerPanel";
import { FairPanel } from "./components/FairPanel";
import { LiveInteraction } from "./components/LiveInteraction";
import { SalesKitPanel } from "./components/SalesKitPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import { WorkQueuePanel } from "./components/WorkQueuePanel";





import { createCallWorkspaceViewModel } from "./models/workspaceMapper";
import { formatWorkspaceDate } from "./models/workspaceFormatters";



export type {
  WorkspaceMode,
} from "./models/workspaceViewModel";





function mapNextActionToActionId(
  nextAction: string,
): string {
  switch (nextAction) {
    case "Prepare Offer":
      return "quotation";

    case "Prepare Contract":
      return "contract";

    case "Call Tomorrow":
      return "call";

    default:
      return "follow-up";
  }
}

function getFollowUpReminderDate(): string {
  const reminderDate = new Date();

  reminderDate.setDate(
    reminderDate.getDate() + 3,
  );

  reminderDate.setHours(10, 0, 0, 0);

  return reminderDate.toISOString();
}

export function CallWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    setWorkspaceHeader,
    clearWorkspaceHeader,
  } = useWorkspaceHeader();

  const companyId =
    searchParams.get("companyId") ??
    undefined;

  const opportunityId =
    searchParams.get("opportunityId");

  const [refreshVersion, setRefreshVersion] =
    useState(0);

  const {
    company,
    opportunities,
    timeline,
    reminders,
    emails,
    callNotes,
    aiMemory,
    loading,
    error,
    refresh: refreshWorkspaceData,
  } = useWorkspaceData(
    companyId,
    refreshVersion,
  );

  
  
  
  const [
    noteSaving,
    setNoteSaving,
  ] = useState(false);

  const [
    followUpSaving,
    setFollowUpSaving,
  ] = useState(false);

  const workQueueItems = useMemo(
    () =>
      getWorkQueue(companyId).map(
        (item) => item.title,
      ),
    [refreshVersion, companyId],
  );

  const selectedOpportunity = useMemo(() => {
    if (opportunityId) {
      return (
        opportunities.find(
          (opportunity) =>
            opportunity.id === opportunityId,
        ) ?? opportunities[0]
      );
    }

    return opportunities[0];
  }, [
    opportunities,
    opportunityId,
  ]);

  const workspace = useMemo(() => {
    if (
      !company ||
      !selectedOpportunity
    ) {
      return null;
    }

    return createCallWorkspaceViewModel({
      company,
      opportunity: selectedOpportunity,
      timelineEvents: timeline,
      reminders,
      emails,
      callNotes,
      aiMemory,
    });
  }, [
    company,
    selectedOpportunity,
    timeline,
    reminders,
    emails,
    aiMemory,
    callNotes,
  ]);

  useEffect(() => {
    if (!workspace) {
      clearWorkspaceHeader();
      return;
    }

    setWorkspaceHeader({
      aiConfidence: workspace.ai.confidence,
      aiConfidenceLabel:
        workspace.ai.confidenceLabel,
    });

    return () => {
      clearWorkspaceHeader();
    };
  }, [
    workspace,
    setWorkspaceHeader,
    clearWorkspaceHeader,
  ]);

  if (loading) {
    return (
      <main className="page sales-workspace">
        <Panel>
          <p className="eyebrow">
            Atlas Satış Görüşmesi
          </p>

          <h2>
            Çalışma alanı yükleniyor...
          </h2>

          <p className="muted">
            Müşteri bilgileri yükleniyor.
          </p>
        </Panel>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page sales-workspace">
        <Panel>
          <p className="eyebrow">
            Atlas Satış Görüşmesi
          </p>

          <h2>
            Çalışma alanı yüklenemedi
          </h2>

          <p className="muted">
            {error}
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              navigate("/companies")
            }
          >
            Firmaları Aç
          </button>
        </Panel>
      </main>
    );
  }

  if (
    !company ||
    !selectedOpportunity ||
    !workspace
  ) {
    return (
      <main className="page sales-workspace">
        <Panel>
          <p className="eyebrow">
            Atlas Satış Görüşmesi
          </p>

          <h2>
            Firma seçilmedi
          </h2>

          <p className="muted">
            Satış görüşmesini başlatmadan önce
            bir firma ve katılım fırsatı seçin.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              navigate("/companies")
            }
          >
            Firmaları Aç
          </button>
        </Panel>
      </main>
    );
  }

  const activeCompany = company;
  const activeOpportunity =
    selectedOpportunity;
  const activeWorkspace = workspace;

  async function handleSaveNote(
    note: string,
    nextAction: string,
  ) {
    await persistInteraction(
      note,
      nextAction,
      false,
    );
  }

  async function handleCompleteSession(
    note: string,
    nextAction: string,
  ) {
    await persistInteraction(
      note,
      nextAction,
      true,
    );
  }

  async function persistInteraction(
    note: string,
    nextAction: string,
    shouldCompleteSession: boolean,
  ) {
    if (
      noteSaving ||
      !user
    ) {
      return;
    }

    setNoteSaving(true);

    try {
      const completedNote = note.trim();

      if (completedNote) {
        await createCallNote({
            company_id:
              activeCompany.id,
            opportunity_id:
              activeOpportunity.id,
            note: completedNote,
            created_by: user.id,
          });
      }

      if (shouldCompleteSession) {
        const actionId = mapNextActionToActionId(
          nextAction,
        );

        await executeAction({
          actionId,
          title: nextAction,
          companyId: activeCompany.id,
          opportunityId:
            activeOpportunity.id,
        });
      }

      await refreshWorkspaceData();

      if (shouldCompleteSession) {
        setRefreshVersion((version) => version + 1);
      }

      if (shouldCompleteSession) {
        navigate("/today");
      }

      showToast(
        shouldCompleteSession
          ? "Görüşme notu kaydedildi ve iş akışı güncellendi."
          : "Görüşme notu kaydedildi.",
        "success",
      );
    } catch (noteError) {
      console.error(
        "Call note saving error:",
        noteError,
      );

      showToast(
        "Görüşme notu kaydedilemedi.",
        "error",
      );

      throw noteError;
    } finally {
      setNoteSaving(false);
    }
  }

  function handleQuickAction(
    templateId: string,
  ) {
    if (
      !activeCompany.id ||
      !activeOpportunity.id
    ) {
      showToast(
        "Firma veya katılım fırsatı seçilmedi.",
        "error",
      );

      return;
    }

    navigate(
      `/communication?companyId=${encodeURIComponent(
        activeCompany.id,
      )}&opportunityId=${encodeURIComponent(
        activeOpportunity.id,
      )}&template=${encodeURIComponent(
        templateId,
      )}`,
    );
  }

  async function handleCreateFollowUpReminder() {
    if (
      !activeCompany.id ||
      !activeOpportunity.id
    ) {
      showToast(
        "Firma veya katılım fırsatı seçilmedi.",
        "error",
      );

      return;
    }

    if (followUpSaving) {
      return;
    }

    setFollowUpSaving(true);

    try {
      const reminder =
        await createReminder({
          company_id: activeCompany.id,
          title: "Follow up",
          due_date:
            getFollowUpReminderDate(),
          completed: false,
        });

      try {
        await createTimelineEvent({
          company_id: activeCompany.id,
          opportunity_id:
            activeOpportunity.id,
          type: "reminder-created",
          title:
            "Takip hatırlatıcısı oluşturuldu",
          description: `"${reminder.title}" için ${formatWorkspaceDate(
            reminder.due_date,
          )} tarihinde bir hatırlatıcı oluşturuldu.`,
        });
      } catch (timelineError) {
        console.error(
          "Reminder timeline creation error:",
          timelineError,
        );
      }

      await refreshWorkspaceData();

      showToast(
        "Takip hatırlatıcısı oluşturuldu.",
        "success",
      );
    } catch (followUpError) {
      console.error(
        "Follow-up reminder creation error:",
        followUpError,
      );

      showToast(
        "Takip hatırlatıcısı oluşturulamadı.",
        "error",
      );
    } finally {
      setFollowUpSaving(false);
    }
  }

  return (
    <main className="page sales-workspace">
      <section className="sw-context-header">
        <div>
          <p className="eyebrow">
            Satış Görüşmesi
          </p>

          <div className="sw-context-title-row">
            <h1>
              {activeWorkspace.company.name}
            </h1>

            <span className="sw-stage-badge">
              {
                activeWorkspace
                  .opportunity.stageLabel
              }
            </span>
          </div>

          <p className="muted">
            {activeWorkspace.company.industry}
            {" · "}
            {activeWorkspace.company.country}
            {" · "}
            {activeWorkspace.customer.fullName}
          </p>
        </div>

        <div className="sw-header-confidence">
          <span>
            AI Güveni
          </span>

          <strong>
            {activeWorkspace.ai.confidence}%
          </strong>

          <small>
            {
              activeWorkspace.ai
                .confidenceLabel
            }
          </small>
        </div>
      </section>

      <section className="sw-workspace-grid">
        <aside className="sw-left-column">
          <CustomerPanel
            workspace={activeWorkspace}
          />

          <FairPanel
            workspace={activeWorkspace}
          />
        </aside>

        <section className="sw-main-column">
          <LiveInteraction
            key={activeOpportunity.id}
            workspace={activeWorkspace}
            saving={noteSaving}
            onSaveNote={handleSaveNote}
            onCompleteSession={handleCompleteSession}
            onQuickAction={handleQuickAction}
            onCreateFollowUpReminder={
              handleCreateFollowUpReminder
            }
            followUpSaving={followUpSaving}
          />

          <TimelinePanel
            conversation={
              activeWorkspace
                .conversationHistory
            }
          />
        </section>

        <aside className="sw-right-column">
          <AiCopilot
            workspace={activeWorkspace}
          />

          <SalesKitPanel />

          <WorkQueuePanel
            items={workQueueItems}
          />
        </aside>
      </section>
    </main>
  );
}
