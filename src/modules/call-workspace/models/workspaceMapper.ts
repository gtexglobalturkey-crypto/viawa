import type {
  AiMemory,
  Company,
  EmailRecord,
  Exhibition,
  Opportunity,
  Reminder,
  TimelineEvent,
} from "../../../types/database";

import type {
  OpportunityStage,
} from "../../../types/salesAction";

import {
  createConversationMetrics,
  createConversationSummary,
  createNextBestAction,
  createRiskAnalysis,
} from "../services/conversationEngine";

import { getWorkspaceFollowUpActionLabel } from "../../../types/workspaceFollowUpAction";
import { translateSystemGeneratedText } from "../../../features/execution/atlasTextTranslations";

import {
  findBusinessStatus,
  getBusinessStatusLabel,
  isForwardStageTransition,
} from "../../../types/businessStatus";

import type {
  CallWorkspaceViewModel,
  WorkspaceAiMemory,
  WorkspaceConversationItem,
  WorkspaceTimelineItem,
} from "./workspaceViewModel";

function normalizeStage(
  stage: string,
): OpportunityStage {
  return (
    findBusinessStatus(stage)?.id ?? "new"
  );
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "Planlanmadı";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Planlanmadı";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function formatLabel(
  value: string,
): string {
  return value
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

function formatStageLabel(
  value: OpportunityStage,
): string {
  return (
    getBusinessStatusLabel(value) ??
    formatLabel(value)
  );
}

function resolveExhibitionName(
  exhibition: Exhibition | undefined,
): string {
  const trimmedName =
    exhibition?.name.trim();

  return trimmedName
    ? trimmedName
    : "Fuar Katılımı";
}

function resolveExhibitionOrganizer(
  exhibition: Exhibition | undefined,
): string | undefined {
  const organizer =
    exhibition?.organizer?.trim();

  return organizer || undefined;
}

function formatEstimatedValue(
  value?: number | null,
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return "Hesaplanmadı";
  }

  return value.toLocaleString("en-US");
}

function formatStandType(value?: string | null): string {
  if (!value) return "â€”";

  return ({
    "space-only": "Space Only",
    "shell-scheme": "Shell Scheme",
    "premium-shell": "Premium Shell",
    custom: "Custom Stand",
    outdoor: "Outdoor",
  } as Record<string, string>)[value] ?? value;
}

function cleanValue(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  return value
    .replace(
      /^company_name:\s*/i,
      "",
    )
    .replace(
      /^contact_person:\s*/i,
      "",
    )
    .replace(/^industry:\s*/i, "")
    .replace(/^country:\s*/i, "")
    .replace(/^phone:\s*/i, "")
    .replace(/^email:\s*/i, "")
    .trim();
}

function getTimelineIcon(
  type?: string | null,
): string {
  switch (type) {
    case "call":
      return "📞";

    case "email":
    case "information-sent":
      return "✉️";

    case "quotation-created":
    case "quotation-sent":
      return "💰";

    case "meeting":
      return "🤝";

    case "reminder-created":
      return "📅";

    case "contract-sent":
    case "contract-signed":
      return "📄";

    case "stage-changed":
      return "🔄";

    case "company-created":
      return "🏢";

    case "note":
      return "📝";

    default:
      return "⚡";
  }
}

function mapTimelineEvent(
  event: TimelineEvent,
): WorkspaceTimelineItem {
  return {
    id: event.id,
    icon: getTimelineIcon(
      event.type,
    ),
    type:
      event.type ?? "activity",
    title: event.title,
    text:
      event.description ??
      "Açıklama kaydedilmedi.",
    createdAt: event.created_at,
    dateLabel: formatDate(
      event.created_at,
    ),
  };
}

function mapTimelineConversation(
  event: TimelineEvent,
): WorkspaceConversationItem {
  return {
    id: `timeline-${event.id}`,
    source: "timeline",
    icon: getTimelineIcon(
      event.type,
    ),
    type:
      event.type ?? "activity",
    title: event.title,
    text:
      event.description ??
      "Açıklama kaydedilmedi.",
    createdAt: event.created_at,
    dateLabel: formatDate(
      event.created_at,
    ),
  };
}

