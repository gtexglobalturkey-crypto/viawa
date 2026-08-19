import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";

import type { Reminder } from "../../services/supabase/reminderService";
import { Panel } from "../ui/Panel";

type Props = {
  data: {
    overdueReminders: Reminder[];
    todayReminders: Reminder[];
    companyNames: Map<string, string>;
  };
};

function formatTime(value: string | null) {
  if (!value) {
    return "Zaman planlanmadı";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Geçersiz saat";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function cleanStoredText(value: string) {
  return value
    .replace(
      /^(company_name|company|reminder|title|task|action)\s*:\s*/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCompanyName(value?: string) {
  if (!value) {
    return "Bilinmeyen Şirket";
  }

  const cleanedValue = cleanStoredText(value);

  return cleanedValue || "Bilinmeyen Şirket";
}

const ENGINE_TITLE_TRANSLATIONS: Record<
  string,
  string
> = {
  "Schedule follow-up call":
    "Takip araması planlayın",
  "Wait for quotation feedback":
    "Teklif geri bildirimini bekleyin",
  "Negotiate final offer":
    "Son teklifi müzakere edin",
  "Track signed contract":
    "İmzalanan sözleşmeyi takip edin",
  "Review call outcome and complete next action":
    "Arama sonucunu değerlendirin ve sonraki adımı tamamlayın",
};

function normalizeReminderTitle(title: string) {
  const cleanedTitle = cleanStoredText(title);

  const engineMatch =
    ENGINE_TITLE_TRANSLATIONS[cleanedTitle];

  if (engineMatch) {
    return engineMatch;
  }

  const value = cleanedTitle.toLowerCase();

  if (
    value.includes("follow up") ||
    value.includes("follow-up")
  ) {
    return "Müşteriyle takip görüşmesi yapın";
  }

  if (
    value.includes("quotation") ||
    value.includes("quote")
  ) {
    return "Teklif sürecine devam edin";
  }

  if (
    value.includes("information package") ||
    value.includes("info package")
  ) {
    return "Bilgi paketini gönderin";
  }

  if (
    value.includes("email") ||
    value.includes("mail")
  ) {
    return "E-posta yazışmasına devam edin";
  }

  if (
    value.includes("call") ||
    value.includes("phone")
  ) {
    return "Müşteriyi arayın";
  }

  return cleanedTitle || "Bu müşteri işlemini gözden geçirin";
}

export function NeedsAttentionCard({
  data,
}: Props) {
  const priorityItems = [
    ...data.overdueReminders.map((item) => ({
      ...item,
      overdue: true,
    })),
    ...data.todayReminders.map((item) => ({
      ...item,
      overdue: false,
    })),
  ].slice(0, 5);

  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Öncelikli Konular
          </p>

          <h2 style={{ margin: 0, fontSize: "14px", lineHeight: 1.2 }}>
            Dikkat Gerektirenler
          </h2>
        </div>

        {priorityItems.length === 0 ? (
          <div
            className="today-action-row"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "8px 0 0",
              minWidth: 0,
            }}
          >
            <div
              style={{
                flex: "0 0 auto",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "999px",
                background: "var(--viawa-soft)",
              }}
            >
              <CheckCircle2 size={16} />
            </div>

            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: "12px", lineHeight: 1.3 }}>
                Bekleyen acil işlem yok.
              </strong>

              <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                Planlanan müşteri işleriniz kontrol
                altında.
              </p>
            </div>
          </div>
        ) : (
          <div className="data-list" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
            {priorityItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  minWidth: 0,
                  padding: "0",
                }}
              >
                <div
                  style={{
                    flex: "0 0 auto",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    background: item.overdue ? "#fff3e7" : "var(--viawa-soft)",
                    color: item.overdue ? "#b46b00" : "inherit",
                  }}
                >
                  {item.overdue ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <CalendarClock size={16} />
                  )}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "12px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                      {normalizeReminderTitle(
                        item.title,
                      )}
                    </strong>

                    <span
                      style={{
                        fontSize: "8px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        padding: "2px 6px",
                        borderRadius: "999px",
                        background: item.overdue ? "#fff3e7" : "var(--viawa-soft)",
                        color: item.overdue ? "#b46b00" : "inherit",
                      }}
                    >
                      {item.overdue ? "Gecikmiş" : "Bugün"}
                    </span>
                  </div>

                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                    {cleanCompanyName(
                      data.companyNames.get(
                        item.company_id,
                      ),
                    )}
                    {" · "}
                    {item.overdue
                      ? "Gecikmiş işlem"
                      : `Bugün saat ${formatTime(
                          item.due_date,
                        )} itibarıyla`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}