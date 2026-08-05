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
import { normalizeMasterListName } from "../../core/normalization/masterListName";

import {
  getCompanies,
  type Company,
} from "../../services/supabase/companyService";

import {
  getOpportunities,
  type Opportunity,
} from "../../services/supabase/opportunityService";

import {
  listCompanySectorRelations,
  type CompanySectorRelation,
} from "../../services/supabase/sectorService";

import {
  listCompanyProductGroupRelations,
  listProductGroups,
  type CompanyProductGroupRelation,
  type ProductGroup,
} from "../../services/supabase/productGroupService";

import {
  getBusinessStatusLabel,
  isTerminalBusinessStatus,
  MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY,
  type CompanyStatusLabel,
} from "../../types/businessStatus";
import { resolveCompanyRowSummary } from "./models/companyRowSummary";

// Kritik Akış Düzeltmesi 8 — Companies satırı (bkz.
// resolveCompanyRowSummary, Kritik Akış Düzeltmesi 7) artık yalnızca bu
// iki durumu üretebiliyor. businessStatus.ts'in kendi COMPANY_STATUS_LABELS
// listesi (Yeni Firma/Sözleşmeli Firma dahil, 4 durumlu) kasıtlı olarak
// KULLANILMIYOR ve değiştirilmedi — CompanyDetailPage gibi başka
// ekranlarda hâlâ o daha geniş modeli kullanıyor. Bu, yalnızca Companies
// listesinin filtre dropdown'ını kendi özet mantığıyla uyumlu tutan,
// bu sayfaya özel bir liste.
const COMPANIES_STATUS_FILTER_OPTIONS = [
  "Potansiyel Firma",
  "Pasif Firma",
] as const satisfies readonly CompanyStatusLabel[];

type StatusFilter =
  | "all"
  | (typeof COMPANIES_STATUS_FILTER_OPTIONS)[number];

