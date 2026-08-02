import type {
  WorkspaceConversationItem,
  WorkspaceConversationMetrics,
} from "../models/workspaceViewModel";

import type {
  OpportunityStage,
} from "../../../types/salesAction";

const DAY_IN_MS =
  24 * 60 * 60 * 1000;

function clampScore(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(100, value),
  );
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "Aktivite kaydedilmedi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Aktivite kaydedilmedi";
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

function getDaysSince(
  value?: string | null,
): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const difference =
    Date.now() - date.getTime();

  if (difference <= 0) {
    return 0;
  }

  return Math.floor(
    difference / DAY_IN_MS,
  );
}

function getActivityScoreLabel(
  score: number,
): string {
  if (score >= 75) {
    return "Yüksek";
  }

  if (score >= 40) {
    return "Orta";
  }

  return "Düşük";
}

function getRiskScoreLabel(
  score: number,
): string {
  if (score >= 70) {
    return "Yüksek";
  }

  if (score >= 35) {
    return "Orta";
  }

  return "Düşük";
}

function isReminderOverdue(
  item: WorkspaceConversationItem,
): boolean {
  if (
    item.source !== "reminder" ||
    item.text === "Hatırlatıcı tamamlandı."
  ) {
    return false;
  }

  const reminderDate =
    new Date(item.createdAt);

  if (
    Number.isNaN(
      reminderDate.getTime(),
    )
  ) {
    return false;
  }

  return (
    reminderDate.getTime() <
    Date.now()
  );
}

function isUnansweredEmail(
  item: WorkspaceConversationItem,
): boolean {
  if (item.source !== "email") {
    return false;
  }

  return (
    item.type === "draft" ||
    item.type === "sent" ||
    item.type === "pending"
  );
}

function getLatestRelevantItem(
  conversationHistory:
    WorkspaceConversationItem[],
): WorkspaceConversationItem | null {
  const sortedHistory = [
    ...conversationHistory,
  ].sort(
    (firstItem, secondItem) =>
      new Date(
        secondItem.createdAt,
      ).getTime() -
      new Date(
        firstItem.createdAt,
      ).getTime(),
  );

  return (
    sortedHistory.find(
      (item) =>
        item.source !== "ai-memory",
    ) ??
    sortedHistory[0] ??
    null
  );
}

function getStageAction(
  stage: OpportunityStage,
): string {
  switch (stage) {
    case "new":
      return "İlk teması kurun ve doğru karar vericiyi belirleyin.";

    case "contacted":
      return "Müşterinin ilgisini teyit edin ve bilgi paketini gönderin.";

    case "interested":
      return "İlgili fuar bilgilerini hazırlayıp gönderin.";

    case "information-sent":
      return "Takip edin ve müşterinin belgeleri inceleyip incelemediğini teyit edin.";

    case "quotation-ready":
      return "Onaylanan fiyattan teklif belgesini oluşturun.";

    case "proposal-ready":
      return "Teklif belgesi hazır, Teklif e-postasını müşteriye gönderin.";

    case "quotation-sent":
      return "Teklifi gözden geçirmek ve itirazları belirlemek için müşteriyle iletişime geçin.";

    case "negotiation":
      return "Kalan itirazları netleştirin ve gerekirse revize bir teklif hazırlayın.";

    case "contract":
      return "İç onay ve sözleşme imzasını takip edin.";

    case "signed":
      return "Katılım sürecini tamamlayın ve sonraki operasyonel adımları teyit edin.";

    case "lost":
      return "Kayıp nedenini kaydedin ve gelecekteki bir yeniden aktivasyon tarihi planlayın.";

    default:
      return "Müşteri kaydını gözden geçirin ve sonraki satış aksiyonunu belirleyin.";
  }
}

