import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

import type { AiMemory } from "../../services/supabase/aiService";
import { Panel } from "../ui/Panel";

type Props = {
  data: {
    highestRiskMemories: AiMemory[];
    companyNames: Map<string, string>;
  };
};

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function cleanStoredText(value: string) {
  return value
    .replace(
      /^(company_name|company|risk|memory|note|title)\s*:\s*/i,
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

const EXACT_RISK_TRANSLATIONS: Record<
  string,
  string
> = {
  "The opportunity may become inactive if the customer is not contacted again.":
    "Müşteriyle tekrar iletişime geçilmezse fırsat pasif hale gelebilir.",
  "The customer is waiting to evaluate the revised quotation.":
    "Müşteri, revize edilmiş teklifi değerlendirmeyi bekliyor.",
  "The opportunity may stall while waiting for customer feedback.":
    "Müşteri geri bildirimi beklenirken fırsat durabilir.",
  "The contract is waiting for customer approval.":
    "Sözleşme müşteri onayını bekliyor.",
  "The opportunity may be delayed if the documents are not reviewed.":
    "Belgeler incelenmezse fırsat gecikebilir.",
  "The opportunity requires a scheduled next action after the follow-up call.":
    "Takip aramasından sonra fırsat için planlanmış bir sonraki adım gerekiyor.",
  "The opportunity may lose momentum without a scheduled next action.":
    "Sonraki adım planlanmazsa fırsat ivmesini kaybedebilir.",
  "The customer conversation may stall without a follow-up.":
    "Takip yapılmazsa müşteri görüşmesi durabilir.",
  "The customer action may become overdue if the reminder is missed.":
    "Hatırlatıcı kaçırılırsa müşteri aksiyonu gecikebilir.",
};

function normalizeRiskText(value: string | null) {
  if (!value) {
    return "Bu fırsat gözden geçirilmeli.";
  }

  const cleanedValue = cleanStoredText(value);

  const exactMatch =
    EXACT_RISK_TRANSLATIONS[cleanedValue];

  if (exactMatch) {
    return exactMatch;
  }

  const normalizedValue = cleanedValue.toLowerCase();

  if (
    normalizedValue.includes("no next action") ||
    normalizedValue.includes("next action missing")
  ) {
    return "Bu fırsat için planlanmış bir sonraki adım yok.";
  }

  if (
    normalizedValue.includes("overdue") ||
    normalizedValue.includes("follow-up late")
  ) {
    return "Müşteri takibi gecikti.";
  }

  if (
    normalizedValue.includes("no response") ||
    normalizedValue.includes("unresponsive")
  ) {
    return "Müşteri son zamanlarda yanıt vermedi.";
  }

  if (
    normalizedValue.includes("quotation") &&
    normalizedValue.includes("waiting")
  ) {
    return "Müşteri teklif takibini bekliyor.";
  }

  if (
    normalizedValue.includes("inactive") ||
    normalizedValue.includes("stalled") ||
    normalizedValue.includes("stall")
  ) {
    return "Bu fırsat son zamanlarda ilerlemedi.";
  }

  return "Bu fırsat gözden geçirilmeli.";
}

function getRiskLevel(confidence: number) {
  if (confidence >= 80) {
    return "Kritik";
  }

  if (confidence >= 60) {
    return "Yüksek";
  }

  return "İzlemede";
}

function getRiskIcon(confidence: number) {
  if (confidence >= 80) {
    return ShieldAlert;
  }

  if (confidence >= 60) {
    return AlertTriangle;
  }

  return BrainCircuit;
}

export function RiskSignalsCard({
  data,
}: Props) {
  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Risk Altındaki Fırsatlar
          </p>

          <h2 style={{ margin: 0, fontSize: "14px", lineHeight: 1.2 }}>
            Açık Fırsatları Koruyun
          </h2>
        </div>

        {data.highestRiskMemories.length === 0 ? (
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
                Aktif fırsat riski tespit edilmedi.
              </strong>

              <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                Acil müdahale gerekmiyor.
              </p>
            </div>
          </div>
        ) : (
          <div className="data-list" style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
            {data.highestRiskMemories.map(
              (memory) => {
                const confidence =
                  clampConfidence(
                    memory.confidence,
                  );

                const RiskIcon =
                  getRiskIcon(confidence);

                return (
                  <div
                    key={memory.id}
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
                        background: confidence >= 80 ? "#fff3e7" : "var(--atlas-soft)",
                        color: confidence >= 80 ? "#b46b00" : "inherit",
                      }}
                    >
                      <RiskIcon size={16} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "12px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                          {cleanCompanyName(
                            data.companyNames.get(
                              memory.company_id,
                            ),
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
                            background: confidence >= 80 ? "#fff3e7" : "var(--atlas-soft)",
                            color: confidence >= 80 ? "#b46b00" : "inherit",
                          }}
                        >
                          {getRiskLevel(confidence)}
                        </span>
                      </div>

                      <p style={{ margin: "6px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                        {normalizeRiskText(
                          memory.risk,
                        )}
                      </p>

                      <p className="muted" style={{ margin: "2px 0 0", fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                        %{confidence} güven
                      </p>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}