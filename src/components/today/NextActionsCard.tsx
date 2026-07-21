import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Phone,
  ReceiptText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { EmailRecord } from "../../services/supabase/emailService";
import type { Reminder } from "../../services/supabase/reminderService";

import { Panel } from "../ui/Panel";

type Props = {
  data: {
    overdueReminders: Reminder[];
    pendingCalls: Reminder[];
    draftEmails: EmailRecord[];
    todayReminders: Reminder[];
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
  typeLabel: string;
  icon: LucideIcon;
};

type QueueItem = {
  key: string;
  icon: LucideIcon;
  typeLabel: string;
  companyName: string;
  title: string;
  value: string;
  priority: "Yüksek" | "Orta" | "Normal";
  dueDate: string | null;
  href: string;
};

function cleanText(
  value: string | null | undefined,
): string {
  return value
    ?.replace(
      /^(company_name|company|reminder|title|task|action|subject|email)\s*:\s*/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

function getCompanyName(
  companyId: string | null | undefined,
  companyNames: Map<string, string>,
): string {
  if (!companyId) {
    return "Customer";
  }

  return (
    cleanText(
      companyNames.get(companyId),
    ) || "Customer"
  );
}

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

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const cleanedTitle = cleanText(title);

  const engineMatch =
    ENGINE_TITLE_TRANSLATIONS[
      cleanedTitle
    ];

  if (engineMatch) {
    return engineMatch;
  }

  const normalizedTitle =
    cleanedTitle.toLowerCase();

  if (
    normalizedTitle.includes(
      "follow up",
    ) ||
    normalizedTitle.includes(
      "follow-up",
    )
  ) {
    return "Müşteriyle takip görüşmesi yapın";
  }

  if (
    normalizedTitle.includes(
      "quotation",
    ) ||
    normalizedTitle.includes("quote")
  ) {
    return "Teklif sürecine devam edin";
  }

  if (
    normalizedTitle.includes(
      "information package",
    ) ||
    normalizedTitle.includes(
      "info package",
    )
  ) {
    return "Bilgi paketini gönderin";
  }

  if (
    normalizedTitle.includes("email") ||
    normalizedTitle.includes("mail")
  ) {
    return "E-posta yazışmasına devam edin";
  }

  if (
    normalizedTitle.includes("call") ||
    normalizedTitle.includes("phone")
  ) {
    return "Müşteriyi arayın";
  }

  return (
    cleanedTitle ||
    "Planlanan görevi tamamlayın"
  );
}

function getEmailTitle(
  email: EmailRecord,
): string {
  const subject =
    cleanText(email.subject);

  if (!subject) {
    return "Taslak e-postayı tamamlayıp gönderin";
  }

  return subject;
}

function getActionDetails(
  title: string,
): ActionDetails {
  const value = cleanText(
    title,
  ).toLowerCase();

  if (
    value.includes("follow up") ||
    value.includes("follow-up")
  ) {
    return {
      type: "follow-up",
      typeLabel: "Takip",
      icon: Phone,
    };
  }

  if (
    value.includes("quotation") ||
    value.includes("quote")
  ) {
    return {
      type: "quotation",
      typeLabel: "Teklif",
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
      typeLabel: "E-posta",
      icon: Mail,
    };
  }

  if (
    value.includes("call") ||
    value.includes("phone")
  ) {
    return {
      type: "call",
      typeLabel: "Arama",
      icon: Phone,
    };
  }

  return {
    type: "task",
    typeLabel: "Görev",
    icon: ArrowRight,
  };
}

function getActionHref(
  companyId: string,
  action: ActionDetails,
): string {
  const encodedCompanyId =
    encodeURIComponent(companyId);

  if (
    action.type === "call" ||
    action.type === "follow-up"
  ) {
    return `/call?companyId=${encodedCompanyId}`;
  }

  if (action.type === "quotation") {
    return (
      `/communication?companyId=${encodedCompanyId}` +
      "&template=Quotation"
    );
  }

  if (action.type === "email") {
    return (
      `/communication?companyId=${encodedCompanyId}` +
      "&template=Information%20Package"
    );
  }

  return `/companies/${encodedCompanyId}`;
}

function createReminderItem(
  reminder: Reminder,
  companyNames: Map<string, string>,
  options: {
    value: string;
    priority: QueueItem["priority"];
    prefix: string;
    forceAction?: ActionDetails;
  },
): QueueItem {
  const action =
    options.forceAction ??
    getActionDetails(reminder.title);

  return {
    key: `${options.prefix}-${reminder.id}`,
    icon: action.icon,
    typeLabel: action.typeLabel,
    companyName: getCompanyName(
      reminder.company_id,
      companyNames,
    ),
    title: normalizeReminderTitle(
      reminder.title,
    ),
    value: options.value,
    priority: options.priority,
    dueDate: reminder.due_date,
    href: getActionHref(
      reminder.company_id,
      action,
    ),
  };
}

export function NextActionsCard({
  data,
}: Props) {
  const queue: QueueItem[] = [];

  const addedReminderIds =
    new Set<string>();

  const overdueReminder =
    data.overdueReminders[0] ?? null;

  if (overdueReminder) {
    queue.push(
      createReminderItem(
        overdueReminder,
        data.companyNames,
        {
          value: `${data.overdueReminders.length} geciken`,
          priority: "Yüksek",
          prefix: "overdue",
        },
      ),
    );

    addedReminderIds.add(
      overdueReminder.id,
    );
  }

  const pendingCall =
    data.pendingCalls.find(
      (reminder) =>
        !addedReminderIds.has(
          reminder.id,
        ),
    ) ?? null;

  if (pendingCall) {
    queue.push(
      createReminderItem(
        pendingCall,
        data.companyNames,
        {
          value: `${data.pendingCalls.length} arama`,
          priority: "Yüksek",
          prefix: "call",
          forceAction: {
            type: "call",
            typeLabel: "Arama",
            icon: Phone,
          },
        },
      ),
    );

    addedReminderIds.add(
      pendingCall.id,
    );
  }

  const draftEmail =
    data.draftEmails[0] ?? null;

  if (draftEmail) {
    const emailAction: ActionDetails = {
      type: "email",
      typeLabel: "E-posta",
      icon: Mail,
    };

    queue.push({
      key: `email-${draftEmail.id}`,
      icon: emailAction.icon,
      typeLabel: emailAction.typeLabel,
      companyName: getCompanyName(
        draftEmail.company_id,
        data.companyNames,
      ),
      title: getEmailTitle(
        draftEmail,
      ),
      value: `${data.draftEmails.length} taslak`,
      priority: "Orta",
      dueDate: draftEmail.created_at,
      href: getActionHref(
        draftEmail.company_id,
        emailAction,
      ),
    });
  }

  const todayReminder =
    data.todayReminders.find(
      (reminder) =>
        !addedReminderIds.has(
          reminder.id,
        ),
    ) ?? null;

  if (todayReminder) {
    queue.push(
      createReminderItem(
        todayReminder,
        data.companyNames,
        {
          value: `${data.todayReminders.length} görev`,
          priority: "Normal",
          prefix: "today",
        },
      ),
    );
  }

  const visibleQueue =
    queue.slice(0, 3);

  return (
    <Panel>
      <p className="eyebrow" style={{ marginBottom: "4px" }}>
        Bugünkü İş Planı
      </p>

      <h2 style={{ margin: "0 0 8px", lineHeight: 1.2 }}>Sıradaki İşler</h2>

      {visibleQueue.length === 0 ? (
        <div className="today-action-row" style={{ gap: "8px", marginBottom: "0" }}>
          <CheckCircle2 size={18} />

          <div>
            <strong style={{ display: "block", lineHeight: 1.2, fontSize: "12px" }}>
              Şu anda sırada bekleyen iş bulunmuyor.
            </strong>
          </div>
        </div>
      ) : (
        <div className="data-list" style={{ gap: "7px", marginTop: "4px" }}>
          {visibleQueue.map(
            (item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  to={item.href}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "6px 0",
                    minWidth: 0,
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ flex: "0 0 auto", marginTop: "1px" }}>
                    <Icon size={16} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "12px", lineHeight: 1.2, overflowWrap: "anywhere" }}>
                        {item.companyName}
                      </strong>

                      <span
                        style={{
                          fontSize: "8px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          background: "var(--atlas-soft)",
                        }}
                      >
                        {item.typeLabel}
                      </span>
                    </div>

                    <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "11px", overflowWrap: "anywhere" }}>
                      {item.title}
                    </p>

                    <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "10px" }}>
                      {formatDate(item.dueDate)}
                      {" • "}
                      {item.value}
                      {" • "}
                      {item.priority} öncelik
                    </p>
                  </div>

                  <ArrowRight size={14} style={{ flex: "0 0 auto", marginTop: "2px" }} />
                </Link>
              );
            },
          )}
        </div>
      )}
    </Panel>
  );
}
