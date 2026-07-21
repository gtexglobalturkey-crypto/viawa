import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";

import {
  getCompanies,
  type Company,
} from "../../services/supabase/companyService";

import {
  getExhibitions,
  type Exhibition,
} from "../../services/supabase/exhibitionService";

import {
  getOpportunities,
  type Opportunity,
} from "../../services/supabase/opportunityService";

type ParticipationData = {
  companies: Company[];
  exhibitions: Exhibition[];
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
};

type ParticipationItem = {
  opportunity: Opportunity;
  company: Company | null;
  exhibition: Exhibition | null;
};

const initialData: ParticipationData = {
  companies: [],
  exhibitions: [],
  opportunities: [],
  loading: true,
  error: null,
};

const STAGE_LABELS: Record<string, string> = {
  new: "Yeni",
  contacted: "İletişime Geçildi",
  interested: "İlgileniyor",
  "information-sent": "Bilgi Paketi Gönderildi",
  "quotation-requested": "Teklif Talep Edildi",
  "quotation-sent": "Teklif Gönderildi",
  negotiation: "Görüşme",
  contract: "Sözleşme",
  signed: "İmzalandı",
  lost: "Kaybedildi",
};

function formatStage(stage: string): string {
  return (
    STAGE_LABELS[stage] ??
    stage
      .split("-")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1),
      )
      .join(" ")
  );
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "Planlanmadı";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Planlanmadı";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatEstimatedValue(
  value?: number | null,
): string {
  if (value === undefined || value === null) {
    return "Hesaplanmadı";
  }

  return value.toLocaleString("en-US");
}

function getInterestLabel(
  interestLevel: number,
): string {
  if (interestLevel >= 75) {
    return "Yüksek";
  }

  if (interestLevel >= 40) {
    return "Orta";
  }

  return "Düşük";
}

function getOpportunityStatus(
  stage: string,
): string {
  switch (stage) {
    case "signed":
      return "Kazanıldı";

    case "lost":
      return "Kaybedildi";

    case "contract":
    case "negotiation":
    case "quotation-sent":
      return "Aktif";

    case "interested":
    case "information-sent":
    case "quotation-requested":
      return "Sıcak";

    default:
      return "Yeni";
  }
}

