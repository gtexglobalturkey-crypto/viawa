import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { Panel } from "../../components/ui/Panel";

import type { WorkflowTask } from "../../core/workflow/workflowTypes";

type Props = {
  task: WorkflowTask | null;
  atlasRecommendedTask: WorkflowTask | null;
  queue: WorkflowTask[];
  completing: boolean;
  isUsingCustomTask: boolean;
  onStart: () => void;
  onComplete: () => Promise<void>;
  onSelectTask: (task: WorkflowTask) => void;
  onResetToRecommendation: () => void;
};

type TaskScoreDetails = {
  score: number | null;
  priority: string | null;
  reasons: string[];
};

type AiInsightDetails = {
  confidence: number | null;
  riskDetected: boolean;
  recommended: boolean;
};

const EXACT_TASK_TEXT_TRANSLATIONS: Record<
  string,
  string
> = {
  "Pending customer communication should be handled before starting other work.":
    "Bekleyen müşteri iletişimi diğer işlere başlamadan önce ele alınmalı.",
  "This planned activity is overdue.":
    "Bu planlanmış etkinlik gecikti.",
  "This activity is part of today's planned work.":
    "Bu etkinlik bugünün planlanan işinin bir parçası.",
  "This opportunity has an overdue next action.":
    "Bu fırsatın gecikmiş bir sonraki adımı var.",
  "This active opportunity requires a clear next step.":
    "Bu aktif fırsat net bir sonraki adım gerektiriyor.",
  "A recent unanswered call should be retried before the opportunity becomes inactive.":
    "Fırsat pasif hale gelmeden önce yakın zamanda cevapsız kalan arama tekrar denenmeli.",
  "This email draft has been waiting and should be completed before it becomes outdated.":
    "Bu taslak e-posta bekliyor ve güncelliğini kaybetmeden tamamlanmalı.",
  "Completing this record will allow ATLAS to prepare more accurate future actions.":
    "Bu kaydı tamamlamak Atlas'ın daha doğru gelecek aksiyonları hazırlamasını sağlayacak.",
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
  "Follow up with the customer":
    "Müşteriyle takip görüşmesi yapın",
  "Review pending customer action":
    "Bekleyen müşteri işlemini gözden geçirin",
  "Prepare the quotation":
    "Teklifi hazırlayın",
  "Send the information package":
    "Bilgi paketini gönderin",
  "The customer could not be reached previously.":
    "Müşteriye daha önce ulaşılamadı.",
};

const SCORE_REASON_TRANSLATIONS: Record<
  string,
  string
> = {
  "Follow-up overdue": "Takip gecikti",
  "Waiting more than 7 days":
    "7 günden fazla bekliyor",
  "Waiting more than 3 days":
    "3 günden fazla bekliyor",
  "High probability opportunity":
    "Yüksek olasılıklı fırsat",
  "Quotation requested":
    "Teklif talep edildi",
  "Contract stage": "Sözleşme aşaması",
  "High value opportunity":
    "Yüksek değerli fırsat",
  "AI recommended": "AI Önerisi",
  "High-confidence AI signal":
    "Yüksek güvenli AI önerisi",
  "AI risk detected":
    "AI risk tespit etti",
};

const MISSING_FIELD_LABELS: Record<
  string,
  string
> = {
  "next action": "sonraki aksiyon",
  stage: "aşama",
  company: "şirket",
};

type TextPattern = {
  pattern: RegExp;
  translate: (
    match: RegExpMatchArray,
  ) => string;
};

