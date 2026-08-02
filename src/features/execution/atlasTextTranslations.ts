// System-generated English sentences (from memoryBuilder.ts,
// executeAction.ts's buildActionDescription, and executionListeners.ts's
// feedback-summary builders) all get stored as-is in ai_memory.* and
// timeline_events.description — the English is intentional at the
// storage layer (rule: never touch persisted enum/text values), but it
// must never reach the screen untranslated. Every consumer that renders
// this text (Today's Atlas Odağı, Company Workspace's Atlas AI card,
// Görüşme Geçmişi / Aktivite timelines) shares this single dictionary
// instead of keeping its own copy.
const SYSTEM_SENTENCE_TRANSLATIONS: Record<
  string,
  string
> = {
  "The information package was sent to the customer.":
    "Bilgi paketi müşteriye gönderildi.",
  "A follow-up should be completed after the customer has reviewed the documents.":
    "Müşteri belgeleri incelendikten sonra bir takip yapılmalı.",
  "A revised quotation was sent to the customer.":
    "Müşteriye revize edilmiş bir teklif gönderildi.",
  "The opportunity should be reviewed again after the customer evaluates the new terms.":
    "Müşteri yeni şartları değerlendirdikten sonra fırsat tekrar gözden geçirilmeli.",
  "A quotation was sent to the customer.":
    "Müşteriye teklif gönderildi.",
  "A follow-up should be scheduled to discuss the offer and answer any questions.":
    "Teklifi görüşmek ve soruları yanıtlamak için bir takip planlanmalı.",
  "The contract was sent to the customer for review.":
    "Sözleşme incelenmek üzere müşteriye gönderildi.",
  "A contract was sent to the customer for review.":
    "Sözleşme incelenmek üzere müşteriye gönderildi.",
  "The next action is to follow up on approval, requested changes or signature.":
    "Sonraki adım; onay, talep edilen değişiklikler veya imza için takip etmektir.",
  "The requested additional documents were sent.":
    "Talep edilen ek belgeler gönderildi.",
  "The requested additional documents were sent to the customer.":
    "Talep edilen ek belgeler müşteriye gönderildi.",
  "The opportunity should remain active until receipt is confirmed.":
    "Teslim alındığı teyit edilene kadar fırsat aktif kalmalı.",
  "A customer follow-up call was completed.":
    "Müşteri takip araması tamamlandı.",
  "The conversation outcome and next action should guide the opportunity forward.":
    "Görüşme sonucu ve sonraki adım fırsatı ileriye taşımalı.",
  "A customer call was completed.":
    "Müşteri araması tamamlandı.",
  "The customer call was completed.":
    "Müşteri araması tamamlandı.",
  "The call outcome and agreed next action were recorded.":
    "Arama sonucu ve mutabık kalınan sonraki adım kaydedildi.",
  "A customer meeting was scheduled.":
    "Müşteri toplantısı planlandı.",
  "Preparation and follow-up activities should be completed around the meeting date.":
    "Toplantı tarihi civarında hazırlık ve takip faaliyetleri tamamlanmalı.",
  "A thank-you message was sent to the customer.":
    "Müşteriye teşekkür mesajı gönderildi.",
  "The completed interaction was recorded in the customer history.":
    "Tamamlanan etkileşim müşteri geçmişine kaydedildi.",
  "A customer email was sent successfully.":
    "Müşteriye e-posta başarıyla gönderildi.",
  "The customer email was sent successfully.":
    "Müşteriye e-posta başarıyla gönderildi.",
  "The communication was recorded for future follow-up and opportunity context.":
    "İletişim, ileride takip ve fırsat bağlamı için kaydedildi.",
  "The result was recorded in the customer timeline and Atlas memory.":
    "Sonuç, müşteri zaman çizelgesine ve VIAWA hafızasına kaydedildi.",
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
    "Kullanıcı, VIAWA'nın önerdiği görevi tamamladı.",
  "The user selected and completed a different task instead of Atlas's first recommendation.":
    "Kullanıcı, VIAWA'nın ilk önerisi yerine farklı bir görevi seçip tamamladı.",
  "The workflow task was completed without a recorded recommendation preference.":
    "İş akışı görevi, kayıtlı bir öneri tercihi olmadan tamamlandı.",
  "Completion time was not measured.":
    "Tamamlanma süresi ölçülmedi.",
  "No task score was available.":
    "Görev puanı mevcut değildi.",
  "Atlas identified an AI risk signal before task completion.":
    "VIAWA, görev tamamlanmadan önce bir AI risk sinyali tespit etti.",
  "The next customer action was scheduled successfully.":
    "Sonraki müşteri aksiyonu başarıyla planlandı.",
  "Atlas's recommendation was accepted and completed.":
    "VIAWA'nın önerisi kabul edildi ve tamamlandı.",
  "Use this outcome as a positive signal for similar tasks.":
    "Bu sonucu benzer görevler için olumlu bir sinyal olarak kullanın.",
  "The user preferred a manually selected task.":
    "Kullanıcı, manuel olarak seçilen bir görevi tercih etti.",
  "Compare similar future recommendations with this choice.":
    "Gelecekteki benzer önerileri bu seçimle karşılaştırın.",
  "Use the completed workflow result to improve future task ordering.":
    "Gelecekteki görev sıralamasını iyileştirmek için tamamlanan iş akışı sonucunu kullanın.",
};

const PRIORITY_WORD_LABELS: Record<
  string,
  string
> = {
  low: "düşük",
  normal: "normal",
  medium: "orta",
  high: "yüksek",
  critical: "kritik",
};

function translateSentence(
  sentence: string,
): string {
  const exactMatch =
    SYSTEM_SENTENCE_TRANSLATIONS[sentence];

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
      PRIORITY_WORD_LABELS[
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

  const completedSuccessfullyMatch =
    sentence.match(
      /^(.+) was completed successfully\.$/,
    );

  if (completedSuccessfullyMatch) {
    return `${completedSuccessfullyMatch[1]} başarıyla tamamlandı.`;
  }

  const completedMatch = sentence.match(
    /^(.+) was completed\.$/,
  );

  if (completedMatch) {
    return `${completedMatch[1]} tamamlandı.`;
  }

  return sentence;
}

/**
 * Translates a system-generated English sentence or period-separated
 * sequence of sentences (ai_memory summary/risk/recommendation,
 * timeline_events description) into Turkish. Unrecognized sentences pass
 * through unchanged rather than being dropped, so unexpected input never
 * disappears silently.
 */
export function translateSystemGeneratedText(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  return value
    .split(/(?<=\.)\s+/)
    .map((sentence) =>
      translateSentence(sentence.trim()),
    )
    .filter(
      (sentence) => sentence.length > 0,
    )
    .join(" ");
}