export function ParticipationOpportunitiesPage() {
  const [data, setData] =
    useState<ParticipationData>(initialData);

  useEffect(() => {
    let isActive = true;

    async function loadParticipationData() {
      try {
        const [
          companies,
          exhibitions,
          opportunities,
        ] = await Promise.all([
          getCompanies(),
          getExhibitions(),
          getOpportunities(),
        ]);

        if (!isActive) {
          return;
        }

        setData({
          companies,
          exhibitions,
          opportunities,
          loading: false,
          error: null,
        });
      } catch (loadError) {
        console.error(
          "Participation opportunities loading error:",
          loadError,
        );

        if (!isActive) {
          return;
        }

        setData({
          companies: [],
          exhibitions: [],
          opportunities: [],
          loading: false,
          error:
            "Katılım fırsatları yüklenemedi.",
        });
      }
    }

    void loadParticipationData();

    return () => {
      isActive = false;
    };
  }, []);

  const companyMap = useMemo(
    () =>
      new Map(
        data.companies.map((company) => [
          company.id,
          company,
        ]),
      ),
    [data.companies],
  );

  const exhibitionMap = useMemo(
    () =>
      new Map(
        data.exhibitions.map((exhibition) => [
          exhibition.id,
          exhibition,
        ]),
      ),
    [data.exhibitions],
  );

  const participationItems = useMemo<
    ParticipationItem[]
  >(
    () =>
      data.opportunities
        .map((opportunity) => ({
          opportunity,
          company:
            companyMap.get(
              opportunity.company_id,
            ) ?? null,
          exhibition: opportunity.exhibition_id
            ? exhibitionMap.get(
                opportunity.exhibition_id,
              ) ?? null
            : null,
        }))
        .sort(
          (firstItem, secondItem) =>
            new Date(
              secondItem.opportunity.updated_at,
            ).getTime() -
            new Date(
              firstItem.opportunity.updated_at,
            ).getTime(),
        ),
    [
      data.opportunities,
      companyMap,
      exhibitionMap,
    ],
  );

  const activeOpportunityCount = useMemo(
    () =>
      data.opportunities.filter(
        (opportunity) =>
          opportunity.stage !== "signed" &&
          opportunity.stage !== "lost",
      ).length,
    [data.opportunities],
  );

  const highInterestCount = useMemo(
    () =>
      data.opportunities.filter(
        (opportunity) =>
          opportunity.interest_level >= 75,
      ).length,
    [data.opportunities],
  );

  const totalPipelineValue = useMemo(
    () =>
      data.opportunities
        .filter(
          (opportunity) =>
            opportunity.stage !== "lost",
        )
        .reduce(
          (total, opportunity) =>
            total +
            (opportunity.estimated_value ?? 0),
          0,
        ),
    [data.opportunities],
  );

  if (data.loading) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Katılım"
          title="Katılım Fırsatları"
          subtitle="Atlas canlı fırsat sürecini yüklüyor."
        />

        <Panel>
          <h2>Fırsatlar yükleniyor...</h2>

          <p className="muted">
            Firma, fuar ve katılım kayıtları
            yükleniyor.
          </p>
        </Panel>
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Katılım"
          title="Katılım Fırsatları"
          subtitle="Canlı fırsat süreci yüklenemedi."
        />

        <Panel>
          <h2>Fırsatlar yüklenemedi</h2>

          <p className="muted">{data.error}</p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Temsilci MVP"
        title="Katılım Fırsatları"
        subtitle="Her fuar katılımı ayrı bir satış süreci olarak yönetilir."
      />

      <section className="today-grid">
        <Panel>
          <p className="eyebrow">Süreç</p>
          <h2>Aktif Fırsatlar</h2>
          <p>Devam eden katılım kayıtları.</p>
          <strong>{activeOpportunityCount} aktif</strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Müşteri İlgisi</p>
          <h2>Yüksek İlgi</h2>
          <p>Güçlü müşteri ilgisi olan fırsatlar.</p>
          <strong>{highInterestCount} fırsat</strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Portföy</p>
          <h2>Temsil Edilen Fuarlar</h2>
          <p>Atlas'ta şu anda kayıtlı fuarlar.</p>
          <strong>{data.exhibitions.length} fuar</strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Süreç Değeri</p>
          <h2>Tahmini Değer</h2>
          <p>Kaybedilen fırsatlar hariç toplam tahmini değer.</p>
          <strong>
            {totalPipelineValue.toLocaleString("en-US")}
          </strong>
        </Panel>
      </section>

      <section className="section-head">
        <div>
          <p className="eyebrow">Satış Süreci</p>
          <h2>Tüm Katılım Fırsatları</h2>
          <p className="muted">
            Firma ilgisini, fuar detaylarını ve
            gereken sonraki aksiyonu gözden geçirin.
          </p>
        </div>

        <Link
          className="btn btn-primary"
          to="/companies"
        >
          + Yeni Katılım Fırsatı
        </Link>
      </section>

      <section className="opportunity-list">
        {participationItems.length > 0 ? (
          participationItems.map(
            ({
              opportunity,
              company,
              exhibition,
            }) => (
              <Panel
                className="opportunity-card"
                key={opportunity.id}
              >
                <div>
                  <p className="eyebrow">
                    {getOpportunityStatus(
                      opportunity.stage,
                    )}
                  </p>

                  <h2>
                    {exhibition?.name ??
                      "Fuar atanmadı"}
                  </h2>

                  <p className="muted">
                    {company?.company_name ??
                      "Firma bulunamadı"}
                  </p>
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
                    <span>İlgi Düzeyi</span>
                    <strong>
                      {getInterestLabel(
                        opportunity.interest_level,
                      )}{" "}
                      · {opportunity.interest_level}%
                    </strong>
                  </div>

                  <div>
                    <span>Tahmini Değer</span>
                    <strong>
                      {formatEstimatedValue(
                        opportunity.estimated_value,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Fuar Konumu</span>
                    <strong>
                      {exhibition
                        ? [
                            exhibition.city,
                            exhibition.country,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                          "Kayıtlı değil"
                        : "Kayıtlı değil"}
                    </strong>
                  </div>

                  <div>
                    <span>Fuar Tarihleri</span>
                    <strong>
                      {exhibition
                        ? `${formatDate(
                            exhibition.start_date,
                          )} – ${formatDate(
                            exhibition.end_date,
                          )}`
                        : "Kayıtlı değil"}
                    </strong>
                  </div>

                  <div>
                    <span>Sonraki Aksiyon</span>
                    <strong>
                      {opportunity.next_action ??
                        "Planlanmış aksiyon yok"}
                    </strong>
                  </div>

                  <div>
                    <span>Sonraki Aksiyon Tarihi</span>
                    <strong>
                      {formatDate(
                        opportunity.next_action_date,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Sorumlu</span>
                    <strong>
                      {opportunity.owner ??
                        "Atanmadı"}
                    </strong>
                  </div>
                </div>

                {company ? (
                  <Link
                    className="btn btn-primary"
                    to={`/call?companyId=${encodeURIComponent(
                      company.id,
                    )}&opportunityId=${encodeURIComponent(
                      opportunity.id,
                    )}`}
                  >
                    Satış Görüşmesini Aç
                  </Link>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled
                  >
                    Firma Eksik
                  </button>
                )}
              </Panel>
            ),
          )
        ) : (
          <Panel>
            <p className="eyebrow">
              Fırsat Bulunamadı
            </p>

            <h2>
              Henüz katılım fırsatı yok
            </h2>

            <p className="muted">
              İlk katılım fırsatını bir firma
              kaydından oluşturun.
            </p>

            <Link
              className="btn btn-primary"
              to="/companies"
            >
              Firmaları Aç
            </Link>
          </Panel>
        )}
      </section>
    </main>
  );
}