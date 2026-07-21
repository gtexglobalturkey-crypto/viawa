import {
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import { AIMemoryCard } from "../../components/company/AIMemoryCard";
import { CompanyHeader } from "../../components/company/CompanyHeader";
import { CompanyInfoCard } from "../../components/company/CompanyInfoCard";
import { OpportunityList } from "../../components/company/OpportunityList";
import { QuickActionsCard } from "../../components/company/QuickActionsCard";
import { TimelineCard } from "../../components/company/TimelineCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { useCompanyWorkspace } from "../../hooks/useCompanyWorkspace";

import {
  createOpportunity,
} from "../../services/supabase/opportunityService";

function getDefaultNextActionDate(): string {
  const date = new Date();

  date.setDate(date.getDate() + 1);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function stripLabelPrefix<
  T extends string | null | undefined,
>(value: T): T {
  if (!value) {
    return value;
  }

  return value.replace(
    /^[a-z][a-z0-9_]*\s*:\s*/i,
    "",
  ).trim() as T;
}

function toTitleCase<
  T extends string | null | undefined,
>(value: T): T {
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
    .join(" ") as T;
}

const INDUSTRY_LABELS: Record<string, string> = {
  mining: "Madencilik",
};

function formatIndustryLabel<
  T extends string | null | undefined,
>(value: T): T {
  const cleaned = stripLabelPrefix(value);

  if (!cleaned) {
    return cleaned;
  }

  return (
    (INDUSTRY_LABELS[
      cleaned.toLowerCase()
    ] ?? toTitleCase(cleaned)) as T
  );
}

export function CompanyDetailPage() {
  const { id } = useParams();

  const {
    company,
    aiMemory,
    loading,
    error,
    sortedOpportunities,
    sortedTimeline,
    latestTimelineEvent,
    nextReminder,
    primaryOpportunity,
    contactName,
    nextAction,
    exhibitionsById,
    formatDate,
    formatStage,
    formatEstimatedValue,
    getInterestLabel,
    refresh,
  } = useCompanyWorkspace(id);

  const [
    isOpportunityFormOpen,
    setIsOpportunityFormOpen,
  ] = useState(false);

  const [
    isCreatingOpportunity,
    setIsCreatingOpportunity,
  ] = useState(false);

  const [
    opportunityError,
    setOpportunityError,
  ] = useState<string | null>(null);

  const [
    stage,
    setStage,
  ] = useState("new");

  const [
    interestLevel,
    setInterestLevel,
  ] = useState("25");

  const [
    estimatedValue,
    setEstimatedValue,
  ] = useState("0");

  const [
    opportunityNextAction,
    setOpportunityNextAction,
  ] = useState("Initial sales call");

  const [
    opportunityNextActionDate,
    setOpportunityNextActionDate,
  ] = useState(
    getDefaultNextActionDate(),
  );

  const [
    owner,
    setOwner,
  ] = useState("");

  function resetOpportunityForm() {
    setStage("new");
    setInterestLevel("25");
    setEstimatedValue("0");
    setOpportunityNextAction(
      "Initial sales call",
    );
    setOpportunityNextActionDate(
      getDefaultNextActionDate(),
    );
    setOwner("");
    setOpportunityError(null);
  }

  function closeOpportunityForm() {
    if (isCreatingOpportunity) {
      return;
    }

    resetOpportunityForm();
    setIsOpportunityFormOpen(false);
  }

  async function handleCreateOpportunity(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !company ||
      isCreatingOpportunity
    ) {
      return;
    }

    const normalizedNextAction =
      opportunityNextAction.trim();

    if (!normalizedNextAction) {
      setOpportunityError(
        "Sonraki aksiyon zorunludur.",
      );

      return;
    }

    const parsedInterestLevel =
      Number(interestLevel);

    const parsedEstimatedValue =
      Number(estimatedValue);

    setIsCreatingOpportunity(true);
    setOpportunityError(null);

    try {
      await createOpportunity({
        company_id: company.id,
        exhibition_id: null,
        stage,
        interest_level:
          Number.isFinite(
            parsedInterestLevel,
          )
            ? Math.min(
                100,
                Math.max(
                  0,
                  parsedInterestLevel,
                ),
              )
            : 0,
        estimated_value:
          Number.isFinite(
            parsedEstimatedValue,
          )
            ? Math.max(
                0,
                parsedEstimatedValue,
              )
            : 0,
        next_action:
          normalizedNextAction,
        next_action_date:
          opportunityNextActionDate
            ? new Date(
                `${opportunityNextActionDate}T10:00:00`,
              ).toISOString()
            : null,
        owner:
          owner.trim() || null,
      });

      await refresh();

      resetOpportunityForm();
      setIsOpportunityFormOpen(false);
    } catch (createError) {
      console.error(
        "Opportunity creation error:",
        createError,
      );

      setOpportunityError(
        "Katılım fırsatı oluşturulamadı.",
      );
    } finally {
      setIsCreatingOpportunity(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Firma Çalışma Alanı"
          title="Firma yükleniyor..."
          subtitle="Atlas firma kaydını yüklüyor."
        />

        <Panel>
          <p className="muted">
            Çalışma alanı verileri yüklenirken lütfen bekleyin.
          </p>
        </Panel>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Firma Detayı"
          title="Firma yüklenemedi"
          subtitle={error}
        />

        <Link
          className="btn btn-primary"
          to="/companies"
        >
          Firmalara Dön
        </Link>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Firma Detayı"
          title="Firma bulunamadı"
          subtitle="İstenen firma kaydı bulunamadı."
        />

        <Link
          className="btn btn-primary"
          to="/companies"
        >
          Firmalara Dön
        </Link>
      </main>
    );
  }

  const statusLabel = company.status
    ? formatStage(company.status)
    : "Durum atanmadı";

  return (
    <main className="page company-detail-page">
      <CompanyHeader
        companyId={company.id}
        companyName={
          stripLabelPrefix(
            company.company_name,
          ) || company.company_name
        }
        contactName={contactName}
        statusLabel={statusLabel}
        opportunityCount={sortedOpportunities.length}
        nextAction={nextAction}
        lastContact={formatDate(
          latestTimelineEvent?.created_at,
        )}
      />

      <section className="company-detail-workspace">
        <CompanyInfoCard
          contactName={contactName}
          industry={formatIndustryLabel(
            company.industry,
          )}
          country={stripLabelPrefix(
            company.country,
          )}
          statusLabel={statusLabel}
          phone={stripLabelPrefix(company.phone)}
          email={stripLabelPrefix(company.email)}
          website={stripLabelPrefix(
            company.website,
          )}
          opportunityCount={sortedOpportunities.length}
          nextReminder={formatDate(
            nextReminder?.due_date,
          )}
          aiConfidence={aiMemory?.confidence}
        />

        <QuickActionsCard
          companyId={company.id}
          opportunityId={primaryOpportunity?.id}
        />
      </section>

      <section className="section-head">
        <div>
          <p className="eyebrow">
            Katılım
          </p>

          <h2>
            Katılım Fırsatları
          </h2>

          <p className="muted">
            Satış Görüşmesi başlatmadan önce bir satış
            fırsatı oluşturun.
          </p>
        </div>

        {!isOpportunityFormOpen ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setIsOpportunityFormOpen(true);
              setOpportunityError(null);
            }}
          >
            + Yeni Katılım Fırsatı
          </button>
        ) : null}
      </section>

      {isOpportunityFormOpen ? (
        <Panel className="opportunity-card">
          <form
            onSubmit={handleCreateOpportunity}
          >
            <div>
              <p className="eyebrow">
                Yeni Fırsat
              </p>

              <h2>
                {company.company_name}
              </h2>

              <p className="muted">
                Fırsatı oluşturun ve hemen Satış
                Görüşmesini açın.
              </p>
            </div>

            <div className="data-list">
              <label>
                <span>Aşama</span>

                <select
                  value={stage}
                  disabled={isCreatingOpportunity}
                  onChange={(event) => {
                    setStage(event.target.value);
                  }}
                >
                  <option value="new">
                    Yeni
                  </option>

                  <option value="contacted">
                    İletişime Geçildi
                  </option>

                  <option value="interested">
                    İlgileniyor
                  </option>

                  <option value="information-sent">
                    Bilgi Gönderildi
                  </option>

                  <option value="quotation-requested">
                    Teklif Talep Edildi
                  </option>

                  <option value="quotation-sent">
                    Teklif Gönderildi
                  </option>

                  <option value="negotiation">
                    Müzakere
                  </option>

                  <option value="contract">
                    Sözleşme
                  </option>
                </select>
              </label>

              <label>
                <span>
                  İlgi Düzeyi
                </span>

                <input
                  type="number"
                  min="0"
                  max="100"
                  value={interestLevel}
                  disabled={isCreatingOpportunity}
                  onChange={(event) => {
                    setInterestLevel(
                      event.target.value,
                    );
                  }}
                />
              </label>

              <label>
                <span>
                  Tahmini Değer
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={estimatedValue}
                  disabled={isCreatingOpportunity}
                  onChange={(event) => {
                    setEstimatedValue(
                      event.target.value,
                    );
                  }}
                />
              </label>

              <label>
                <span>Sonraki Aksiyon</span>

                <input
                  type="text"
                  required
                  value={opportunityNextAction}
                  disabled={isCreatingOpportunity}
                  onChange={(event) => {
                    setOpportunityNextAction(
                      event.target.value,
                    );
                  }}
                />
              </label>

              <label>
                <span>
                  Sonraki Aksiyon Tarihi
                </span>

                <input
                  type="date"
                  value={
                    opportunityNextActionDate
                  }
                  disabled={isCreatingOpportunity}
                  onChange={(event) => {
                    setOpportunityNextActionDate(
                      event.target.value,
                    );
                  }}
                />
              </label>

              <label>
                <span>Sorumlu</span>

                <input
                  type="text"
                  placeholder="İsteğe bağlı"
                  value={owner}
                  disabled={isCreatingOpportunity}
                  onChange={(event) => {
                    setOwner(event.target.value);
                  }}
                />
              </label>
            </div>

            {opportunityError ? (
              <p role="alert">
                {opportunityError}
              </p>
            ) : null}

            <div className="company-quick-actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={isCreatingOpportunity}
              >
                {isCreatingOpportunity
                  ? "Oluşturuluyor..."
                  : "Oluştur ve Satış Görüşmesini Başlat"}
              </button>

              <button
                className="btn"
                type="button"
                disabled={isCreatingOpportunity}
                onClick={closeOpportunityForm}
              >
                İptal
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <OpportunityList
        companyId={company.id}
        opportunities={sortedOpportunities}
        exhibitionsById={exhibitionsById}
        formatDate={formatDate}
        formatStage={formatStage}
        formatEstimatedValue={formatEstimatedValue}
        getInterestLabel={getInterestLabel}
      />

      <TimelineCard
        timeline={sortedTimeline}
        formatDate={formatDate}
        formatStage={formatStage}
      />

      <AIMemoryCard
        aiMemory={aiMemory}
        formatDate={formatDate}
      />
    </main>
  );
}