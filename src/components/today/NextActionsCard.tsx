import {
  ArrowRight,
  CheckCircle2,
  FileSignature,
  Mail,
  Phone,
  ReceiptText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { EmailRecord } from "../../services/supabase/emailService";
import type { Reminder } from "../../services/supabase/reminderService";
import type { TimelineEvent } from "../../services/supabase/timelineService";

import { Panel } from "../ui/Panel";

type Props = {
  data: {
    overdueReminders: Reminder[];
    pendingCalls: Reminder[];
    draftEmails: EmailRecord[];
    todayReminders: Reminder[];
    upcomingReminders: Reminder[];
    companyNames: Map<string, string>;
    timelineEvents: TimelineEvent[];
  };
};

type SignatureStatusItem = {
  key: string;
  companyId: string;
  companyName: string;
  label: string;
};

function getMostRecentEventPerCompany(
  events: TimelineEvent[],
  companyNames: Map<string, string>,
): SignatureStatusItem[] {
  const latestByCompany = new Map<
    string,
    TimelineEvent
  >();

  for (const event of events) {
    const existing = latestByCompany.get(
      event.company_id,
    );

    if (
      !existing ||
      Date.parse(event.created_at) >
        Date.parse(existing.created_at)
    ) {
      latestByCompany.set(
        event.company_id,
        event,
      );
    }
  }

  return Array.from(
    latestByCompany.values(),
  ).map((event) => ({
    key: event.id,
    companyId: event.company_id,
    companyName: getCompanyName(
      event.company_id,
      companyNames,
    ),
    label: event.title,
  }));
}

function hasLaterSignedEvent(
  sentEvent: TimelineEvent,
  signedEvents: TimelineEvent[],
): boolean {
  return signedEvents.some(
    (signedEvent) =>
      signedEvent.company_id ===
        sentEvent.company_id &&
      Date.parse(
        signedEvent.created_at,
      ) >=
        Date.parse(
          sentEvent.created_at,
        ),
  );
}

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
    return "Müşteri";
  }

  return (
    cleanText(
      companyNames.get(companyId),
    ) || "Müşteri"
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

  return new Intl.DateTimeFormat("tr-TR", {
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

// Sprint 25.1 / Adım 3 — "quotation"-classified reminders here only
// ever come from the "Wait for quotation feedback" reminder
// (executionListeners.ts's follow-up on an already-sent quotation — see
// useTodayWorkflow.ts's EMAIL_TASK_TEMPLATE_IDS for the same reasoning),
// so this opens Revised Quotation, not Quotation — resending the
// original offer would be wrong here.
function getActionHref(
  companyId: string,
  action: ActionDetails,
  opportunityId?: string | null,
): string {
  const encodedCompanyId =
    encodeURIComponent(companyId);

  if (
    action.type === "call" ||
    action.type === "follow-up"
  ) {
    return `/call?companyId=${encodedCompanyId}`;
  }

  const emailTemplateId =
    action.type === "quotation"
      ? "Revised Quotation"
      : action.type === "email"
        ? "Information Package"
        : null;

  if (emailTemplateId) {
    const params = new URLSearchParams({
      companyId,
      openEmail: "true",
      template: emailTemplateId,
    });

    if (opportunityId) {
      params.set(
        "opportunityId",
        opportunityId,
      );
    }

    return `/call?${params.toString()}`;
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
      reminder.opportunity_id,
    ),
  };
}

function getReminderDuplicateKey(
  reminder: Reminder,
): string {
  if (
    reminder.opportunity_id &&
    reminder.task_type
  ) {
    return [
      "opportunity",
      reminder.opportunity_id,
      reminder.task_type,
    ].join(":");
  }

  return `reminder:${reminder.id}`;
}

export function NextActionsCard({
  data,
}: Props) {
  const queue: QueueItem[] = [];

  const addedReminderKeys =
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

    addedReminderKeys.add(
      getReminderDuplicateKey(
        overdueReminder,
      ),
    );
  }

  const pendingCall =
    data.pendingCalls.find(
      (reminder) =>
        !addedReminderKeys.has(
          getReminderDuplicateKey(
            reminder,
          ),
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

    addedReminderKeys.add(
      getReminderDuplicateKey(
        pendingCall,
      ),
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
        !addedReminderKeys.has(
          getReminderDuplicateKey(
            reminder,
          ),
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

    addedReminderKeys.add(
      getReminderDuplicateKey(
        todayReminder,
      ),
    );
  }

  const upcomingReminder =
    data.upcomingReminders.find(
      (reminder) =>
        !addedReminderKeys.has(
          getReminderDuplicateKey(
            reminder,
          ),
        ),
    ) ?? null;

  if (upcomingReminder) {
    queue.push(
      createReminderItem(
        upcomingReminder,
        data.companyNames,
        {
          value: `${data.upcomingReminders.length} yaklaşan`,
          priority: "Normal",
          prefix: "upcoming",
        },
      ),
    );

    addedReminderKeys.add(
      getReminderDuplicateKey(
        upcomingReminder,
      ),
    );
  }

  const visibleQueue =
    queue.slice(0, 3);

  const contractSentEvents =
    data.timelineEvents.filter(
      (event) =>
        event.type === "contract-sent",
    );

  const contractSignedEvents =
    data.timelineEvents.filter(
      (event) =>
        event.type ===
        "contract-signed",
    );

  const awaitingSignatureItems =
    getMostRecentEventPerCompany(
      contractSentEvents.filter(
        (event) =>
          !hasLaterSignedEvent(
            event,
            contractSignedEvents,
          ),
      ),
      data.companyNames,
    ).slice(0, 3);

  const signedItems =
    getMostRecentEventPerCompany(
      contractSignedEvents,
      data.companyNames,
    ).slice(0, 3);

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
        <div className="data-list" style={{ gap: "10px", marginTop: "4px" }}>
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
                    padding: "8px 0",
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
                        {item.title}
                      </strong>

                      <span
                        style={{
                          fontSize: "8px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          background: "var(--viawa-soft)",
                        }}
                      >
                        {item.typeLabel}
                      </span>
                    </div>

                    <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "11px", overflowWrap: "anywhere" }}>
                      {item.companyName}
                    </p>

                    <p className="muted" style={{ margin: "3px 0 0", lineHeight: 1.3, fontSize: "10px" }}>
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

      {awaitingSignatureItems.length > 0 ||
      signedItems.length > 0 ? (
        <div style={{ marginTop: "12px", borderTop: "1px solid var(--viawa-border, #e2e8f0)", paddingTop: "10px" }}>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            İmza Durumu
          </p>

          <div className="data-list" style={{ gap: "8px" }}>
            {awaitingSignatureItems.map(
              (item) => (
                <Link
                  key={item.key}
                  to={`/companies/${encodeURIComponent(item.companyId)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <FileSignature size={14} style={{ flex: "0 0 auto" }} />

                  <span style={{ fontSize: "11px", overflowWrap: "anywhere" }}>
                    <strong>{item.companyName}</strong> · İmza bekleniyor
                  </span>
                </Link>
              ),
            )}

            {signedItems.map(
              (item) => (
                <Link
                  key={item.key}
                  to={`/companies/${encodeURIComponent(item.companyId)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <CheckCircle2 size={14} style={{ flex: "0 0 auto" }} />

                  <span style={{ fontSize: "11px", overflowWrap: "anywhere" }}>
                    <strong>{item.companyName}</strong> · İmzalandı
                  </span>
                </Link>
              ),
            )}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