export function createConversationMetrics(
  conversationHistory:
    WorkspaceConversationItem[],
): WorkspaceConversationMetrics {
  const sortedHistory = [
    ...conversationHistory,
  ].sort(
    (firstItem, secondItem) =>
      new Date(
        secondItem.createdAt,
      ).getTime() -
      new Date(
        firstItem.createdAt,
      ).getTime(),
  );

  const lastActivityAt =
    sortedHistory[0]?.createdAt ??
    null;

  const daysSinceLastActivity =
    getDaysSince(lastActivityAt);

  const timelineCount =
    conversationHistory.filter(
      (item) =>
        item.source === "timeline",
    ).length;

  const callNoteCount =
    conversationHistory.filter(
      (item) =>
        item.source === "call-note",
    ).length;

  const emailCount =
    conversationHistory.filter(
      (item) =>
        item.source === "email",
    ).length;

  const reminderCount =
    conversationHistory.filter(
      (item) =>
        item.source === "reminder",
    ).length;

  const aiMemoryCount =
    conversationHistory.filter(
      (item) =>
        item.source === "ai-memory",
    ).length;

  const pendingReminderCount =
    conversationHistory.filter(
      (item) =>
        item.source === "reminder" &&
        item.text !==
          "Reminder completed.",
    ).length;

  const overdueReminderCount =
    conversationHistory.filter(
      isReminderOverdue,
    ).length;

  const unansweredEmailCount =
    conversationHistory.filter(
      isUnansweredEmail,
    ).length;

  const followUpOverdue =
    overdueReminderCount > 0;

  const recencyScore =
    daysSinceLastActivity === null
      ? 0
      : daysSinceLastActivity <= 1
        ? 40
        : daysSinceLastActivity <= 3
          ? 30
          : daysSinceLastActivity <= 7
            ? 20
            : daysSinceLastActivity <= 14
              ? 10
              : 0;

  const volumeScore =
    Math.min(
      40,
      conversationHistory.length * 4,
    );

  const diversityScore =
    Math.min(
      20,
      [
        timelineCount,
        callNoteCount,
        emailCount,
        reminderCount,
        aiMemoryCount,
      ].filter(
        (count) => count > 0,
      ).length * 4,
    );

  const activityScore =
    clampScore(
      recencyScore +
        volumeScore +
        diversityScore,
    );

  const inactivityRisk =
    daysSinceLastActivity === null
      ? 35
      : daysSinceLastActivity >= 30
        ? 40
        : daysSinceLastActivity >= 14
          ? 30
          : daysSinceLastActivity >= 7
            ? 20
            : daysSinceLastActivity >= 3
              ? 10
              : 0;

  const riskScore =
    clampScore(
      inactivityRisk +
        overdueReminderCount * 20 +
        unansweredEmailCount * 10,
    );

  return {
    totalItems:
      conversationHistory.length,

    timelineCount,
    callNoteCount,
    emailCount,
    reminderCount,
    aiMemoryCount,

    lastActivityAt,
    lastActivityDateLabel:
      formatDate(lastActivityAt),

    daysSinceLastActivity,

    unansweredEmailCount,
    pendingReminderCount,
    overdueReminderCount,

    followUpOverdue,

    activityScore,
    activityScoreLabel:
      getActivityScoreLabel(
        activityScore,
      ),

    riskScore,
    riskScoreLabel:
      getRiskScoreLabel(riskScore),
  };
}

export function createConversationSummary(
  conversationHistory:
    WorkspaceConversationItem[],
  metrics: WorkspaceConversationMetrics,
): string {
  const latestItem =
    getLatestRelevantItem(
      conversationHistory,
    );

  if (!latestItem) {
    return "Henüz müşteriyle ilgili bir görüşme veya aktivite kaydedilmedi.";
  }

  const activityDescription =
    metrics.daysSinceLastActivity === null
      ? "Yakın zamanda kaydedilmiş bir aktivite tarihi yok."
      : metrics.daysSinceLastActivity === 0
        ? "Son aktivite bugün kaydedildi."
        : metrics.daysSinceLastActivity === 1
          ? "Son aktivite dün kaydedildi."
          : `Son aktivite ${metrics.daysSinceLastActivity} gün önce kaydedildi.`;

  const pendingDescription =
    metrics.overdueReminderCount > 0
      ? ` ${metrics.overdueReminderCount} gecikmiş takip hatırlatıcısı var.`
      : metrics.pendingReminderCount > 0
        ? ` ${metrics.pendingReminderCount} bekleyen hatırlatıcı var.`
        : "";

  return (
    `${activityDescription} ` +
    `Son kaydedilen öğe: "${latestItem.title}". ` +
    `${latestItem.text}` +
    pendingDescription
  );
}

export function createRiskAnalysis(
  metrics: WorkspaceConversationMetrics,
): string {
  if (metrics.totalItems === 0) {
    return "Herhangi bir müşteri aktivitesi kaydedilmediği için risk güvenilir şekilde değerlendirilemiyor.";
  }

  const risks: string[] = [];

  if (metrics.overdueReminderCount > 0) {
    risks.push(
      `${metrics.overdueReminderCount} gecikmiş takip hatırlatıcısı dikkat gerektiriyor`,
    );
  }

  if (metrics.unansweredEmailCount > 0) {
    risks.push(
      `${metrics.unansweredEmailCount} e-posta takip gerektirebilir`,
    );
  }

  if (
    metrics.daysSinceLastActivity !== null &&
    metrics.daysSinceLastActivity >= 14
  ) {
    risks.push(
      `${metrics.daysSinceLastActivity} gündür yeni bir aktivite yok`,
    );
  }

  if (risks.length === 0) {
    return `Mevcut satış riski %${metrics.riskScore} ile ${metrics.riskScoreLabel.toLowerCase()} seviyesinde. Şu anda acil bir takip riski tespit edilmedi.`;
  }

  return (
    `Mevcut satış riski %${metrics.riskScore} ile ${metrics.riskScoreLabel.toLowerCase()} seviyesinde. ` +
    `${risks.join("; ")}.`
  );
}

export function createNextBestAction(
  metrics: WorkspaceConversationMetrics,
  stage: OpportunityStage,
): string {
  if (metrics.overdueReminderCount > 0) {
    return "Başka bir müşteri aktivitesine başlamadan önce gecikmiş takibi tamamlayın.";
  }

  if (metrics.unansweredEmailCount > 0) {
    return "Son e-postayı gözden geçirin ve alındığını ve yanıtını teyit etmek için müşteriyle iletişime geçin.";
  }

  if (
    metrics.daysSinceLastActivity === null ||
    metrics.daysSinceLastActivity >= 14
  ) {
    return "Müşteriyle yeniden iletişime geçin ve fırsatın hâlâ aktif olup olmadığını teyit edin.";
  }

  if (
    metrics.pendingReminderCount > 0
  ) {
    return "Sıradaki planlanmış hatırlatıcıyı tamamlayın ve sonucunu kaydedin.";
  }

  return getStageAction(stage);
}