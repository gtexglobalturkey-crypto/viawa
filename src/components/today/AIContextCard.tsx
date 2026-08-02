import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Mail,
  PhoneCall,
  Sparkles,
} from "lucide-react";

import { translateSystemGeneratedText } from "../../features/execution/atlasTextTranslations";
import type { AiMemory } from "../../services/supabase/aiService";

import { Panel } from "../ui/Panel";

type Props = {
  data: {
    pendingCalls: unknown[];
    draftEmails: unknown[];
    overdueReminders: unknown[];
    aiFocusMemory?: AiMemory | null;
  };
};

type FocusItem = {
  icon: typeof AlertTriangle;
  text: string;
};

function cleanText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function shortenText(
  value: string,
  maxLength = 120,
): string {
  const normalized = value
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized
    .slice(0, maxLength)
    .trimEnd()}…`;
}

function createFocusItems(
  data: Props["data"],
): FocusItem[] {
  const items: FocusItem[] = [];

  const memory = data.aiFocusMemory;

  const recommendation =
    translateSystemGeneratedText(
      cleanText(
        memory?.recommendation,
      ),
    );

  const risk = translateSystemGeneratedText(
    cleanText(memory?.risk),
  );

  const summary =
    translateSystemGeneratedText(
      cleanText(memory?.summary),
    );

  const overdueCount =
    data.overdueReminders.length;

  const pendingCallCount =
    data.pendingCalls.length;

  const draftEmailCount =
    data.draftEmails.length;

  if (overdueCount > 0) {
    items.push({
      icon: AlertTriangle,
      text:
        overdueCount === 1
          ? "Önce gecikmiş müşteri takibini tamamlayın."
          : `Önce ${overdueCount} gecikmiş müşteri takibini tamamlayın.`,
    });
  }

  if (recommendation) {
    items.push({
      icon: Sparkles,
      text: shortenText(recommendation),
    });
  } else if (pendingCallCount > 0) {
    items.push({
      icon: PhoneCall,
      text:
        pendingCallCount === 1
          ? "Yeni işe başlamadan önce planlanan satış aramasını tamamlayın."
          : `Yeni işe başlamadan önce planlanan ${pendingCallCount} satış aramasını tamamlayın.`,
    });
  } else if (draftEmailCount > 0) {
    items.push({
      icon: Mail,
      text:
        draftEmailCount === 1
          ? "Görüşmeyi sürdürmek için bekleyen taslak e-postayı gönderin."
          : `Görüşmeleri sürdürmek için bekleyen ${draftEmailCount} taslak e-postayı gönderin.`,
    });
  }

  if (risk) {
    items.push({
      icon: AlertTriangle,
      text: shortenText(risk),
    });
  } else if (
    summary &&
    items.length < 3
  ) {
    items.push({
      icon: Brain,
      text: shortenText(summary),
    });
  }

  if (
    items.length < 3 &&
    pendingCallCount > 0 &&
    !items.some(
      ({ icon }) => icon === PhoneCall,
    )
  ) {
    items.push({
      icon: PhoneCall,
      text:
        pendingCallCount === 1
          ? "Planlanmış bir müşteri araması bekliyor."
          : `${pendingCallCount} planlanmış müşteri araması bekliyor.`,
    });
  }

  if (
    items.length < 3 &&
    draftEmailCount > 0 &&
    !items.some(
      ({ icon }) => icon === Mail,
    )
  ) {
    items.push({
      icon: Mail,
      text:
        draftEmailCount === 1
          ? "Gönderilmeye hazır bir müşteri e-postası var."
          : `${draftEmailCount} müşteri e-postası gönderilmeye hazır.`,
    });
  }

  if (items.length === 0) {
    items.push({
      icon: CheckCircle2,
      text:
        "VIAWA bugün için ek bir kritik sinyal tespit etmedi.",
    });
  }

  return items.slice(0, 3);
}

export function AIContextCard({
  data,
}: Props) {
  const memory = data.aiFocusMemory;

  const focusItems =
    createFocusItems(data);

  return (
    <Panel>
      <div className="today-ai-card" style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
        <div className="today-ai-card-header">
          <div className="today-ai-header" style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <Brain size={18} style={{ flex: "0 0 auto", marginTop: "2px" }} />

            <div style={{ minWidth: 0 }}>
              <p className="eyebrow" style={{ marginBottom: "2px" }}>
                VIAWA Odağı
              </p>

              <h2 style={{ margin: "0", lineHeight: 1.2, fontSize: "14px" }}>
                Bugünün Önerisi
              </h2>
            </div>
          </div>
        </div>

        <div className="today-ai-card-scroll" style={{ minHeight: 0, overflowY: "auto" }}>
          <div className="today-ai-card-content" style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
            <div className="today-ai-focus-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {focusItems.map(
                (item, index) => {
                  const Icon = item.icon;

                  return (
                    <div
                      className="today-ai-focus"
                      key={`${item.text}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        minWidth: 0,
                        padding: "0",
                      }}
                    >
                      <Icon size={16} style={{ flex: "0 0 auto", marginTop: "2px" }} />

                      <p style={{ margin: 0, lineHeight: 1.3, fontSize: "11px", overflowWrap: "anywhere" }}>{item.text}</p>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>

        <div className="today-ai-card-footer">
          <div className="today-ai-footer" style={{ display: "flex", alignItems: "flex-start", gap: "6px", minWidth: 0 }}>
            <Sparkles size={12} style={{ flex: "0 0 auto", marginTop: "1px" }} />

            <span style={{ lineHeight: 1.3, fontSize: "10px", overflowWrap: "anywhere" }}>
              {memory
                ? "VIAWA çalışma geçmişine ve güncel iş akışı verilerine göre oluşturuldu."
                : "Güncel iş akışı verilerine göre oluşturuldu."}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}