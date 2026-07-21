import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Mail,
  PhoneCall,
  Sparkles,
} from "lucide-react";

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

const ATLAS_MEMORY_SENTENCE_TRANSLATIONS: Record<
  string,
  string
> = {
  "The information package was sent to the customer.":
    "Bilgi paketi müşteriye gönderildi.",
  "A revised quotation was sent to the customer.":
    "Müşteriye revize edilmiş bir teklif gönderildi.",
  "A quotation was sent to the customer.":
    "Müşteriye teklif gönderildi.",
  "A contract was sent to the customer for review.":
    "Sözleşme incelenmek üzere müşteriye gönderildi.",
  "The requested additional documents were sent.":
    "Talep edilen ek belgeler gönderildi.",
  "A customer follow-up call was completed.":
    "Müşteri takip araması tamamlandı.",
  "A customer call was completed.":
    "Müşteri araması tamamlandı.",
  "A customer meeting was scheduled.":
    "Müşteri toplantısı planlandı.",
  "A thank-you message was sent to the customer.":
    "Müşteriye teşekkür mesajı gönderildi.",
  "A customer email was sent successfully.":
    "Müşteriye e-posta başarıyla gönderildi.",
  "A customer follow-up reminder was created.":
    "Müşteri takip hatırlatıcısı oluşturuldu.",
  "Follow up after the customer reviews the documents.":
    "Müşteri belgeleri incelendikten sonra takip edin.",
  "Follow up to discuss the revised commercial terms.":
    "Revize edilen ticari şartları görüşmek için takip edin.",
  "Call the customer to discuss the quotation and answer questions.":
    "Teklifi görüşmek ve soruları yanıtlamak için müşteriyi arayın.",
  "Follow up for approval, requested changes or signature.":
    "Onay, talep edilen değişiklikler veya imza için takip edin.",
  "Confirm that the customer received the documents.":
    "Müşterinin belgeleri aldığını teyit edin.",
  "Complete the next action agreed during the conversation.":
    "Görüşme sırasında mutabık kalınan sonraki adımı tamamlayın.",
  "Record and schedule the next agreed customer action.":
    "Bir sonraki mutabık kalınan müşteri aksiyonunu kaydedin ve planlayın.",
  "Prepare the necessary customer and opportunity information.":
    "Gerekli müşteri ve fırsat bilgilerini hazırlayın.",
  "Review whether another customer action is required.":
    "Başka bir müşteri aksiyonu gerekip gerekmediğini gözden geçirin.",
  "Follow up according to the content of the email.":
    "E-postanın içeriğine göre takip edin.",
  "Complete the reminder on the scheduled date.":
    "Hatırlatıcıyı planlanan tarihte tamamlayın.",
  "Review the opportunity and schedule the next customer action.":
    "Fırsatı gözden geçirin ve sonraki müşteri aksiyonunu planlayın.",
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
  "The user completed Atlas's recommended task.":
    "Kullanıcı, Atlas'ın önerdiği görevi tamamladı.",
  "The user selected and completed a different task instead of Atlas's first recommendation.":
    "Kullanıcı, Atlas'ın ilk önerisi yerine farklı bir görevi seçip tamamladı.",
  "The workflow task was completed without a recorded recommendation preference.":
    "İş akışı görevi, kayıtlı bir öneri tercihi olmadan tamamlandı.",
  "Completion time was not measured.":
    "Tamamlanma süresi ölçülmedi.",
  "No task score was available.":
    "Görev puanı mevcut değildi.",
  "Atlas identified an AI risk signal before task completion.":
    "Atlas, görev tamamlanmadan önce bir AI risk sinyali tespit etti.",
  "The next customer action was scheduled successfully.":
    "Sonraki müşteri aksiyonu başarıyla planlandı.",
  "Atlas's recommendation was accepted and completed.":
    "Atlas'ın önerisi kabul edildi ve tamamlandı.",
  "Use this outcome as a positive signal for similar tasks.":
    "Bu sonucu benzer görevler için olumlu bir sinyal olarak kullanın.",
  "The user preferred a manually selected task.":
    "Kullanıcı, manuel olarak seçilen bir görevi tercih etti.",
  "Compare similar future recommendations with this choice.":
    "Gelecekteki benzer önerileri bu seçimle karşılaştırın.",
  "Use the completed workflow result to improve future task ordering.":
    "Gelecekteki görev sıralamasını iyileştirmek için tamamlanan iş akışı sonucunu kullanın.",
};

const ATLAS_PRIORITY_WORD_LABELS: Record<
  string,
  string
> = {
  low: "düşük",
  normal: "normal",
  medium: "orta",
  high: "yüksek",
  critical: "kritik",
};

function translateAtlasSentence(
  sentence: string,
): string {
  const exactMatch =
    ATLAS_MEMORY_SENTENCE_TRANSLATIONS[
      sentence
    ];

  if (exactMatch) {
    return exactMatch;
  }

  const secondsMatch = sentence.match(
    /^The task was completed in (\d+) seconds?\.$/,
  );

  if (secondsMatch) {
    return `Görev ${secondsMatch[1]} saniyede tamamlandı.`;
  }

  const minutesMatch = sentence.match(
    /^The task was completed in (\d+) minutes?\.$/,
  );

  if (minutesMatch) {
    return `Görev ${minutesMatch[1]} dakikada tamamlandı.`;
  }

  const scoreWithPriorityMatch =
    sentence.match(
      /^The task score was ([\d.]+) with (\w+) priority\.$/,
    );

  if (scoreWithPriorityMatch) {
    const priorityWord =
      ATLAS_PRIORITY_WORD_LABELS[
        scoreWithPriorityMatch[2].toLowerCase()
      ] ?? scoreWithPriorityMatch[2];

    return `Görev puanı ${priorityWord} öncelikle ${scoreWithPriorityMatch[1]} olarak hesaplandı.`;
  }

  const scoreMatch = sentence.match(
    /^The task score was ([\d.]+)\.$/,
  );

  if (scoreMatch) {
    return `Görev puanı ${scoreMatch[1]} olarak hesaplandı.`;
  }

  const completedMatch = sentence.match(
    /^(.+) was completed\.$/,
  );

  if (completedMatch) {
    return `${completedMatch[1]} tamamlandı.`;
  }

  return sentence;
}

function translateAtlasMemoryText(
  value: string,
): string {
  if (!value) {
    return value;
  }

  return value
    .split(/(?<=\.)\s+/)
    .map((sentence) =>
      translateAtlasSentence(
        sentence.trim(),
      ),
    )
    .filter(
      (sentence) => sentence.length > 0,
    )
    .join(" ");
}

function createFocusItems(
  data: Props["data"],
): FocusItem[] {
  const items: FocusItem[] = [];

  const memory = data.aiFocusMemory;

  const recommendation =
    translateAtlasMemoryText(
      cleanText(
        memory?.recommendation,
      ),
    );

  const risk = translateAtlasMemoryText(
    cleanText(memory?.risk),
  );

  const summary =
    translateAtlasMemoryText(
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
        "Atlas bugün için ek bir kritik sinyal tespit etmedi.",
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
                Atlas Odağı
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
                ? "Atlas hafızası ve güncel pipeline aktivitesine göre oluşturuldu."
                : "Güncel pipeline aktivitesine göre oluşturuldu."}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}