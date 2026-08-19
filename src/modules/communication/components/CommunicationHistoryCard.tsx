import { Panel } from "../../../components/ui/Panel";

type CommunicationHistoryItem = {
  id: string;
  subject: string | null;
  status: string | null;
  sent_at: string | null;
};

type Props = {
  emails: CommunicationHistoryItem[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  scheduled: "Zamanlanmış",
};

function formatStatusLabel(
  status: string | null,
): string {
  const normalizedStatus = status ?? "draft";

  return (
    STATUS_LABELS[normalizedStatus] ??
    normalizedStatus
  );
}

export function CommunicationHistoryCard({
  emails,
}: Props) {
  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          İletişim Geçmişi
        </p>

        {emails.length === 0 ? (
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--viawa-soft)", border: "1px solid var(--viawa-border)" }}>
            <p className="muted" style={{ margin: 0, fontSize: "10px", lineHeight: 1.3 }}>
              Kayıtlı e-posta iletişimi yok.
            </p>
          </div>
        ) : (
          <div className="communication-history">
            {emails.map((email) => (
              <article
                key={email.id}
                className="communication-history-item"
              >
                <div>
                  <strong>
                    {email.subject ??
                      "Başlıksız e-posta"}
                  </strong>

                  <p className="muted">
                    {email.sent_at
                      ? new Date(
                          email.sent_at,
                        ).toLocaleString()
                      : "Gönderilmedi"}
                  </p>
                </div>

                <span>
                  {formatStatusLabel(
                    email.status,
                  )}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}