const TASK_TITLE_PATTERNS: TextPattern[] = [
  {
    pattern: /^Complete email: (.+)$/,
    translate: (m) =>
      `E-postayı tamamlayın: ${m[1]}`,
  },
  {
    pattern: /^Finish and send: (.+)$/,
    translate: (m) =>
      `Tamamlayıp gönderin: ${m[1]}`,
  },
  {
    pattern: /^Complete (.+) record$/,
    translate: (m) =>
      `${m[1]} kaydını tamamlayın`,
  },
  {
    pattern: /^Call (.+) again$/,
    translate: (m) =>
      `${m[1]} ile tekrar görüşün`,
  },
  {
    pattern:
      /^Prepare quotation for (.+)$/,
    translate: (m) =>
      `${m[1]} için teklif hazırlayın`,
  },
  {
    pattern:
      /^Check quotation status with (.+)$/,
    translate: (m) =>
      `${m[1]} ile teklif durumunu kontrol edin`,
  },
  {
    pattern:
      /^Check contract status with (.+)$/,
    translate: (m) =>
      `${m[1]} ile sözleşme durumunu kontrol edin`,
  },
  {
    pattern:
      /^Follow up quotation with (.+)$/,
    translate: (m) =>
      `${m[1]} ile teklif takibi yapın`,
  },
  {
    pattern:
      /^Continue negotiation with (.+)$/,
    translate: (m) =>
      `${m[1]} ile müzakereye devam edin`,
  },
  {
    pattern:
      /^Follow up contract with (.+)$/,
    translate: (m) =>
      `${m[1]} ile sözleşme takibini yapın`,
  },
  {
    pattern: /^Reconnect with (.+)$/,
    translate: (m) =>
      `${m[1]} ile yeniden iletişime geçin`,
  },
  {
    pattern: /^Follow up with (.+)$/,
    translate: (m) =>
      `${m[1]} ile takip görüşmesi yapın`,
  },
];

function translateMissingFieldList(
  value: string,
): string {
  return value
    .split(", ")
    .map(
      (field) =>
        MISSING_FIELD_LABELS[
          field.trim()
        ] ?? field.trim(),
    )
    .join(", ");
}

const TASK_DESCRIPTION_PATTERNS: TextPattern[] =
  [
    {
      pattern:
        /^(.+) could not be reached previously\.$/,
      translate: (m) =>
        `${m[1]} adayına daha önce ulaşılamadı.`,
    },
    {
      pattern: /^Missing: (.+)$/,
      translate: (m) =>
        `Eksik: ${translateMissingFieldList(m[1])}`,
    },
  ];

const TASK_REASON_PATTERNS: TextPattern[] = [
  {
    pattern:
      /^(.+) has been waiting for (\d+) days? without a recorded next action\.$/,
    translate: (m) =>
      `${m[1]}, kayıtlı bir sonraki adım olmadan ${m[2]} gündür bekliyor.`,
  },
];

function translateWorkflowText(
  value: string,
  patterns: TextPattern[],
): string {
  const normalizedValue = value
    .replace(/\s+/g, " ")
    .trim();

  const exactMatch =
    EXACT_TASK_TEXT_TRANSLATIONS[
      normalizedValue
    ];

  if (exactMatch) {
    return exactMatch;
  }

  for (const {
    pattern,
    translate,
  } of patterns) {
    const match =
      normalizedValue.match(pattern);

    if (match) {
      return translate(match);
    }
  }

  return value;
}

function translateTaskTitle(
  value: string,
): string {
  return translateWorkflowText(
    value,
    TASK_TITLE_PATTERNS,
  );
}

function translateTaskDescription(
  value: string,
): string {
  return translateWorkflowText(
    value,
    TASK_DESCRIPTION_PATTERNS,
  );
}

function translateTaskReason(
  value: string,
): string {
  return translateWorkflowText(
    value,
    TASK_REASON_PATTERNS,
  );
}

function translateScoreReason(
  value: string,
): string {
  const normalizedValue = value
    .replace(/\s+/g, " ")
    .trim();

  return (
    SCORE_REASON_TRANSLATIONS[
      normalizedValue
    ] ?? value
  );
}

function readMetadataNumber(
  task: WorkflowTask,
  key: string,
): number | null {
  const value = task.metadata?.[key];

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue)
      ? parsedValue
      : null;
  }

  return null;
}

function readMetadataString(
  task: WorkflowTask,
  key: string,
): string | null {
  const value = task.metadata?.[key];

  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return value.trim();
  }

  return null;
}

function readMetadataBoolean(
  task: WorkflowTask,
  key: string,
): boolean {
  const value = task.metadata?.[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalizedValue =
      value.trim().toLowerCase();

    return [
      "true",
      "1",
      "yes",
      "recommended",
      "high",
      "detected",
    ].includes(normalizedValue);
  }

  return false;
}