function mapEmailConversation(
  email: EmailRecord,
): WorkspaceConversationItem {
  const createdAt =
    email.sent_at ??
    email.created_at;

  return {
    id: `email-${email.id}`,
    source: "email",
    icon: "✉️",
    type: email.status,
    title:
      email.subject ??
      "Konusuz e-posta",
    text:
      email.body ??
      "E-posta içeriği kaydedilmedi.",
    createdAt,
    dateLabel:
      formatDate(createdAt),
  };
}

function mapReminderConversation(
  reminder: Reminder,
): WorkspaceConversationItem {
  const createdAt =
    reminder.due_date ??
    reminder.created_at;

  return {
    id: `reminder-${reminder.id}`,
    source: "reminder",
    icon: "📅",
    type: "reminder",
    title: reminder.title,
    text: reminder.completed
      ? "Hatırlatıcı tamamlandı."
      : "Hatırlatıcı bekliyor.",
    createdAt,
    dateLabel:
      formatDate(createdAt),
  };
}

function mapCallNoteConversation(
  note: import("../../../types/database").CallNote,
  contactName: string,
): WorkspaceConversationItem {
  return {
    id: `call-note-${note.id}`,
    source: "call-note",
    icon: "📝",
    type: "note",
    title: `Görüşme Notu · ${contactName}`,
    text: note.note,
    createdAt: note.updated_at,
    dateLabel: formatDate(
      note.updated_at,
    ),
  };
}

function mapAiMemoryConversation(
  aiMemory: AiMemory,
): WorkspaceConversationItem {
  return {
    id: `ai-memory-${aiMemory.id}`,
    source: "ai-memory",
    icon: "🧠",
    type: "ai-memory",
    title: "VIAWA AI Hafızası",
    text:
      translateSystemGeneratedText(
        aiMemory.summary,
      ) || "Kayıtlı AI hafızası yok.",
    createdAt:
      aiMemory.created_at,
    dateLabel: formatDate(
      aiMemory.created_at,
    ),
  };
}

function getConfidenceLabel(
  confidence: number,
): string {
  if (confidence >= 75) {
    return `Yüksek · ${confidence}%`;
  }

  if (confidence >= 40) {
    return `Orta · ${confidence}%`;
  }

  return `Düşük · ${confidence}%`;
}

function getInterestLevelLabel(
  interestLevel: number,
): string {
  if (interestLevel >= 75) {
    return "Yüksek";
  }

  if (interestLevel >= 40) {
    return "Orta";
  }

  return "Düşük";
}

function createAiMemories(
  aiMemory: AiMemory | null,
): WorkspaceAiMemory[] {
  if (!aiMemory?.summary) {
    return [];
  }

  return [
    {
      id: aiMemory.id,
      category: "general",
      categoryLabel: "Genel",
      content: aiMemory.summary,
      importance: Math.max(
        1,
        Math.min(
          10,
          Math.round(
            aiMemory.confidence /
              10,
          ),
        ),
      ),
      createdAt:
        aiMemory.created_at,
      dateLabel: formatDate(
        aiMemory.created_at,
      ),
    },
  ];
}

function createConversationHistory(
  timelineEvents: TimelineEvent[],
  callNotes: import("../../../types/database").CallNote[],
  reminders: Reminder[],
  emails: EmailRecord[],
  aiMemory: AiMemory | null,
  contactName: string,
): WorkspaceConversationItem[] {
  const timelineItems =
    timelineEvents.map(
      mapTimelineConversation,
    );

  const callNoteItems =
    callNotes.map((note) =>
      mapCallNoteConversation(
        note,
        contactName,
      ),
    );

  const reminderItems =
    reminders.map(
      mapReminderConversation,
    );

  const emailItems =
    emails.map(
      mapEmailConversation,
    );

  const aiMemoryItems =
    aiMemory?.summary
      ? [
          mapAiMemoryConversation(
            aiMemory,
          ),
        ]
      : [];

  return [
    ...timelineItems,
    ...callNoteItems,
    ...emailItems,
    ...reminderItems,
    ...aiMemoryItems,
  ].sort(
    (
      firstItem,
      secondItem,
    ) =>
      new Date(
        secondItem.createdAt,
      ).getTime() -
      new Date(
        firstItem.createdAt,
      ).getTime(),
  );
}

