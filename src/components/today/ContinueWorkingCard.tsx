import {
  ArrowRight,
  CalendarDays,
  Mail,
  Phone,
  ReceiptText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { Reminder } from "../../services/supabase/reminderService";
import { Panel } from "../ui/Panel";

type Props = {
  data: {
    upcomingReminders: Reminder[];
    companyNames: Map<string, string>;
  };
};

type ActionType =
  | "call"
  | "follow-up"
  | "quotation"
  | "email"
  | "task";

type ActionDetails = {
  type: ActionType;
  label: string;
  title: string;
  icon: LucideIcon;
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Tarih planlanmadı";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Geçersiz tarih";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function cleanStoredText(
  value: string,
): string {
  return value
    .replace(
      /^(company_name|company|reminder|title|task|action)\s*:\s*/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCompanyName(
  value?: string,
): string {
  if (!value) {
    return "Bilinmeyen Şirket";
  }

  const cleanedValue =
    cleanStoredText(value);

  return (
    cleanedValue || "Bilinmeyen Şirket"
  );
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

function normalizeReminderTitle(
  title: string,
): string {
  const cleanedTitle =
    cleanStoredText(title);

  const engineMatch =
    ENGINE_TITLE_TRANSLATIONS[
      cleanedTitle
    ];

  if (engineMatch) {
    return engineMatch;
  }

  const value =
    cleanedTitle.toLowerCase();

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
    if (
      value.includes("send") ||
      value.includes("prepare")
    ) {
      return "Teklifi hazırlayıp gönderin";
    }

    return "Teklif sürecine devam edin";
  }

  if (
    value.includes(
      "information package",
    ) ||
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

  return (
    cleanedTitle ||
    "Müşteri görevine devam edin"
  );
}

function getActionDetails(
  title: string,
): ActionDetails {
  const value = cleanStoredText(
    title,
  ).toLowerCase();

  if (
    value.includes("follow up") ||
    value.includes("follow-up")
  ) {
    return {
      type: "follow-up",
      label: "Takip",
      title:
        normalizeReminderTitle(title),
      icon: Phone,
    };
  }

  if (
    value.includes("quotation") ||
    value.includes("quote")
  ) {
    return {
      type: "quotation",
      label: "Teklif",
      title:
        normalizeReminderTitle(title),
      icon: ReceiptText,
    };
  }

  if (
    value.includes("email") ||
    value.includes("mail") ||
    value.includes(
      "information package",
    ) ||
    value.includes("info package")
  ) {
    return {
      type: "email",
      label: "E-posta",
      title:
        normalizeReminderTitle(title),
      icon: Mail,
    };
  }

  if (
    value.includes("call") ||
    value.includes("phone")
  ) {
    return {
      type: "call",
      label: "Arama",
      title:
        normalizeReminderTitle(title),
      icon: Phone,
    };
  }

  return {
    type: "task",
    label: "Görev",
    title:
      normalizeReminderTitle(title),
    icon: ArrowRight,
  };
}

function getActionHref(
  reminder: Reminder,
): string {
  const action =
    getActionDetails(reminder.title);

  const companyId =
    encodeURIComponent(
      reminder.company_id,
    );

  if (
    action.type === "call" ||
    action.type === "follow-up"
  ) {
    return `/call?companyId=${companyId}`;
  }

  if (action.type === "quotation") {
    return (
      `/communication?companyId=${companyId}` +
      "&template=Quotation"
    );
  }

  if (action.type === "email") {
    return (
      `/communication?companyId=${companyId}` +
      "&template=Information%20Package"
    );
  }

  return `/companies/${companyId}`;
}

function createReminderKey(
  reminder: Reminder,
): string {
  const normalizedTitle =
    normalizeReminderTitle(
      reminder.title,
    ).toLowerCase();

  const dueDate =
    reminder.due_date ?? "";

  return [
    reminder.company_id,
    normalizedTitle,
    dueDate,
  ].join("|");
}

function getUniqueReminders(
  reminders: Reminder[],
): Reminder[] {
  const seen = new Set<string>();

  return reminders.filter(
    (reminder) => {
      const key =
        createReminderKey(reminder);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

export function ContinueWorkingCard({
  data,
}: Props) {
  const uniqueReminders =
    getUniqueReminders(
      data.upcomingReminders,
    ).slice(0, 3);

  const nextAction =
    uniqueReminders[0] ?? null;

  const remainingActions =
    uniqueReminders.slice(1);

  const nextActionDetails =
    nextAction
      ? getActionDetails(
          nextAction.title,
        )
      : null;

  const NextActionIcon =
    nextActionDetails?.icon ??
    ArrowRight;

  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Çalışmaya Devam Et
          </p>

          <h2 style={{ margin: 0, fontSize: "14px", lineHeight: 1.2 }}>
            Satış Sürecine Devam Et
          </h2>
        </div>

        {!nextAction && (
          <p className="muted" style={{ margin: 0, fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
            Harika. Sizi bekleyen planlanmış
            bir işlem yok.
          </p>
        )}

        {nextAction &&
          nextActionDetails && (
            <div className="continue-working-content" style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
              <div className="today-highlight-card" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                <div className="today-highlight-header" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <NextActionIcon
                    size={16}
                  />

                  <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {
                      nextActionDetails.label
                    }
                  </span>
                </div>

                <h3 style={{ margin: 0, fontSize: "12px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                  {
                    nextActionDetails.title
                  }
                </h3>

                <p className="muted" style={{ margin: 0, fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                  {cleanCompanyName(
                    data.companyNames.get(
                      nextAction.company_id,
                    ),
                  )}
                </p>

                <div className="today-highlight-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                    <CalendarDays
                      size={14}
                    />

                    <span style={{ fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                      {formatDate(
                        nextAction.due_date,
                      )}
                    </span>
                  </div>

                  <Link
                    className="button button-primary"
                    to={getActionHref(
                      nextAction,
                    )}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", fontSize: "11px" }}
                  >
                    Devam et

                    <ArrowRight
                      size={14}
                    />
                  </Link>
                </div>
              </div>

              {remainingActions.length >
                0 && (
                <div className="data-list continue-working-list" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                  {remainingActions.map(
                    (reminder) => {
                      const action =
                        getActionDetails(
                          reminder.title,
                        );

                      const ActionIcon =
                        action.icon;

                      return (
                        <Link
                          key={
                            reminder.id
                          }
                          to={getActionHref(
                            reminder,
                          )}
                          style={{ display: "flex", alignItems: "flex-start", gap: "8px", minWidth: 0, padding: "0" }}
                        >
                          <div style={{ flex: "0 0 auto", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "var(--atlas-soft)" }}>
                            <ActionIcon
                              size={14}
                            />
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong style={{ display: "block", fontSize: "11px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                              {
                                action.title
                              }
                            </strong>

                            <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                              {cleanCompanyName(
                                data.companyNames.get(
                                  reminder.company_id,
                                ),
                              )}

                              {" · "}

                              {formatDate(
                                reminder.due_date,
                              )}
                            </p>
                          </div>
                        </Link>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    </Panel>
  );
}