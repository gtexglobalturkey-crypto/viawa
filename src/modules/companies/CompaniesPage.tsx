import {
  AlertTriangle,
  Building2,
  CalendarClock,
  TrendingUp,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";

import {
  getCompanies,
  type Company,
} from "../../services/supabase/companyService";

import {
  getOpportunities,
  type Opportunity,
} from "../../services/supabase/opportunityService";

type StatusFilter =
  | "all"
  | "lead"
  | "prospect"
  | "customer"
  | "inactive";

function normalizeValue(
  value: string | null | undefined,
): string {
  return value?.trim().toLowerCase() ?? "";
}

function formatDate(
  value: string | null | undefined,
): string {
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

function isSameDay(
  firstDate: Date,
  secondDate: Date,
): boolean {
  return (
    firstDate.getFullYear() ===
      secondDate.getFullYear() &&
    firstDate.getMonth() ===
      secondDate.getMonth() &&
    firstDate.getDate() ===
      secondDate.getDate()
  );
}

function stripLabelPrefix(
  value: string | null | undefined,
): string | undefined {
  if (!value) {
    return value ?? undefined;
  }

  return value
    .replace(/^[a-z][a-z0-9_]*\s*:\s*/i, "")
    .trim();
}

function formatEnumLabel(
  value: string | null | undefined,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  return cleaned
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

const STATUS_LABELS: Record<string, string> = {
  lead: "Potansiyel Müşteri",
  prospect: "Aday Müşteri",
  customer: "Müşteri",
  inactive: "Pasif",
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
  signed: "Kazanıldı",
  lost: "Kaybedildi",
};

const NEXT_ACTION_LABELS: Record<
  string,
  string
> = {
  "initial sales call":
    "İlk Satış Görüşmesi",
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

function formatStatusLabel(
  value: string | null | undefined,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  return (
    STATUS_LABELS[cleaned.toLowerCase()] ??
    formatEnumLabel(cleaned)
  );
}

function formatStageLabel(
  value: string | null | undefined,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  return (
    STAGE_LABELS[cleaned.toLowerCase()] ??
    formatEnumLabel(cleaned)
  );
}

function formatNextActionLabel(
  value: string | null | undefined,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  const normalizedValue =
    cleaned.toLowerCase();

  const exactMatch =
    NEXT_ACTION_LABELS[normalizedValue];

  if (exactMatch) {
    return exactMatch;
  }

  if (
    normalizedValue.includes("follow-up") ||
    normalizedValue.includes("follow up")
  ) {
    return "Takip Araması";
  }

  if (normalizedValue.includes("meeting")) {
    return "Toplantı Planlandı";
  }

  if (
    normalizedValue.includes("quotation") ||
    normalizedValue.includes("quote")
  ) {
    return "Teklif Süreci";
  }

  return cleaned;
}

function toTitleCase(
  value: string | null | undefined,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase(),
    )
    .join(" ");
}

const INDUSTRY_LABELS: Record<string, string> = {
  mining: "Madencilik",
};

function formatIndustryLabel(
  value: string | null | undefined,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  return (
    INDUSTRY_LABELS[cleaned.toLowerCase()] ??
    toTitleCase(cleaned)
  );
}

function escapeCsvValue(
  value: string | number,
): string {
  const normalizedValue = String(value);

  if (
    normalizedValue.includes(",") ||
    normalizedValue.includes('"') ||
    normalizedValue.includes("\n")
  ) {
    return `"${normalizedValue.replace(
      /"/g,
      '""',
    )}"`;
  }

  return normalizedValue;
}

export function CompaniesPage() {
  const [
    companies,
    setCompanies,
  ] = useState<Company[]>([]);

  const [
    opportunities,
    setOpportunities,
  ] = useState<Opportunity[]>([]);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>("all");

  const [
    industryFilter,
    setIndustryFilter,
  ] = useState("all");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const loadCompanyWorkspace =
    useCallback(async (
      refresh = false,
    ) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const [
          companyData,
          opportunityData,
        ] = await Promise.all([
          getCompanies(),
          getOpportunities(),
        ]);

        setCompanies(companyData);
        setOpportunities(
          opportunityData,
        );
      } catch (error) {
        console.error(
          "Company workspace could not be loaded:",
          error,
        );

        setErrorMessage(
          "Firma bilgileri yüklenemedi.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }, []);

  useEffect(() => {
    let isActive = true;

    void Promise.all([
      getCompanies(),
      getOpportunities(),
    ])
      .then(
        ([
          companyData,
          opportunityData,
        ]) => {
          if (!isActive) {
            return;
          }

          setCompanies(companyData);
          setOpportunities(
            opportunityData,
          );
        },
      )
      .catch((error) => {
        console.error(
          "Company workspace could not be loaded:",
          error,
        );

        if (!isActive) {
          return;
        }

        setErrorMessage(
          "Firma bilgileri yüklenemedi.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const industries =
    useMemo(() => {
      return Array.from(
        new Set(
          companies
            .map(
              (company) =>
                company.industry?.trim(),
            )
            .filter(
              (
                industry,
              ): industry is string =>
                Boolean(industry),
            ),
        ),
      ).sort((first, second) =>
        first.localeCompare(second),
      );
    }, [companies]);

  const companyRows =
    useMemo(() => {
      return companies.map(
        (company) => {
          const companyOpportunities =
            opportunities.filter(
              (opportunity) =>
                opportunity.company_id ===
                company.id,
            );

          const orderedOpportunities =
            [...companyOpportunities].sort(
              (
                firstOpportunity,
                secondOpportunity,
              ) => {
                const firstDate =
                  firstOpportunity
                    .next_action_date
                    ? new Date(
                        firstOpportunity
                          .next_action_date,
                      ).getTime()
                    : Number.POSITIVE_INFINITY;

                const secondDate =
                  secondOpportunity
                    .next_action_date
                    ? new Date(
                        secondOpportunity
                          .next_action_date,
                      ).getTime()
                    : Number.POSITIVE_INFINITY;

                return (
                  firstDate - secondDate
                );
              },
            );

          const nextOpportunity =
            orderedOpportunities[0] ??
            null;

          return {
            company,
            opportunities:
              companyOpportunities,
            nextOpportunity,
          };
        },
      );
    }, [
      companies,
      opportunities,
    ]);

  const filteredRows =
    useMemo(() => {
      const normalizedQuery =
        normalizeValue(searchQuery);

      return companyRows.filter(
        ({
          company,
          nextOpportunity,
        }) => {
          const companyStatus =
            normalizeValue(
              company.status,
            );

          const matchesStatus =
            statusFilter === "all" ||
            companyStatus ===
              statusFilter;

          const matchesIndustry =
            industryFilter ===
              "all" ||
            normalizeValue(
              company.industry,
            ) ===
              normalizeValue(
                industryFilter,
              );

          const searchableValues = [
            company.company_name,
            company.contact_person,
            company.email,
            company.phone,
            company.country,
            company.industry,
            company.status,
            nextOpportunity?.next_action,
            nextOpportunity?.stage,
          ]
            .map(normalizeValue)
            .join(" ");

          const matchesSearch =
            !normalizedQuery ||
            searchableValues.includes(
              normalizedQuery,
            );

          return (
            matchesStatus &&
            matchesIndustry &&
            matchesSearch
          );
        },
      );
    }, [
      companyRows,
      industryFilter,
      searchQuery,
      statusFilter,
    ]);

  const metrics =
    useMemo(() => {
      const now = new Date();

      const openOpportunities =
        opportunities.filter(
          (opportunity) =>
            ![
              "signed",
              "lost",
            ].includes(
              normalizeValue(
                opportunity.stage,
              ),
            ),
        );

      const todayFollowUps =
        opportunities.filter(
          (opportunity) => {
            if (
              !opportunity
                .next_action_date
            ) {
              return false;
            }

            return isSameDay(
              new Date(
                opportunity
                  .next_action_date,
              ),
              now,
            );
          },
        );

      const overdue =
        opportunities.filter(
          (opportunity) => {
            if (
              !opportunity
                .next_action_date
            ) {
              return false;
            }

            const nextActionDate =
              new Date(
                opportunity
                  .next_action_date,
              );

            return (
              nextActionDate.getTime() <
                now.getTime() &&
              !isSameDay(
                nextActionDate,
                now,
              ) &&
              ![
                "signed",
                "lost",
              ].includes(
                normalizeValue(
                  opportunity.stage,
                ),
              )
            );
          },
        );

      return {
        companies:
          companies.length,
        openOpportunities:
          openOpportunities.length,
        todayFollowUps:
          todayFollowUps.length,
        overdue:
          overdue.length,
      };
    }, [
      companies.length,
      opportunities,
    ]);

  function handleExport() {
    const header = [
      "Firma",
      "Kişi",
      "E-posta",
      "Telefon",
      "Ülke",
      "Sektör",
      "Durum",
      "Fırsatlar",
      "Aşama",
      "Sonraki Aksiyon",
      "Sonraki Aksiyon Tarihi",
    ];

    const rows = filteredRows.map(
      ({
        company,
        opportunities:
          companyOpportunities,
        nextOpportunity,
      }) => [
        company.company_name,
        company.contact_person ?? "",
        company.email ?? "",
        company.phone ?? "",
        company.country ?? "",
        company.industry ?? "",
        formatStatusLabel(
          company.status,
        ) ?? "",
        companyOpportunities.length,
        formatStageLabel(
          nextOpportunity?.stage,
        ) ?? "",
        formatNextActionLabel(
          nextOpportunity
            ?.next_action,
        ) ?? "",
        nextOpportunity
          ?.next_action_date ?? "",
      ],
    );

    const csvContent = [
      header,
      ...rows,
    ]
      .map((row) =>
        row
          .map(escapeCsvValue)
          .join(","),
      )
      .join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type:
          "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      "atlas-companies.csv";

    document.body.appendChild(
      anchor,
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="page companies-page">
      <PageHeader
        eyebrow="Firmalar"
        title="Firma Çalışma Alanı"
        subtitle="Firma portföyünüzü, fırsatlarınızı ve sonraki aksiyonlarınızı yönetin."
      />

      <section className="companies-toolbar">
        <div className="companies-toolbar-actions">
          <Link
            className="btn btn-primary"
            to="/companies/new"
          >
            + Yeni Firma
          </Link>

          <Link
            className="btn"
            to="/companies/import"
          >
            Portföy İçe Aktar
          </Link>

          <button
            className="btn"
            type="button"
            onClick={handleExport}
            disabled={
              filteredRows.length === 0
            }
          >
            CSV Dışa Aktar
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => {
              void loadCompanyWorkspace(
                true,
              );
            }}
            disabled={isRefreshing}
          >
            {isRefreshing
              ? "Yenileniyor..."
              : "Yenile"}
          </button>
        </div>
      </section>

      <section className="companies-kpi-grid">
        <Panel className="companies-kpi-card">
          <Building2
            className="companies-kpi-icon"
            size={16}
          />

          <div className="companies-kpi-body">
            <strong>
              {metrics.companies}
            </strong>

            <span>Firmalar</span>
          </div>
        </Panel>

        <Panel className="companies-kpi-card">
          <TrendingUp
            className="companies-kpi-icon"
            size={16}
          />

          <div className="companies-kpi-body">
            <strong>
              {
                metrics.openOpportunities
              }
            </strong>

            <span>Açık Fırsatlar</span>
          </div>
        </Panel>

        <Panel className="companies-kpi-card">
          <AlertTriangle
            className="companies-kpi-icon"
            size={16}
          />

          <div className="companies-kpi-body">
            <strong>
              {metrics.overdue}
            </strong>

            <span>Gecikmiş</span>
          </div>
        </Panel>

        <Panel className="companies-kpi-card">
          <CalendarClock
            className="companies-kpi-icon"
            size={16}
          />

          <div className="companies-kpi-body">
            <strong>
              {metrics.todayFollowUps}
            </strong>

            <span>Bugünkü Takipler</span>
          </div>
        </Panel>
      </section>

      <Panel className="companies-filter-panel">
        <div className="companies-filter-grid">
          <label className="companies-search-field">
            <span>Firma Ara</span>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(
                  event.target.value,
                );
              }}
              placeholder="Firma, kişi, e-posta veya telefon"
            />
          </label>

          <label>
            <span>Durum</span>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target
                    .value as StatusFilter,
                );
              }}
            >
              <option value="all">
                Tüm durumlar
              </option>

              <option value="lead">
                Potansiyel Müşteri
              </option>

              <option value="prospect">
                Aday Müşteri
              </option>

              <option value="customer">
                Müşteri
              </option>

              <option value="inactive">
                Pasif
              </option>
            </select>
          </label>

          <label>
            <span>Sektör</span>

            <select
              value={industryFilter}
              onChange={(event) => {
                setIndustryFilter(
                  event.target.value,
                );
              }}
            >
              <option value="all">
                Tüm sektörler
              </option>

              {industries.map(
                (industry) => (
                  <option
                    key={industry}
                    value={industry}
                  >
                    {formatIndustryLabel(
                      industry,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="companies-result-count">
            <span>Sonuç</span>

            <strong>
              {filteredRows.length}
            </strong>
          </div>
        </div>
      </Panel>

      {isLoading && (
        <Panel>
          <p>
            Firmalar yükleniyor...
          </p>
        </Panel>
      )}

      {errorMessage && (
        <Panel>
          <p>{errorMessage}</p>

          <button
            className="btn"
            type="button"
            onClick={() => {
              void loadCompanyWorkspace();
            }}
          >
            Tekrar Dene
          </button>
        </Panel>
      )}

      {!isLoading &&
        !errorMessage &&
        companies.length === 0 && (
          <Panel className="companies-empty-state">
            <p className="eyebrow">
              Portföyünüze başlayın
            </p>

            <h2>
              Firma bulunamadı
            </h2>

            <p className="muted">
              İlk firmayı oluşturun veya mevcut
              bir portföyü içe aktarın.
            </p>

            <div className="companies-empty-actions">
              <Link
                className="btn btn-primary"
                to="/companies/new"
              >
                + Yeni Firma
              </Link>

              <Link
                className="btn"
                to="/companies/import"
              >
                Portföy İçe Aktar
              </Link>
            </div>
          </Panel>
        )}

      {!isLoading &&
        !errorMessage &&
        companies.length > 0 &&
        filteredRows.length === 0 && (
          <Panel className="companies-empty-state">
            <h2>
              Eşleşen firma yok
            </h2>

            <p className="muted">
              Daha fazla sonuç görmek için arama
              veya filtre ayarlarını değiştirin.
            </p>

            <button
              className="btn"
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setIndustryFilter("all");
              }}
            >
              Filtreleri Temizle
            </button>
          </Panel>
        )}

      {!isLoading &&
        !errorMessage &&
        filteredRows.length > 0 && (
          <section className="company-list">
            {filteredRows.map(
              ({
                company,
                opportunities:
                  companyOpportunities,
                nextOpportunity,
              }) => {
                const contactName =
                  stripLabelPrefix(
                    company.contact_person,
                  ) ?? "Birincil kişi yok";

                const nextAction =
                  formatNextActionLabel(
                    nextOpportunity
                      ?.next_action,
                  ) ??
                  "Planlanmış aksiyon yok";

                const stage =
                  formatStageLabel(
                    nextOpportunity?.stage,
                  ) ?? "Fırsat yok";

                return (
                  <Panel
                    key={company.id}
                    className="company-row"
                  >
                    <div className="company-row-main">
                      <h2>
                        {
                          stripLabelPrefix(
                            company.company_name,
                          ) ??
                            company.company_name
                        }
                      </h2>

                      <p>
                        {contactName}
                      </p>

                      <span>
                        {stripLabelPrefix(
                          company.email,
                        ) ??
                          stripLabelPrefix(
                            company.phone,
                          ) ??
                          "İletişim bilgisi yok"}
                      </span>
                    </div>

                    <div>
                      <span>Sektör</span>

                      <strong>
                        {formatIndustryLabel(
                          company.industry,
                        ) ?? "Atanmadı"}
                      </strong>
                    </div>

                    <div>
                      <span>Durum</span>

                      <strong>
                        {formatStatusLabel(
                          company.status,
                        ) ?? "Potansiyel Müşteri"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Fırsatlar
                      </span>

                      <strong>
                        {
                          companyOpportunities.length
                        }
                      </strong>
                    </div>

                    <div>
                      <span>Aşama</span>

                      <strong>
                        {stage}
                      </strong>
                    </div>

                    <div>
                      <span>Sonraki Aksiyon</span>

                      <strong>
                        {nextAction}
                      </strong>

                      <small>
                        {formatDate(
                          nextOpportunity
                            ?.next_action_date,
                        )}
                      </small>
                    </div>

                    <Link
                      className="btn btn-primary"
                      to={`/companies/${company.id}`}
                    >
                      Firmayı Aç
                    </Link>
                  </Panel>
                );
              },
            )}
          </section>
        )}
    </main>
  );
}