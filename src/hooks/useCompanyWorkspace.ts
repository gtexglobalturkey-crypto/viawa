import { useMemo } from "react";

import { useWorkspaceData } from "../modules/call-workspace/hooks/useWorkspaceData";

function formatDateValue(
  value?: string | null,
): string {
  if (!value) {
    return "Kayıtlı değil";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Kayıtlı değil";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function stripLabelPrefix(
  value?: string | null,
): string | undefined {
  if (!value) {
    return value ?? undefined;
  }

  return value
    .replace(/^[a-z][a-z0-9_]*\s*:\s*/i, "")
    .trim();
}

const STAGE_AND_STATUS_LABELS: Record<
  string,
  string
> = {
  lead: "Potansiyel Müşteri",
  prospect: "Aday Müşteri",
  customer: "Müşteri",
  inactive: "Pasif",
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
  activity: "Aktivite",
  call: "Arama",
  "call-completed": "Arama Tamamlandı",
  email: "E-posta",
  "email-sent": "E-posta Gönderildi",
  "followup-created": "Takip Oluşturuldu",
  "follow-up-created": "Takip Oluşturuldu",
  "reminder-created": "Hatırlatıcı Oluşturuldu",
  "quote-created": "Teklif Oluşturuldu",
  "quotation-created": "Teklif Oluşturuldu",
  "contract-sent": "Sözleşme Gönderildi",
  "contract-signed": "Sözleşme İmzalandı",
  "payment-received": "Ödeme Alındı",
  note: "Not",
  "note-created": "Not Oluşturuldu",
  "call-note": "Görüşme Notu",
  "ai-memory": "AI Hafızası",
  "stage-changed": "Aşama Değişti",
  "company-created": "Firma Oluşturuldu",
  meeting: "Toplantı",
};

function formatStageValue(
  stage?: string | null,
): string {
  const cleaned = stripLabelPrefix(stage);

  if (!cleaned) {
    return "Atanmadı";
  }

  const normalizedValue =
    cleaned.toLowerCase();

  if (
    STAGE_AND_STATUS_LABELS[normalizedValue]
  ) {
    return STAGE_AND_STATUS_LABELS[
      normalizedValue
    ];
  }

  return cleaned
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
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

function getInterestLabel(
  level: number,
): string {
  if (level >= 75) {
    return "Yüksek";
  }

  if (level >= 40) {
    return "Orta";
  }

  return "Düşük";
}

const NEXT_ACTION_LABELS: Record<
  string,
  string
> = {
  "schedule follow-up call":
    "Takip araması planlayın",
  "wait for quotation feedback":
    "Teklif geri bildirimini bekleyin",
  "negotiate final offer":
    "Son teklifi müzakere edin",
  "track signed contract":
    "İmzalanan sözleşmeyi takip edin",
  "review call outcome and complete next action":
    "Arama sonucunu değerlendirin ve sonraki adımı tamamlayın",
};

function formatNextActionValue(
  value?: string | null,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  return (
    NEXT_ACTION_LABELS[
      cleaned.toLowerCase()
    ] ?? cleaned
  );
}

export function useCompanyWorkspace(
  companyId?: string,
) {
  const workspace =
    useWorkspaceData(companyId);

  const derivedData = useMemo(() => {
    const {
      company,
      opportunities,
      timeline,
      reminders,
      aiMemory,
    } = workspace;

    const activeReminders = reminders
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

    const sortedTimeline = [
      ...timeline,
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

    const sortedOpportunities = [
      ...opportunities,
    ].sort(
      (
        firstOpportunity,
        secondOpportunity,
      ) =>
        new Date(
          secondOpportunity.updated_at,
        ).getTime() -
        new Date(
          firstOpportunity.updated_at,
        ).getTime(),
    );

    const latestTimelineEvent =
      sortedTimeline[0];

    const nextReminder =
      activeReminders[0];

    const primaryOpportunity =
      sortedOpportunities[0];

    const contactName =
      stripLabelPrefix(
        company?.contact_person,
      ) || "Birincil kişi yok";

    const nextAction =
      formatNextActionValue(
        nextReminder?.title,
      ) ??
      formatNextActionValue(
        primaryOpportunity?.next_action,
      ) ??
      "Planlanmış aksiyon yok";

    return {
      company,
      opportunities,
      timeline,
      reminders,
      aiMemory,
      activeReminders,
      sortedTimeline,
      sortedOpportunities,
      latestTimelineEvent,
      nextReminder,
      primaryOpportunity,
      contactName,
      nextAction,
    };
  }, [workspace]);

  return {
    ...workspace,
    ...derivedData,
    formatDate: formatDateValue,
    formatStage: formatStageValue,
    formatEstimatedValue,
    getInterestLabel,
  };
}