function normalizeValue(
  value: string | null | undefined,
): string {
  return value?.trim().toLowerCase() ?? "";
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
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

function formatStageLabel(
  value: string | null | undefined,
): string | undefined {
  return getBusinessStatusLabel(
    stripLabelPrefix(value),
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

const INDUSTRY_CANONICAL_LABELS: Record<
  string,
  string
> = {
  mining: "Madencilik",
  madencilik: "Madencilik",
  gıda: "Gıda",
  tarım: "Tarım",
};

/**
 * Turkish-locale-aware lowercasing so "GIDA"/"gıda"/"Gıda" and
 * "MADENCİLİK"/"madencilik" collapse to the same key — plain `.toLowerCase()`
 * maps "I" to ASCII "i" instead of Turkish "ı", which would otherwise keep
 * "GIDA" and "gıda" as distinct keys.
 */
function normalizeIndustryKey(
  value: string,
): string {
  return normalizeMasterListName(value);
}

function toTurkishTitleCase(
  value: string,
): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word
          .charAt(0)
          .toLocaleUpperCase("tr") +
        word
          .slice(1)
          .toLocaleLowerCase("tr"),
    )
    .join(" ");
}

function formatIndustryLabel(
  value: string | null | undefined,
): string | undefined {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  const key = normalizeIndustryKey(cleaned);

  return (
    INDUSTRY_CANONICAL_LABELS[key] ??
    toTurkishTitleCase(cleaned)
  );
}

/**
 * Groups by the final *displayed* label, not the raw value — "mining" and
 * "madencilik" both format to the same "Madencilik" label and must collapse
 * into a single filter option instead of two identical-looking entries.
 */
function getIndustryKey(
  value: string | null | undefined,
): string {
  const label = formatIndustryLabel(value);

  return label
    ? normalizeIndustryKey(label)
    : "";
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
    companySectorRelations,
    setCompanySectorRelations,
  ] = useState<CompanySectorRelation[]>([]);

  const [productGroups, setProductGroups] =
    useState<ProductGroup[]>([]);

  const [
    companyProductGroupRelations,
    setCompanyProductGroupRelations,
  ] = useState<CompanyProductGroupRelation[]>([]);

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
    productGroupFilter,
    setProductGroupFilter,
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
          companySectorData,
          productGroupData,
          companyProductGroupData,
        ] = await Promise.all([
          getCompanies(),
          getOpportunities(),
          listCompanySectorRelations(),
          listProductGroups(),
          listCompanyProductGroupRelations(),
        ]);

        setCompanies(companyData);
        setOpportunities(
          opportunityData,
        );
        setCompanySectorRelations(
          companySectorData,
        );
        setProductGroups(productGroupData);
        setCompanyProductGroupRelations(
          companyProductGroupData,
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
      listCompanySectorRelations(),
      listProductGroups(),
      listCompanyProductGroupRelations(),
    ])
      .then(
        ([
          companyData,
          opportunityData,
          companySectorData,
          productGroupData,
          companyProductGroupData,
        ]) => {
          if (!isActive) {
            return;
          }

          setCompanies(companyData);
          setOpportunities(
            opportunityData,
          );
          setCompanySectorRelations(
            companySectorData,
          );
          setProductGroups(productGroupData);
          setCompanyProductGroupRelations(
            companyProductGroupData,
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

  const companySectorsByCompanyId =
    useMemo(() => {
      const relationsByCompanyId = new Map<
        string,
        CompanySectorRelation[]
      >();

      companySectorRelations.forEach(
        (relation) => {
          const relations =
            relationsByCompanyId.get(
              relation.companyId,
            ) ?? [];

          relations.push(relation);
          relationsByCompanyId.set(
            relation.companyId,
            relations,
          );
        },
      );

      return relationsByCompanyId;
    }, [companySectorRelations]);

  const industries =
    useMemo(() => {
      const labelsByKey = new Map<
        string,
        string
      >();

      companySectorRelations.forEach(
        (relation) => {
          const label = formatIndustryLabel(
            relation.name,
          );

          if (!label) {
            return;
          }

          const key = getIndustryKey(label);

          if (!labelsByKey.has(key)) {
            labelsByKey.set(key, label);
          }
        },
      );

      companies.forEach((company) => {
        if (
          companySectorsByCompanyId.has(
            company.id,
          )
        ) {
          return;
        }

        const label = formatIndustryLabel(
          company.industry,
        );

        if (!label) {
          return;
        }

        const key = getIndustryKey(label);

        if (!labelsByKey.has(key)) {
          labelsByKey.set(key, label);
        }
      });

      return Array.from(
        labelsByKey.entries(),
      )
        .map(([key, label]) => ({
          key,
          label,
        }))
        .sort((first, second) =>
          first.label.localeCompare(
            second.label,
            "tr",
          ),
        );
    }, [
      companies,
      companySectorRelations,
      companySectorsByCompanyId,
    ]);

  const companyProductGroupsByCompanyId =
    useMemo(() => {
      const relationsByCompanyId = new Map<
        string,
        CompanyProductGroupRelation[]
      >();

      companyProductGroupRelations.forEach(
        (relation) => {
          const relations =
            relationsByCompanyId.get(
              relation.companyId,
            ) ?? [];

          relations.push(relation);
          relationsByCompanyId.set(
            relation.companyId,
            relations,
          );
        },
      );

      return relationsByCompanyId;
    }, [companyProductGroupRelations]);

  const productGroupOptions = useMemo(() => {
    const uniqueByNormalizedName = new Map<
      string,
      ProductGroup
    >();

    productGroups.forEach((productGroup) => {
      if (
        !uniqueByNormalizedName.has(
          productGroup.normalized_name,
        )
      ) {
        uniqueByNormalizedName.set(
          productGroup.normalized_name,
          productGroup,
        );
      }
    });

    return Array.from(
      uniqueByNormalizedName.values(),
    ).sort((first, second) =>
      first.name.localeCompare(
        second.name,
        "tr",
      ),
    );
  }, [productGroups]);

  useEffect(() => {
    if (
      productGroupFilter !== "all" &&
      !productGroupOptions.some(
        (productGroup) =>
          productGroup.id === productGroupFilter,
      )
    ) {
      setProductGroupFilter("all");
    }
  }, [productGroupFilter, productGroupOptions]);

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

          // Kritik Akış Düzeltmesi 7 — Companies satırı yalnızca aktif
          // (terminal olmayan) opportunity'lerden beslenir. Kaybedildi/
          // İmzalar Tamamlandı gibi terminal kayıtlar burada asla
          // aşama/sonraki aksiyon/durum üretmez — onlar artık yalnızca
          // Timeline, Katılım Geçmişi ve Belge Arşivi içinde yaşar (bkz.
          // CompanyDetailPage). companyOpportunities.length hâlâ ham
          // (aktif+terminal) sayıyı taşıyor — yalnızca "Fırsatlar"
          // sütununun KENDİSİ artık bunu değil, activeOpportunities'i
          // kullanıyor (aşağıda). Asıl kural resolveCompanyRowSummary'de
          // (birim testli — bkz. companyRowSummary.test.mjs).
          const {
            activeOpportunities,
            nextOpportunity,
            companyStatus,
          } = resolveCompanyRowSummary(
            companyOpportunities,
          );

          const sectors =
            companySectorsByCompanyId.get(
            company.id,
          ) ?? [];

          const companyProductGroups =
            companyProductGroupsByCompanyId.get(
              company.id,
            ) ?? [];

          return {
            company,
            sectors,
            opportunities:
              companyOpportunities,
            activeOpportunities,
            productGroups:
              companyProductGroups,
            nextOpportunity,
            companyStatus,
          };
        },
      );
    }, [
      companies,
      companySectorsByCompanyId,
      companyProductGroupsByCompanyId,
      opportunities,
    ]);

  const filteredRows =
    useMemo(() => {
      const normalizedQuery =
        normalizeValue(searchQuery);

      return companyRows.filter(
        ({
          company,
          companyStatus,
          nextOpportunity,
          productGroups:
            companyProductGroups,
          sectors,
        }) => {
          const matchesStatus =
            statusFilter === "all" ||
            companyStatus ===
              statusFilter;

          const matchesIndustry =
            industryFilter ===
              "all" ||
            (sectors.length > 0
              ? sectors.some(
                  (sector) =>
                    getIndustryKey(
                      sector.name,
                    ) === industryFilter,
                )
              : getIndustryKey(
                  company.industry,
                ) === industryFilter);

          const matchesProductGroup =
            productGroupFilter === "all" ||
            companyProductGroups.some(
              (productGroup) =>
                productGroup.productGroupId ===
                productGroupFilter,
            );

          const searchableValues = [
            company.company_name,
            company.contact_person,
            company.email,
            company.phone,
            company.country,
            company.industry,
            companyStatus,
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
            matchesProductGroup &&
            matchesSearch
          );
        },
      );
    }, [
      companyRows,
      industryFilter,
      productGroupFilter,
      searchQuery,
      statusFilter,
    ]);

  const metrics =
    useMemo(() => {
      const now = new Date();

      const openOpportunities =
        opportunities.filter(
          (opportunity) =>
            !isTerminalBusinessStatus(
              opportunity.stage,
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
              !isTerminalBusinessStatus(
                opportunity.stage,
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
      "Aktif Fırsatlar",
      "Aşama",
      "Sonraki Aksiyon",
      "Sonraki Aksiyon Tarihi",
    ];

    const rows = filteredRows.map(
      ({
        company,
        activeOpportunities,
        nextOpportunity,
        companyStatus,
      }) => [
        company.company_name,
        company.contact_person ?? "",
        company.email ?? "",
        company.phone ?? "",
        company.country ?? "",
        company.industry ?? "",
        companyStatus,
        `${activeOpportunities.length} / ${MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY}`,
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
                Tüm Durumlar
              </option>

              {COMPANIES_STATUS_FILTER_OPTIONS.map(
                (status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ),
              )}
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
                ({ key, label }) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Ürün Grubu</span>

            <select
              value={productGroupFilter}
              onChange={(event) => {
                setProductGroupFilter(
                  event.target.value,
                );
              }}
            >
              <option value="all">
                Tüm Ürün Grupları
              </option>

              {productGroupOptions.map(
                (productGroup) => (
                  <option
                    key={productGroup.id}
                    value={productGroup.id}
                  >
                    {productGroup.name}
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

      <div className="companies-results-area">
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
                  setProductGroupFilter("all");
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
                  activeOpportunities,
                  nextOpportunity,
                  companyStatus,
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
                    ) ?? "—";

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
                          {companyStatus}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Aktif Fırsatlar
                        </span>

                        <strong>
                          {
                            activeOpportunities.length
                          }{" "}
                          /{" "}
                          {
                            MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY
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
      </div>
    </main>
  );
}
