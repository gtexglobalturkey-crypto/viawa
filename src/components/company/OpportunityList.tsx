import { Link } from "react-router-dom";

import { Panel } from "../ui/Panel";

import type { Exhibition } from "../../services/supabase/exhibitionService";

type OpportunityItem = {
  id: string;
  stage: string;
  exhibition_id?: string | null;
  estimated_value?: number | null;
  interest_level: number;
  next_action?: string | null;
  next_action_date?: string | null;
  owner?: string | null;
};

const NEXT_ACTION_LABELS: Record<
  string,
  string
> = {
  "schedule follow-up call":
    "Takip araması planlayın",
  "wait for quotation feedback":
    "Teklif geri bildirimini bekleyin",
  "negotiate final offer":
    "Son teklifi müzakere edin",
  "track signed contract":
    "İmzalanan sözleşmeyi takip edin",
  "review call outcome and complete next action":
    "Arama sonucunu değerlendirin ve sonraki adımı tamamlayın",
};

function formatNextActionLabel(
  value?: string | null,
): string | undefined {
  if (!value) {
    return value ?? undefined;
  }

  return (
    NEXT_ACTION_LABELS[
      value.trim().toLowerCase()
    ] ?? value
  );
}

type Props = {
  companyId: string;
  opportunities: OpportunityItem[];
  exhibitionsById: Map<string, Exhibition>;
  formatDate: (
    value?: string | null,
  ) => string;
  formatStage: (
    value?: string | null,
  ) => string;
  formatEstimatedValue: (
    value?: number | null,
  ) => string;
  getInterestLabel: (
    value: number,
  ) => string;
};

export function OpportunityList({
  companyId,
  opportunities,
  exhibitionsById,
  formatDate,
  formatStage,
  formatEstimatedValue,
  getInterestLabel,
}: Props) {
  return (
    <section className="company-opportunity-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            Katılım
          </p>

          <h2>
            Aktif Katılım Fırsatları
          </h2>

          <p className="muted">
            Her fuar katılımı ayrı bir satış süreci
            olarak yönetilir.
          </p>
        </div>
      </div>

      <div className="opportunity-list">
        {opportunities.length > 0 ? (
          opportunities.map(
            (opportunity) => {
              const exhibition =
                opportunity.exhibition_id
                  ? exhibitionsById.get(
                      opportunity.exhibition_id,
                    )
                  : undefined;

              return (
              <Panel
                className="opportunity-card"
                key={opportunity.id}
              >
                <div>
                  <p className="eyebrow">
                    {formatStage(
                      opportunity.stage,
                    )}
                  </p>

                  <h2>
                    {exhibition?.name ??
                      "Katılım Fırsatı"}
                  </h2>

                  {exhibition ? (
                    <p className="muted">
                      {[
                        exhibition.city,
                        exhibition.country,
                      ]
                        .filter(Boolean)
                        .join(", ") ||
                        "Konum kayıtlı değil"}
                    </p>
                  ) : null}

                  {exhibition ? (
                    <p className="muted">
                      {formatDate(
                        exhibition.start_date,
                      )}
                      {" – "}
                      {formatDate(
                        exhibition.end_date,
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="data-list">
                  <div>
                    <span>Aşama</span>

                    <strong>
                      {formatStage(
                        opportunity.stage,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Tahmini Değer
                    </span>

                    <strong>
                      {formatEstimatedValue(
                        opportunity.estimated_value,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      İlgi Düzeyi
                    </span>

                    <strong>
                      {getInterestLabel(
                        opportunity.interest_level,
                      )}{" "}
                      ·{" "}
                      {
                        opportunity.interest_level
                      }
                      %
                    </strong>
                  </div>

                  <div className="opportunity-next-action">
                    <span>Sonraki Aksiyon</span>

                    <strong>
                      {formatNextActionLabel(
                        opportunity.next_action,
                      ) ??
                        "Planlanmış aksiyon yok"}
                    </strong>

                    <small>
                      {formatDate(
                        opportunity.next_action_date,
                      )}
                    </small>
                  </div>

                  <div>
                    <span>Sorumlu</span>

                    <strong>
                      {opportunity.owner ??
                        "Atanmadı"}
                    </strong>
                  </div>
                </div>

                <Link
                  className="btn btn-primary"
                  to={`/call?companyId=${encodeURIComponent(
                    companyId,
                  )}&opportunityId=${encodeURIComponent(
                    opportunity.id,
                  )}`}
                >
                  Satış Görüşmesini Aç
                </Link>
              </Panel>
              );
            },
          )
        ) : (
          <Panel>
            <p className="eyebrow">
              Aktif Fırsat Yok
            </p>

            <h2>
              Henüz katılım fırsatı yok
            </h2>

            <p className="muted">
              Bu firma bir fuarla ilgilenmeye
              başladığında yeni bir fırsat oluşturun.
            </p>
          </Panel>
        )}
      </div>
    </section>
  );
}