import {
  CheckCircle2,
  Mail,
  Reply,
} from "lucide-react";

import type { EmailRecord } from "../../services/supabase/emailService";
import { Panel } from "../ui/Panel";

type Props = {
  data: {
    draftEmails: EmailRecord[];
    companyNames: Map<string, string>;
  };
};

function cleanStoredText(value: string) {
  return value
    .replace(
      /^(company_name|company|subject|title|email)\s*:\s*/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCompanyName(value?: string) {
  if (!value) {
    return "Bilinmeyen Şirket";
  }

  const cleaned = cleanStoredText(value);

  return cleaned || "Bilinmeyen Şirket";
}

function normalizeSubject(subject?: string | null) {
  if (!subject) {
    return "Müşteri yanıtı";
  }

  const cleaned = cleanStoredText(subject);
  const value = cleaned.toLowerCase();

  if (
    value.includes("information package") ||
    value.includes("info package")
  ) {
    return "Bilgi paketi";
  }

  if (
    value.includes("quotation") ||
    value.includes("quote")
  ) {
    return "Teklif";
  }

  if (
    value.includes("follow up") ||
    value.includes("follow-up")
  ) {
    return "Takip";
  }

  if (
    value.includes("contract")
  ) {
    return "Sözleşme";
  }

  if (
    value.includes("thank")
  ) {
    return "Teşekkür";
  }

  return cleaned || "Müşteri yanıtı";
}

function getSubtitle(subject?: string | null) {
  if (!subject) {
    return "Gönderilmeyi bekleyen taslak e-posta.";
  }

  const value = cleanStoredText(subject).toLowerCase();

  if (
    value.includes("information package") ||
    value.includes("info package")
  ) {
    return "Talep edilen fuar bilgilerini gönderin.";
  }

  if (
    value.includes("quotation") ||
    value.includes("quote")
  ) {
    return "Fırsatı sürdürmek için teklifi gönderin.";
  }

  if (
    value.includes("follow up") ||
    value.includes("follow-up")
  ) {
    return "Müşteri görüşmesine devam edin.";
  }

  if (
    value.includes("contract")
  ) {
    return "Sözleşmeyi müşteri incelemesi için gönderin.";
  }

  return "Gönderilmeyi bekleyen taslak e-posta.";
}

export function DraftEmailsCard({
  data,
}: Props) {
  const drafts = data.draftEmails.slice(0, 5);

  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Müşteri Yanıtları
          </p>

          <h2 style={{ margin: 0, fontSize: "14px", lineHeight: 1.2 }}>
            Gönderilmeyi Bekleyenler
          </h2>
        </div>

        {drafts.length === 0 ? (
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
                background: "var(--atlas-soft)",
              }}
            >
              <CheckCircle2 size={16} />
            </div>

            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: "12px", lineHeight: 1.3 }}>
                Tüm müşteri e-postaları güncel.
              </strong>

              <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                Gönderilmeyi bekleyen taslak
                e-posta yok.
              </p>
            </div>
          </div>
        ) : (
          <div className="data-list" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
            {drafts.map((email) => (
              <div
                key={email.id}
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
                    background: "var(--atlas-soft)",
                  }}
                >
                  <Reply size={16} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "12px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                      {normalizeSubject(
                        email.subject,
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
                        background: "var(--atlas-soft)",
                      }}
                    >
                      Taslak
                    </span>
                  </div>

                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                    {cleanCompanyName(
                      data.companyNames.get(
                        email.company_id,
                      ),
                    )}
                  </p>

                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                    {getSubtitle(
                      email.subject,
                    )}
                  </p>
                </div>

                <div
                  style={{
                    flex: "0 0 auto",
                    width: "22px",
                    height: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    background: "var(--atlas-soft)",
                  }}
                >
                  <Mail size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}