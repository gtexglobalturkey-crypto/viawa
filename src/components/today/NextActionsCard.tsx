import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Mail,
  Phone,
} from "lucide-react";

import type { ReactNode } from "react";

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

type QueueItem = {
  key: string;
  icon: ReactNode;
  companyName: string;
  title: string;
  value: string;
  priority: "Yüksek" | "Orta" | "Normal";
};

function cleanText(
  value: string | null | undefined,
): string {
  return value
    ?.replace(
      /^(company_name|company|reminder|title|task|action)\s*:\s*/i,
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
    cleanText(title);

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
    normalizedTitle.includes("call") ||
    normalizedTitle.includes("phone")
  ) {
    return "Müşteriyi arayın";
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

function createReminderItem(
  reminder: Reminder,
  companyNames: Map<string, string>,
  options: {
    icon: ReactNode;
    value: string;
    priority: QueueItem["priority"];
    prefix: string;
  },
): QueueItem {
  return {
    key: `${options.prefix}-${reminder.id}`,
    icon: options.icon,
    companyName: getCompanyName(
      reminder.company_id,
      companyNames,
    ),
    title: normalizeReminderTitle(
      reminder.title,
    ),
    value: options.value,
    priority: options.priority,
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
          icon: (
            <AlertTriangle size={16} />
          ),
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
          icon: <Phone size={16} />,
          value: `${data.pendingCalls.length} arama`,
          priority: "Yüksek",
          prefix: "call",
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
    queue.push({
      key: `email-${draftEmail.id}`,
      icon: <Mail size={16} />,
      companyName: getCompanyName(
        draftEmail.company_id,
        data.companyNames,
      ),
      title: getEmailTitle(
        draftEmail,
      ),
      value: `${data.draftEmails.length} taslak`,
      priority: "Orta",
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
          icon: (
            <CalendarDays size={16} />
          ),
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

      <h2 style={{ margin: "0 0 8px", lineHeight: 1.2 }}>İş Sırası</h2>

      {visibleQueue.length === 0 ? (
        <div className="today-action-row" style={{ gap: "8px", marginBottom: "0" }}>
          <CheckCircle2 size={18} />

          <div>
            <strong style={{ display: "block", lineHeight: 1.2, fontSize: "12px" }}>
              Potansiyel müşteri aramaya hazırsınız.
            </strong>

            <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "11px" }}>
              Bugün için bekleyen operasyonel
              görev yok.
            </p>
          </div>
        </div>
      ) : (
        <div className="data-list" style={{ gap: "7px", marginTop: "4px" }}>
          {visibleQueue.map(
            (item) => (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "6px 0",
                  minWidth: 0,
                }}
              >
                <div style={{ flex: "0 0 auto", marginTop: "1px" }}>
                  {item.icon}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: "block", lineHeight: 1.2, fontSize: "12px" }}>
                    {item.companyName}
                  </strong>

                  <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "11px" }}>
                    {item.title}
                  </p>

                  <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "10px" }}>
                    {item.value}
                    {" • "}
                    {item.priority} öncelik
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </Panel>
  );
}