import type {
  AiMemory,
  Company,
  EmailRecord,
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

import type {
  CallWorkspaceViewModel,
  WorkspaceAiMemory,
  WorkspaceConversationItem,
  WorkspaceTimelineItem,
} from "./workspaceViewModel";

const OPPORTUNITY_STAGES: OpportunityStage[] = [
  "new",
  "contacted",
  "interested",
  "information-sent",
  "quotation-requested",
  "quotation-sent",
  "negotiation",
  "contract",
  "signed",
  "lost",
];

function normalizeStage(
  stage: string,
): OpportunityStage {
  if (
    OPPORTUNITY_STAGES.includes(
      stage as OpportunityStage,
    )
  ) {
    return stage as OpportunityStage;
  }

  return "new";
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
    "en-GB",
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

const STAGE_LABELS: Record<string, string> = {
  new: "Yeni",
  contacted: "İletişime Geçildi",
  interested: "İlgileniyor",
  "information-sent": "Bilgi Paketi Gönderildi",
  "quotation-requested": "Teklif Talep Edildi",
  "quotation-sent": "Teklif Gönderildi",
  negotiation: "Görüşme",
  contract: "Sözleşme",
  signed: "İmzalandı",
  lost: "Kaybedildi",
};

function formatStageLabel(
  value: string,
): string {
  return STAGE_LABELS[value] ?? formatLabel(value);
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
): WorkspaceConversationItem {
  return {
    id: `call-note-${note.id}`,
    source: "call-note",
    icon: "📝",
    type: "note",
    title: "Görüşme Notu",
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
    title: "Atlas AI Hafızası",
    text:
      aiMemory.summary ??
      "Kayıtlı AI hafızası yok.",
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
): WorkspaceConversationItem[] {
  const timelineItems =
    timelineEvents.map(
      mapTimelineConversation,
    );

  const callNoteItems =
    callNotes.map(mapCallNoteConversation);

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
};

export function createCallWorkspaceViewModel({
  company,
  opportunity,
  timelineEvents,
  reminders,
  emails,
  callNotes,
  aiMemory,
}: CreateCallWorkspaceViewModelInput): CallWorkspaceViewModel {
  const stage =
    normalizeStage(
      opportunity.stage,
    );

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

  const conversationHistory =
    createConversationHistory(
      sortedTimeline,
      callNotes,
      reminders,
      emails,
      aiMemory,
    );

  const conversationMetrics =
    createConversationMetrics(
      conversationHistory,
    );

  const contactName =
    company.contact_person?.trim() ||
    "Birincil kişi yok";

  const nextAction =
    opportunity.next_action ??
    createNextBestAction(
      conversationMetrics,
      stage,
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
      currency: "",
      formattedEstimatedValue:
        formatEstimatedValue(
          opportunity.estimated_value,
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
      name:
        "Fuar Katılımı",
      hall: "Atanmadı",
      booth: "Atanmadı",
      standSizeSqm: null,
      standSizeLabel:
        "Belirlenmedi",
      floorPlanStatus:
        stage ===
        "information-sent"
          ? "Kroki Gönderildi"
          : "Kroki Bekleniyor",
      quotationStatus:
        stage ===
          "quotation-requested" ||
        stage ===
          "quotation-sent" ||
        stage ===
          "negotiation" ||
        stage === "contract" ||
        stage === "signed"
          ? formatStageLabel(stage)
          : "Teklif Bekleniyor",
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