type CreateCallWorkspaceViewModelInput = {
  company: Company;
  opportunity: Opportunity;
  timelineEvents: TimelineEvent[];
  reminders: Reminder[];
  emails: EmailRecord[];
  callNotes: import("../../../types/database").CallNote[];
  aiMemory: AiMemory | null;
  exhibitions?: Exhibition[];
};

export function createCallWorkspaceViewModel({
  company,
  opportunity,
  timelineEvents,
  reminders,
  emails,
  callNotes,
  aiMemory,
  exhibitions,
}: CreateCallWorkspaceViewModelInput): CallWorkspaceViewModel {
  const stage =
    normalizeStage(
      opportunity.stage,
    );

  const safeExhibitions =
    exhibitions ?? [];

  const matchedExhibition =
    opportunity.exhibition_id
      ? safeExhibitions.find(
          (exhibitionRecord) =>
            exhibitionRecord.id ===
            opportunity.exhibition_id,
        )
      : undefined;

  const sortedTimeline = [
    ...timelineEvents,
  ].sort(
    (
      firstEvent,
      secondEvent,
    ) =>
      new Date(
        secondEvent.created_at,
      ).getTime() -
      new Date(
        firstEvent.created_at,
      ).getTime(),
  );

  const sortedReminders = [
    ...reminders,
  ]
    .filter(
      (reminder) =>
        !reminder.completed,
    )
    .sort(
      (
        firstReminder,
        secondReminder,
      ) =>
        new Date(
          firstReminder.due_date ??
            "9999-12-31",
        ).getTime() -
        new Date(
          secondReminder.due_date ??
            "9999-12-31",
        ).getTime(),
    );

  const latestTimelineEvent =
    sortedTimeline[0];

  const confidence = Math.max(
    0,
    Math.min(
      100,
      aiMemory?.confidence ??
        50,
    ),
  );

  const confidenceLabel =
    getConfidenceLabel(
      confidence,
    );

  const aiMemories =
    createAiMemories(
      aiMemory,
    );

  const contactName =
    company.contact_person?.trim() ||
    "Birincil kişi yok";

  const conversationHistory =
    createConversationHistory(
      sortedTimeline,
      callNotes,
      reminders,
      emails,
      aiMemory,
      contactName,
    );

  const conversationMetrics =
    createConversationMetrics(
      conversationHistory,
    );

  const nextAction =
    getWorkspaceFollowUpActionLabel(
      opportunity.next_action,
    );

  return {
    company: {
      id: company.id,
      name: cleanValue(
        company.company_name,
      ),
      industry:
        cleanValue(
          company.industry,
        ) || "Atanmadı",
      country:
        cleanValue(
          company.country,
        ) || "Kayıtlı değil",
      city: "Kayıtlı değil",
      location:
        cleanValue(
          company.country,
        ) || "Kayıtlı değil",
      website:
        cleanValue(
          company.website,
        ) || "Kayıtlı değil",
      email:
        cleanValue(
          company.email,
        ) || "Kayıtlı değil",
      phone:
        cleanValue(
          company.phone,
        ) || "Kayıtlı değil",
      notes: "",
      status: company.status,
      createdAt:
        company.created_at,
      updatedAt:
        company.updated_at,
    },

    customer: {
      id: null,
      firstName:
        cleanValue(contactName),
      lastName: "",
      fullName:
        cleanValue(contactName),
      title: "Rol atanmadı",
      email:
        cleanValue(
          company.email,
        ) || "Kayıtlı değil",
      phone:
        cleanValue(
          company.phone,
        ) || "Kayıtlı değil",
      isPrimary: Boolean(
        company.contact_person,
      ),
    },

    opportunity: {
      id: opportunity.id,
      companyId:
        opportunity.company_id,
      exhibitionId:
        opportunity.exhibition_id,
      title:
        "Katılım Fırsatı",
      stage,
      stageLabel:
        formatStageLabel(stage),
      interestLevel:
        opportunity.interest_level,
      interestLevelLabel:
        getInterestLevelLabel(
          opportunity.interest_level,
        ),
      estimatedValue:
        opportunity.estimated_value,
      currency:
        opportunity.price_currency ?? "",
      formattedEstimatedValue:
        `${formatEstimatedValue(
          opportunity.price_grand_total ??
            opportunity.estimated_value,
        )}${opportunity.price_currency ? ` ${opportunity.price_currency}` : ""}`,
      standTypeLabel: formatStandType(
        opportunity.price_stand_type,
      ),
      priceCalculatedAt:
        opportunity.price_calculated_at ?? null,
      priceCalculatedDateLabel:
        formatDate(
          opportunity.price_calculated_at,
        ),
      quotationSent:
        isForwardStageTransition(
          "quotation-sent",
          stage,
        ),
      probability:
        opportunity.interest_level,
      probabilityLabel:
        `${opportunity.interest_level}%`,
      nextAction,
      nextActionAt:
        opportunity.next_action_date,
      nextActionDateLabel:
        formatDate(
          opportunity.next_action_date,
        ),
      lastContactAt:
        latestTimelineEvent?.created_at ??
        null,
      lastContactDateLabel:
        formatDate(
          latestTimelineEvent?.created_at,
        ),
      owner:
        opportunity.owner ??
        "Atanmadı",
      createdAt:
        opportunity.created_at,
      updatedAt:
        opportunity.updated_at,
    },

    exhibition: {
      id:
        opportunity.exhibition_id,
      name: resolveExhibitionName(
        matchedExhibition,
      ),
      organizer:
        resolveExhibitionOrganizer(
          matchedExhibition,
        ),
      hall: "Atanmadı",
      booth: "Atanmadı",
      standSizeSqm:
        opportunity.price_stand_area_sqm ?? null,
      standSizeLabel:
        opportunity.price_stand_area_sqm != null
          ? `${opportunity.price_stand_area_sqm} m²`
          : "â€”",
      floorPlanStatus:
        stage ===
        "information-sent"
          ? "Kroki Gönderildi"
          : "Kroki Bekleniyor",
      quotationStatus:
        stage ===
          "quotation-ready" ||
        stage ===
          "proposal-ready" ||
        stage ===
          "quotation-sent" ||
        stage ===
          "negotiation" ||
        stage === "contract" ||
        stage === "signed"
          ? formatStageLabel(stage)
          : "Sözleşme Bekleniyor",
    },

    tasks: [],

    reminders:
      sortedReminders.map(
        (reminder) => ({
          id: reminder.id,
          title:
            reminder.title,
          description: "",
          remindAt:
            reminder.due_date,
          remindDateLabel:
            formatDate(
              reminder.due_date,
            ),
          completed:
            reminder.completed,
        }),
      ),

    timeline:
      sortedTimeline.map(
        mapTimelineEvent,
      ),

    conversationHistory,

    conversationMetrics,

    ai: {
      confidence,
      confidenceLabel,

      conversationSummary:
        createConversationSummary(
          conversationHistory,
          conversationMetrics,
        ),

      latestMemory:
        aiMemory?.summary ??
        "Henüz AI hafızası kaydedilmedi.",

      riskAnalysis:
        createRiskAnalysis(
          conversationMetrics,
        ),

      nextBestAction:
        createNextBestAction(
          conversationMetrics,
          stage,
        ),

      memories:
        aiMemories,

      createdAt:
        aiMemory?.created_at ??
        null,

      updatedAt:
        aiMemory?.updated_at ??
        null,
    },

    session: {
      status: "active",
      statusLabel: "Aktif",
      notes: "",
    },
  };
}
