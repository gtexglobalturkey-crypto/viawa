import { translateSystemGeneratedText } from "../../features/execution/atlasTextTranslations";

import { Panel } from "../ui/Panel";

type AIMemory = {
  summary?: string | null;
  confidence: number;
  updated_at?: string | null;
  risk?: string | null;
  recommendation?: string | null;
};

type Props = {
  aiMemory?: AIMemory | null;
  formatDate: (
    value?: string | null,
  ) => string;
};

export function AIMemoryCard({
  aiMemory,
  formatDate,
}: Props) {
  if (!aiMemory) {
    return null;
  }

  return (
    <section className="company-ai-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            VIAWA AI
          </p>

          <p className="muted">
            VIAWA'nın bir sonraki etkileşimde hatırlaması
            gereken önemli bağlam.
          </p>
        </div>
      </div>

      <Panel className="company-ai-card">
        <div className="company-ai-card-main">
          <div>
            <p className="eyebrow">
              Özet
            </p>

            <h2>
              {aiMemory.summary
                ? translateSystemGeneratedText(
                    aiMemory.summary,
                  )
                : "Henüz AI özeti kaydedilmedi."}
            </h2>
          </div>

          <div className="data-list">
            <div>
              <span>Güven</span>

              <strong>
                {aiMemory.confidence}%
              </strong>
            </div>

            <div>
              <span>Güncellendi</span>

              <strong>
                {formatDate(
                  aiMemory.updated_at,
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="company-ai-card-side">
          <div>
            <span>Risk</span>

            <strong>
              {aiMemory.risk
                ? translateSystemGeneratedText(
                    aiMemory.risk,
                  )
                : "Henüz risk analizi kaydedilmedi."}
            </strong>
          </div>

          <div>
            <span>Öneri</span>

            <strong>
              {aiMemory.recommendation
                ? translateSystemGeneratedText(
                    aiMemory.recommendation,
                  )
                : "Henüz öneri kaydedilmedi."}
            </strong>
          </div>
        </div>
      </Panel>
    </section>
  );
}