function readMetadataStringArray(
  task: WorkflowTask,
  key: string,
): string[] {
  const value = task.metadata?.[key];

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return [];
  }

  try {
    const parsedValue: unknown =
      JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function getTaskScoreDetails(
  task: WorkflowTask,
): TaskScoreDetails {
  return {
    score: readMetadataNumber(
      task,
      "taskScoreValue",
    ),
    priority: readMetadataString(
      task,
      "taskScorePriority",
    ),
    reasons: readMetadataStringArray(
      task,
      "taskScoreReasons",
    ),
  };
}

function getAiInsightDetails(
  task: WorkflowTask,
): AiInsightDetails {
  return {
    confidence: readMetadataNumber(
      task,
      "aiConfidence",
    ),
    riskDetected: readMetadataBoolean(
      task,
      "aiRisk",
    ),
    recommended: readMetadataBoolean(
      task,
      "aiRecommended",
    ),
  };
}

const priorityLabels: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

function formatPriority(
  priority: string | null,
): string {
  if (!priority) {
    return "";
  }

  const normalizedPriority =
    priority.toLowerCase();

  return (
    priorityLabels[normalizedPriority] ??
    priority.charAt(0).toUpperCase() +
      priority.slice(1)
  );
}

function formatConfidence(
  confidence: number | null,
): string | null {
  if (confidence === null) {
    return null;
  }

  const normalizedConfidence =
    confidence <= 1
      ? confidence * 100
      : confidence;

  return `${Math.round(
    Math.max(
      0,
      Math.min(
        normalizedConfidence,
        100,
      ),
    ),
  )}%`;
}

export function CurrentTaskCard({
  task,
  atlasRecommendedTask,
  queue,
  completing,
  isUsingCustomTask,
  onStart,
  onComplete,
  onSelectTask,
  onResetToRecommendation,
}: Props) {
  const [
    queueOpen,
    setQueueOpen,
  ] = useState(false);

  function handleSelectTask(
    selectedTask: WorkflowTask,
  ) {
    onSelectTask(selectedTask);
    setQueueOpen(false);
  }

  if (!task) {
    return (
      <Panel>
        <div className="current-task-card current-task-card--completed">
          <div className="current-task-empty-icon">
            <CheckCircle2 size={22} />
          </div>

          <div className="current-task-empty-content">
            <span className="task-label">
              MEVCUT GÖREV
            </span>

            <h2>
              Bugünün planlanan işi tamamlandı
            </h2>

            <p>
              Mevcut iş akışınızda kalan görev
              bulunmuyor.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const selectableTasks =
    queue.filter(
      (queueTask) =>
        queueTask.id !== task.id,
    );

  const taskScore =
    getTaskScoreDetails(task);

  const aiInsight =
    getAiInsightDetails(task);

  const confidenceLabel =
    formatConfidence(
      aiInsight.confidence,
    );

  const hasAiInsight =
    aiInsight.recommended ||
    aiInsight.riskDetected ||
    confidenceLabel !== null;

  const priorityLabel =
    formatPriority(
      taskScore.priority,
    );

  return (
    <Panel>
      <div className="current-task-card">
        <div className="current-task-main">
          <div className="current-task-header">
            <div className="current-task-heading">
              <span className="task-label">
                MEVCUT GÖREV
              </span>

              <span className="current-task-source">
                {isUsingCustomTask
                  ? "Manuel seçildi"
                  : "Atlas Önerisi"}
              </span>
            </div>

            {priorityLabel ? (
              <div className="current-task-score">
                <span
                  className={`current-task-priority current-task-priority--${taskScore.priority}`}
                >
                  {priorityLabel}
                </span>
              </div>
            ) : null}
          </div>

          <div className="current-task-content">
            {task.companyName ? (
              <div className="current-task-company">
                {task.companyName}
              </div>
            ) : null}

            <h2>
              {translateTaskTitle(
                task.title,
              )}
            </h2>

            {task.description &&
            task.description !== task.companyName ? (
              <p className="current-task-description">
                {translateTaskDescription(
                  task.description,
                )}
              </p>
            ) : null}
          </div>

          {taskScore.reasons.length > 0 ? (
            <div className="current-task-reasons">
              <span className="current-task-reasons-label">
                Neden şimdi?
              </span>

              <ul>
                {taskScore.reasons.map(
                  (reason) => (
                    <li key={reason}>
                      {translateScoreReason(
                        reason,
                      )}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : task.reason ? (
            <div className="current-task-reasons">
              <span className="current-task-reasons-label">
                Neden şimdi?
              </span>

              <p>
                {translateTaskReason(
                  task.reason,
                )}
              </p>
            </div>
          ) : null}
        </div>

        {hasAiInsight ? (
          <aside className="current-task-ai-insight">
            <div className="current-task-ai-insight-header">
              <Sparkles size={14} />
              <span>AI ANALİZİ</span>
            </div>

            <div className="current-task-ai-insight-body">
              {confidenceLabel ? (
                <div className="current-task-ai-confidence">
                  <strong>
                    {confidenceLabel}
                  </strong>

                  <span>
                    Güven
                  </span>
                </div>
              ) : null}

              {aiInsight.recommended ? (
                <div className="current-task-ai-status current-task-ai-status--recommended">
                  <CheckCircle2 size={14} />

                  <span>
                    Önerilen
                  </span>
                </div>
              ) : null}

              <div
                className={
                  aiInsight.riskDetected
                    ? "current-task-ai-status current-task-ai-status--risk"
                    : "current-task-ai-status current-task-ai-status--safe"
                }
              >
                {aiInsight.riskDetected ? (
                  <AlertTriangle size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}

                <span>
                  {aiInsight.riskDetected
                    ? "Risk tespit edildi"
                    : "Risk tespit edilmedi"}
                </span>
              </div>
            </div>
          </aside>
        ) : null}

        <div className="current-task-footer">
          <div className="current-task-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onStart}
            >
              <ArrowRight size={16} />
              Göreve başla
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={completing}
              onClick={() => {
                void onComplete();
              }}
            >
              <CheckCircle2 size={16} />

              {completing
                ? "Tamamlanıyor..."
                : "Görevi tamamla"}
            </button>
          </div>

          <div className="current-task-choice">
            <button
              type="button"
              className="current-task-choice-button"
              aria-expanded={queueOpen}
              onClick={() => {
                setQueueOpen(
                  (current) => !current,
                );
              }}
            >
              Başka görev seç

              <ChevronDown
                size={14}
                className={
                  queueOpen
                    ? "current-task-choice-chevron current-task-choice-chevron--open"
                    : "current-task-choice-chevron"
                }
              />
            </button>

            {isUsingCustomTask &&
            atlasRecommendedTask ? (
              <button
                type="button"
                className="current-task-reset-button"
                onClick={
                  onResetToRecommendation
                }
              >
                <RotateCcw size={13} />
                Atlas önerisini kullan
              </button>
            ) : null}
          </div>
        </div>

        {queueOpen ? (
          <div className="current-task-queue">
            <div className="current-task-queue-header">
              <span className="current-task-queue-label">
                BUGÜN KALAN
              </span>

              <span className="current-task-queue-count">
                {selectableTasks.length}
              </span>
            </div>

            {selectableTasks.length > 0 ? (
              <div className="current-task-queue-list">
                {selectableTasks.map(
                  (queueTask) => {
                    const queueTaskScore =
                      getTaskScoreDetails(
                        queueTask,
                      );

                    const queuePriority =
                      formatPriority(
                        queueTaskScore.priority,
                      );

                    return (
                      <button
                        key={queueTask.id}
                        type="button"
                        className="current-task-queue-item"
                        onClick={() => {
                          handleSelectTask(
                            queueTask,
                          );
                        }}
                      >
                        <span className="current-task-queue-item-content">
                          <strong>
                            {translateTaskTitle(
                              queueTask.title,
                            )}
                          </strong>

                          {queueTask.description ? (
                            <small>
                              {translateTaskDescription(
                                queueTask.description,
                              )}
                            </small>
                          ) : null}
                        </span>

                        <span className="current-task-queue-meta">
                          {queuePriority ? (
                            <small>
                              {queuePriority}
                            </small>
                          ) : null}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            ) : (
              <p className="muted">
                Başka görev bulunmuyor.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}