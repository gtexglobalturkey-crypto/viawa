import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CircleAlert,
  Clock3,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Panel } from "../../../components/ui/Panel";

import type { CallWorkspaceViewModel } from "../models/workspaceViewModel";

type Props = {
  workspace: CallWorkspaceViewModel;
};

type StructuredMemory = {
  title?: string;
  description?: string;
  summary?: string;
  nextStep?: string;
  risk?: string;
  confidence?: number;
  createdAt?: string;
};

function getConfidenceColor(
  confidence: number,
) {
  if (confidence >= 85) {
    return "#22c55e";
  }

  if (confidence >= 65) {
    return "#f59e0b";
  }

  return "#ef4444";
}

function clampPercentage(
  value: number,
) {
  return Math.min(
    100,
    Math.max(0, Math.round(value)),
  );
}

function isStructuredMemory(
  value: unknown,
): value is StructuredMemory {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function cleanText(
  value: string | null | undefined,
) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function getLatestMemory(
  memories: unknown[],
) {
  if (memories.length === 0) {
    return null;
  }

  const latestValue =
    memories[memories.length - 1];

  if (!isStructuredMemory(latestValue)) {
    return null;
  }

  return latestValue;
}

function formatMemoryDate(
  value: string | undefined,
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AiCopilot({
  workspace,
}: Props) {
  const metrics =
    workspace.conversationMetrics;

  const memories =
    workspace.ai.memories as unknown[];

  const memoryCount =
    memories.length;

  const latestMemory =
    getLatestMemory(memories);

  const memorySummary =
    cleanText(latestMemory?.summary) ||
    cleanText(latestMemory?.description) ||
    cleanText(workspace.ai.latestMemory) ||
    "AI hafızası mevcut değil.";

  const memoryNextStep =
    cleanText(latestMemory?.nextStep) ||
    cleanText(
      workspace.ai.nextBestAction,
    ) ||
    "Fırsatı gözden geçirin ve sonraki müşteri aksiyonunu planlayın.";

  const memoryRisk =
    cleanText(latestMemory?.risk) ||
    cleanText(
      workspace.ai.riskAnalysis,
    ) ||
    "Acil bir risk tespit edilmedi.";

  const confidence =
    clampPercentage(
      latestMemory?.confidence ??
        workspace.ai.confidence,
    );

  const memoryDate =
    formatMemoryDate(
      latestMemory?.createdAt,
    );

  return (
    <Panel className="ai-panel">
      <p className="eyebrow">
        Atlas AI
      </p>

      <h2>Satış Asistanı</h2>

      <div
        className="ai-card"
        style={{
          borderLeft: `4px solid ${getConfidenceColor(
            confidence,
          )}`,
        }}
      >
        <ShieldCheck size={18} />

        <div>
          <strong>
            AI Güveni · {confidence}%
          </strong>

          <p>
            {
              workspace.ai
                .confidenceLabel
            }
          </p>
        </div>
      </div>

      {metrics && (
        <>
          <div className="ai-card">
            <Activity size={18} />

            <div>
              <strong>
                Aktivite Skoru
              </strong>

              <p>
                {
                  metrics.activityScore
                }
                %
                {" • "}
                {
                  metrics
                    .activityScoreLabel
                }
              </p>
            </div>
          </div>

          <div className="ai-card">
            <AlertTriangle
              size={18}
            />

            <div>
              <strong>
                Risk Skoru
              </strong>

              <p>
                {metrics.riskScore}%
                {" • "}
                {
                  metrics
                    .riskScoreLabel
                }
              </p>
            </div>
          </div>

          <div className="ai-card">
            <Clock3 size={18} />

            <div>
              <strong>
                Son Aktivite
              </strong>

              <p>
                {
                  metrics
                    .lastActivityDateLabel
                }
              </p>
            </div>
          </div>
        </>
      )}

      <div className="ai-card">
        <BrainCircuit size={18} />

        <div>
          <strong>
            Müşteri Bağlamı
          </strong>

          <p>
            {
              workspace.ai
                .conversationSummary
            }
          </p>
        </div>
      </div>

      <div className="ai-card">
        <Lightbulb size={18} />

        <div>
          <strong>
            Son Hafıza
          </strong>

          <p>{memorySummary}</p>

          <small>
            {memoryCount} hafıza kaydı
            {memoryDate
              ? ` • ${memoryDate}`
              : ""}
          </small>
        </div>
      </div>

      <div className="ai-card">
        <TrendingUp size={18} />

        <div>
          <strong>
            Önerilen Sonraki Adım
          </strong>

          <p>{memoryNextStep}</p>
        </div>
      </div>

      <div className="ai-card">
        <CircleAlert size={18} />

        <div>
          <strong>
            Mevcut Risk
          </strong>

          <p>{memoryRisk}</p>
        </div>
      </div>

      <button
        className="btn btn-primary"
        type="button"
        style={{ width: "100%" }}
      >
        <Sparkles size={18} />
        AI Analizini Yenile
      </button>
    </Panel>
  );
}