import { UserPlus, X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  CompanyHeader,
  type CompanyHeaderTag,
} from "../../components/company/CompanyHeader";
import { ExhibitionFileList } from "../../components/company/ExhibitionFileList";
import { useWorkspaceHeader } from "../../components/layout/workspaceHeaderContext";
import { useToast } from "../../components/feedback/toastContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { useCompanyWorkspace } from "../../hooks/useCompanyWorkspace";
import { useExhibitionSelection } from "../exhibitions/context/ExhibitionSelectionContext";
import { loadApprovedPriceSnapshots } from "../call-workspace/pricing/services/approvedPriceSnapshotStorage";
import { loadGeneratedDocuments } from "../document-engine/services/generatedDocumentStorage";
import { getCompanyProductGroups } from "../../services/supabase/productGroupService";
import { getCompanySectors } from "../../services/supabase/sectorService";
import {
  getBusinessStatusLabel,
  isTerminalBusinessStatus,
  MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY,
  resolveCompanyStatus,
} from "../../types/businessStatus";
import { getLostReasonLabel } from "../../types/opportunityClosure";

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

function getWorkspaceHref(
  companyId: string,
  opportunityId?: string | null,
): string {
  const encodedCompanyId =
    encodeURIComponent(companyId);

  return opportunityId
    ? `/call?companyId=${encodedCompanyId}&opportunityId=${encodeURIComponent(
        opportunityId,
      )}`
    : `/call?companyId=${encodedCompanyId}`;
}

function formatStandType(value?: string | null): string {
  if (!value) return "—";

  return ({
    "space-only": "Boş Alan",
    "shell-scheme": "Standart Stand",
    "premium-shell": "Premium Stand",
    custom: "Özel Stand",
    "custom-stand": "Özel Stand",
    outdoor: "Açık Alan",
  } as Record<string, string>)[value] ?? value;
}

const MAX_COMPANY_CONTACTS = 4;

type CompanyDetailModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

function CompanyDetailModal({ title, onClose, children, footer }: CompanyDetailModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="company-detail-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="company-detail-modal" role="dialog" aria-modal="true" aria-labelledby="company-detail-modal-title">
        <header className="company-detail-modal-header">
          <h2 id="company-detail-modal-title">{title}</h2>
          <button type="button" className="company-detail-modal-close" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>
        <div className="company-detail-modal-body">{children}</div>
        {footer ? <footer className="company-detail-modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

type PersonCardData = {
  id: string | null;
  label: string;
  name: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  isSignatory: boolean;
};

type PersonContactCardProps = {
  card: PersonCardData;
  linkHref: string;
  linkTitle: string;
  nameFallback: string;
  phoneFallback?: string | null;
  emailFallback?: string | null;
  emptyStateHref?: string;
  selected?: boolean;
  onSelect?: (contactId: string) => void;
};

/**
 * Single shared render for every Kişi 1-4 card. Every value shown (name,
 * title, phone, email, and both role badges) comes from this card's own
 * `card` prop only — there is exactly one JSX block for all 4 slots, so a
 * card can never end up showing another card's data.
 */
function PersonContactCard({
  card,
  linkHref,
  linkTitle,
  nameFallback,
  phoneFallback = null,
  emailFallback = null,
  emptyStateHref,
  selected = false,
  onSelect,
}: PersonContactCardProps) {
  const name = stripLabelPrefix(
    card.name,
  );
  const title = stripLabelPrefix(
    card.title,
  );
  const phone =
    stripLabelPrefix(card.phone) ||
    stripLabelPrefix(phoneFallback);
  const email =
    stripLabelPrefix(card.email) ||
    stripLabelPrefix(emailFallback);

  const hasData = Boolean(
    name || title || card.phone || card.email,
  );

  if (!hasData && emptyStateHref) {
    return (
      <Panel className="opportunity-card opportunity-card--add">
        <Link
          className="opportunity-card-add-btn"
          to={emptyStateHref}
          title="Kişi Ekle"
        >
          <UserPlus size={18} />
          Kişi Ekle
        </Link>
      </Panel>
    );
  }

  return (
    <Panel className={`opportunity-card ${selected ? "opportunity-card--selected" : ""}`}>
      {card.id && onSelect ? (
        <button
          type="button"
          className="contact-card-selector"
          aria-label={`${name || nameFallback} kişisini seç`}
          aria-pressed={selected}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(card.id as string);
          }}
        >
          <span />
        </button>
      ) : null}
      <div>
        <h2>
          <Link
            className="opportunity-card-person-link"
            to={linkHref}
            title={linkTitle}
          >
            {name || nameFallback}
          </Link>
        </h2>
      </div>

      <div className="data-list">
        <div className="contact-title-row">
          <strong>
            <span className="contact-title-label">
              Ünvan:
            </span>{" "}
            {title || "—"}
          </strong>

          {card.isPrimary ||
          card.isSignatory ? (
            <div className="contact-role-badges">
              {card.isPrimary ? (
                <span className="contact-role-badge">
                  Fuar Yetkilisi
                </span>
              ) : null}

              {card.isSignatory ? (
                <span className="contact-role-badge">
                  İmza Yetkilisi
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <span>Telefon</span>
          <strong>
            {phone ? (
              <a href={`tel:${phone}`}>
                {phone}
              </a>
            ) : (
              "—"
            )}
          </strong>
        </div>

        <div>
          <span>Mail</span>
          <strong>
            {email ? (
              <a
                href={`mailto:${email}`}
              >
                {email}
              </a>
            ) : (
              "—"
            )}
          </strong>
        </div>
      </div>
    </Panel>
  );
}

export function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { exhibitions: repositoryExhibitions } =
    useExhibitionSelection();

  const {
    setWorkspaceHeader,
    clearWorkspaceHeader,
  } = useWorkspaceHeader();

  const {
    company,
    loading,
    error,
    sortedOpportunities,
    contactName,
    contacts,
    exhibitionsById,
    formatDate,
  } = useCompanyWorkspace(id);

  const approvedPriceSnapshots = useMemo(
    () =>
      company?.id
        ? Object.values(
            loadApprovedPriceSnapshots(company.id),
          )
        : [],
    [company?.id],
  );

  // BUG-S26.003.2 — Firma Arşivi: signed contracts a Won closure has
  // archived (see CustomerWorkspace.closeOpportunityAsWon). Read-only —
  // this page never writes to generatedDocuments, it only displays the
  // archived subset. Same read-once-per-company pattern as
  // approvedPriceSnapshots above.
  const archivedContracts = useMemo(
    () =>
      company?.id
        ? loadGeneratedDocuments(company.id).filter((document) =>
            Boolean(document.archivedToCompanyArchiveAt),
          )
        : [],
    [company?.id],
  );

  const activeOpportunities =
    sortedOpportunities.filter(
      (opportunity) =>
        !isTerminalBusinessStatus(
          opportunity.stage,
        ),
    );

  // Sprint 25.5 Section 5 — "Geçmiş Fırsatlar": every terminal record
  // (Won, Lost, and still Signed-but-not-yet-verdicted) — the exact
  // inverse of activeOpportunities above, so a record can never appear
  // in both or neither.
  const historicalOpportunities =
    sortedOpportunities.filter(
      (opportunity) =>
        isTerminalBusinessStatus(
          opportunity.stage,
        ),
    );

  const activeOpportunity =
    activeOpportunities[0] ??
    sortedOpportunities[0] ??
    null;

  const companyStatusLabel =
    resolveCompanyStatus(sortedOpportunities);

  const [sectors, setSectors] = useState<
    CompanyHeaderTag[]
  >([]);

  const [
    productGroups,
    setProductGroups,
  ] = useState<CompanyHeaderTag[]>([]);

  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const placeholderPermanentNote =
    "Bu bölüm uzun süre geçerli kurumsal bilgileri içerir. Henüz kalıcı not eklenmedi.";
  const [permanentNote, setPermanentNote] = useState(
    placeholderPermanentNote,
  );
  const [noteDraft, setNoteDraft] = useState(
    placeholderPermanentNote,
  );
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedContactId(null);
  }, [company?.id]);

  // Independent of useCompanyWorkspace's shared data-fetch pipeline
  // (also used by Company Workspace/Communication) on purpose — these
  // tags are Company Record-only, so they're fetched separately here
  // rather than added to that shared hook.
  useEffect(() => {
    if (!company?.id) {
      setSectors([]);
      setProductGroups([]);
      return;
    }

    let isActive = true;

    Promise.all([
      getCompanySectors(company.id),
      getCompanyProductGroups(
        company.id,
      ),
    ])
      .then(
        ([
          companySectors,
          companyProductGroups,
        ]) => {
          if (!isActive) {
            return;
          }

          setSectors(companySectors);
          setProductGroups(
            companyProductGroups,
          );
        },
      )
      .catch((sectorLoadError) => {
        console.error(
          "Company sectors/product groups load error:",
          sectorLoadError,
        );
      });

    return () => {
      isActive = false;
    };
  }, [company?.id]);

  useEffect(() => {
    if (!company) {
      clearWorkspaceHeader();
      return;
    }

    setWorkspaceHeader({
      companyName:
        stripLabelPrefix(
          company.company_name,
        ) || company.company_name,
      companyCode: company.company_code,
    });

    return () => {
      clearWorkspaceHeader();
    };
  }, [
    company,
    setWorkspaceHeader,
    clearWorkspaceHeader,
  ]);

  if (loading) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Firma Kaydı"
          title="Firma yükleniyor..."
          subtitle="VIAWA firma kaydını yüklüyor."
        />

        <Panel>
          <p className="muted">
            Firma kaydı yüklenirken lütfen bekleyin.
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

  const editHref = `/companies/${encodeURIComponent(
    company.id,
  )}/edit`;
  const currentCompanyId = company.id;

  // `contacts` already arrives ordered ascending by created_at — the
  // query in contactService.ts sorts at the database level. Re-sorting
  // here client-side was redundant and is removed so there is exactly one
  // place that decides ordering.
  const personCardLabels = Array.from(
    { length: MAX_COMPANY_CONTACTS },
    (_, index) => `Kişi ${index + 1}`,
  );

  /**
   * One entry per card slot (position on screen), each carrying only its
   * OWN contact record's fields. `is_primary`/`is_signatory` badges must
   * always be read from `record` here — never from another slot's data —
   * so a card never shows a role that belongs to a different person.
   */
  const personCards = personCardLabels.map(
    (label, index) => {
      const record = contacts[index];

      if (!record) {
        return {
          id: null,
          label,
          name: null,
          title: null,
          phone: null,
          email: null,
          isPrimary: false,
          isSignatory: false,
        };
      }

      const isPrimary =
        record.is_primary === true;

      const isSignatory =
        record.is_signatory === true;

      return {
        id: record.id,
        label,
        name: [
          record.first_name,
          record.last_name,
        ]
          .filter(Boolean)
          .join(" "),
        title: record.title,
        phone: record.phone,
        email: record.email,
        isPrimary,
        isSignatory,
      };
    },
  );

  const [
    firstPersonCard,
    ...otherPersonCards
  ] = personCards;

  function handleOpenGeneralWorkspace() {
    if (contacts.length === 0) {
      navigate(getWorkspaceHref(currentCompanyId));
      return;
    }

    if (!selectedContactId) {
      showToast(
        "Çalışma alanını açmak için görüşülecek kişiyi seçin.",
        "error",
      );
      return;
    }

    navigate(
      `/call?companyId=${encodeURIComponent(currentCompanyId)}&contactId=${encodeURIComponent(selectedContactId)}`,
    );
  }

  // Sprint 25.1 / Adım 2 — opens the same Workspace as "Çalışma Alanını
  // Aç" above (same contact-selection guard, unchanged), plus the
  // openEmail/template intent CallWorkspacePage/CustomerWorkspace already
  // consume to auto-open the Workspace Email Panel once, pre-selected to
  // Information Package. No opportunity is required — the Workspace
  // itself never requires one (see CustomerWorkspace's draftOpportunity).
  function handleOpenWorkspaceEmail() {
    const emailIntentParams =
      "openEmail=true&template=Information%20Package";

    if (contacts.length === 0) {
      navigate(
        `/call?companyId=${encodeURIComponent(currentCompanyId)}&${emailIntentParams}`,
      );
      return;
    }

    if (!selectedContactId) {
      showToast(
        "Çalışma alanını açmak için görüşülecek kişiyi seçin.",
        "error",
      );
      return;
    }

    navigate(
      `/call?companyId=${encodeURIComponent(currentCompanyId)}&contactId=${encodeURIComponent(selectedContactId)}&${emailIntentParams}`,
    );
  }

  return (
    <main className="page company-detail-page">
      <CompanyHeader
        industry={stripLabelPrefix(
          company.industry,
        )}
        sectors={sectors}
        productGroups={productGroups}
        createdAt={formatDate(
          company.created_at,
        )}
        updatedAt={formatDate(
          company.updated_at,
        )}
        companyStatusLabel={companyStatusLabel}
        activeOpportunityCount={activeOpportunities.length}
        activeOpportunityLimit={MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY}
        country={stripLabelPrefix(
          company.country,
        )}
        phone={stripLabelPrefix(
          company.phone,
        )}
        email={stripLabelPrefix(
          company.email,
        )}
        website={stripLabelPrefix(
          company.website,
        )}
        taxOffice={stripLabelPrefix(
          company.tax_office,
        )}
        taxNumber={stripLabelPrefix(
          company.tax_number,
        )}
        postalCode={stripLabelPrefix(
          company.postal_code,
        )}
        address={stripLabelPrefix(
          company.address,
        )}
        city={stripLabelPrefix(
          company.city,
        )}
        district={stripLabelPrefix(
          company.district,
        )}
        editHref={editHref}
      />

      <div className="company-detail-scroll-area">
        <div className="company-record-columns">
          <section className="company-record-section company-record-main">
            <div className="section-head">
              <p className="eyebrow">
                Kişiler
              </p>
            </div>

            <div className="company-people-content">
              <div className="opportunity-list">
                <PersonContactCard
                  card={firstPersonCard}
                  linkHref={getWorkspaceHref(
                    company.id,
                    activeOpportunity?.id,
                  )}
                  linkTitle="Çalışma Alanını Aç"
                  nameFallback={contactName}
                  phoneFallback={company.phone}
                  emailFallback={company.email}
                  selected={firstPersonCard.id === selectedContactId}
                  onSelect={setSelectedContactId}
                />

                {otherPersonCards.map(
                  (contact) => (
                    <PersonContactCard
                      key={contact.label}
                      card={contact}
                      linkHref={editHref}
                      linkTitle="Kişi Bilgilerini Güncelle"
                      nameFallback={contact.label}
                      emptyStateHref={editHref}
                      selected={contact.id === selectedContactId}
                      onSelect={setSelectedContactId}
                    />
                  ),
                )}
              </div>

            </div>

          </section>

          <aside className="company-record-side">
            <section className="company-record-section company-record-side-section">
              <div className="section-head">
                <p className="eyebrow">
                  Firma Notu
                </p>
              </div>

              <Panel
                className="company-note-box company-note-box--interactive"
                role="button"
                tabIndex={0}
                onClick={() => setNotesModalOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setNotesModalOpen(true);
                  }
                }}
              >
                <p className="muted">
                  {permanentNote}
                </p>
              </Panel>
            </section>

            <section className="company-record-section company-record-side-section company-record-side-section--fill">
              <div className="section-head">
                <p className="eyebrow">
                  Fuar Dosyaları
                </p>
              </div>

              <div
                className="company-files-card-trigger"
                role="button"
                tabIndex={0}
                onClick={() => setFilesModalOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setFilesModalOpen(true);
                  }
                }}
              >
                <ExhibitionFileList
                  opportunities={sortedOpportunities}
                  exhibitionsById={exhibitionsById}
                  formatStage={(value) => getBusinessStatusLabel(value) ?? "—"}
                />
              </div>
            </section>
          </aside>
        </div>

        <section className="company-active-exhibitions" aria-labelledby="active-exhibitions-title">
          <div className="section-head">
            <p className="eyebrow" id="active-exhibitions-title">Aktif Fuarlar</p>
          </div>

          <div className="company-active-exhibition-grid">
            {activeOpportunities
              .slice(0, MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY)
              .map((opportunity) => {
                const exhibition = opportunity.exhibition_id
                  ? exhibitionsById.get(opportunity.exhibition_id)
                  : undefined;
                const snapshot = approvedPriceSnapshots.find(
                  (candidate) => candidate.opportunityId === opportunity.id,
                );
                const repositoryExhibition = snapshot
                  ? repositoryExhibitions.find(
                      (candidate) => candidate.id === snapshot.exhibitionId,
                    )
                  : undefined;
                const exhibitionName =
                  repositoryExhibition?.shortName?.trim() ||
                  snapshot?.exhibitionName?.trim() ||
                  exhibition?.name ||
                  "—";
                const dateLabel = exhibition?.start_date
                  ? new Date(exhibition.start_date).getFullYear().toString()
                  : "—";
                const total = opportunity.price_grand_total ?? opportunity.estimated_value;
                const relatedContact = opportunity.contact_id
                  ? contacts.find((contact) => contact.id === opportunity.contact_id)
                  : undefined;
                const relatedContactName = relatedContact
                  ? [relatedContact.first_name, relatedContact.last_name].filter(Boolean).join(" ").trim()
                  : "Belirtilmedi";

                // Sprint 25.1 — informational only. Opportunity cards are no
                // longer an entry point into the workspace (see
                // "Çalışma Alanını Aç" below, which opens the company
                // workspace directly); the sidebar's selected fuar is what
                // now drives the workspace's exhibition context.
                const nextActivity = opportunity.next_action
                  ? `${opportunity.next_action}${
                      opportunity.next_action_date
                        ? ` — ${formatDate(opportunity.next_action_date)}`
                        : ""
                    }`
                  : "—";

                return (
                  <Panel
                    className="company-active-exhibition-card"
                    key={opportunity.id}
                  >
                    <h2 title={exhibitionName}>{exhibitionName}</h2>
                    <div className="data-list">
                      <div><span>İlgili Kişi</span><strong>{relatedContactName || "Belirtilmedi"}</strong></div>
                      <div><span>Yıl</span><strong>{dateLabel}</strong></div>
                      <div><span>Aşama</span><strong>{getBusinessStatusLabel(opportunity.stage) ?? "—"}</strong></div>
                      <div><span>Stand</span><strong>{formatStandType(opportunity.price_stand_type)}</strong></div>
                      <div><span>Alan</span><strong>{opportunity.price_stand_area_sqm != null ? `${opportunity.price_stand_area_sqm} m²` : "—"}</strong></div>
                      <div><span>Toplam</span><strong>{total != null ? `${total.toLocaleString("tr-TR")} ${opportunity.price_currency ?? ""}`.trim() : "—"}</strong></div>
                      <div><span>Sonraki Aktivite</span><strong>{nextActivity}</strong></div>
                    </div>
                  </Panel>
                );
              })}

            {Array.from({
              length: Math.max(
                0,
                MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY - activeOpportunities.length,
              ),
            }).map((_, index) => (
              <Panel className="company-active-exhibition-card company-active-exhibition-card--add" key={`add-exhibition-${index}`}>
                <Link to={getWorkspaceHref(company.id)} className="company-active-exhibition-add">Fuar Ekle</Link>
              </Panel>
            ))}
          </div>

          <p
            className={`company-active-exhibition-limit ${
              activeOpportunities.length >= MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY
                ? ""
                : "company-active-exhibition-limit--hidden"
            }`}
          >
            Bu sürümde bir firma için en fazla 4 aktif fuar takibi yapılabilir.
          </p>
        </section>

        {historicalOpportunities.length > 0 ? (
          <section
            className="company-active-exhibitions"
            aria-labelledby="past-exhibitions-title"
          >
            <div className="section-head">
              <p className="eyebrow" id="past-exhibitions-title">
                Geçmiş Fırsatlar
              </p>
            </div>

            <div className="company-active-exhibition-grid">
              {historicalOpportunities.map((opportunity) => {
                const exhibition = opportunity.exhibition_id
                  ? exhibitionsById.get(opportunity.exhibition_id)
                  : undefined;
                const exhibitionName = exhibition?.name || "—";
                const total =
                  opportunity.price_grand_total ??
                  opportunity.estimated_value;
                const relatedContact = opportunity.contact_id
                  ? contacts.find(
                      (contact) => contact.id === opportunity.contact_id,
                    )
                  : undefined;
                const relatedContactName = relatedContact
                  ? [relatedContact.first_name, relatedContact.last_name]
                      .filter(Boolean)
                      .join(" ")
                      .trim()
                  : "Belirtilmedi";
                const lostReasonLabel =
                  opportunity.stage === "lost"
                    ? getLostReasonLabel(opportunity.closure_reason)
                    : undefined;

                return (
                  <Panel
                    className="company-active-exhibition-card"
                    key={opportunity.id}
                  >
                    <h2 title={exhibitionName}>{exhibitionName}</h2>
                    <div className="data-list">
                      <div>
                        <span>İlgili Kişi</span>
                        <strong>{relatedContactName || "Belirtilmedi"}</strong>
                      </div>
                      <div>
                        <span>Durum</span>
                        <strong>
                          {getBusinessStatusLabel(opportunity.stage) ?? "—"}
                        </strong>
                      </div>
                      <div>
                        <span>Kapanış Tarihi</span>
                        <strong>
                          {opportunity.closed_at
                            ? formatDate(opportunity.closed_at)
                            : "—"}
                        </strong>
                      </div>
                      {lostReasonLabel ? (
                        <div>
                          <span>Sebep</span>
                          <strong>{lostReasonLabel}</strong>
                        </div>
                      ) : null}
                      <div>
                        <span>Stand</span>
                        <strong>
                          {formatStandType(opportunity.price_stand_type)}
                        </strong>
                      </div>
                      <div>
                        <span>Toplam</span>
                        <strong>
                          {total != null
                            ? `${total.toLocaleString("tr-TR")} ${
                                opportunity.price_currency ?? ""
                              }`.trim()
                            : "—"}
                        </strong>
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        ) : null}

        {archivedContracts.length > 0 ? (
          <section
            className="company-active-exhibitions"
            aria-labelledby="company-archive-title"
          >
            <div className="section-head">
              <p className="eyebrow" id="company-archive-title">
                Firma Arşivi
              </p>
            </div>

            <div className="company-active-exhibition-grid">
              {archivedContracts.map((document) => {
                const exhibition = document.exhibitionId
                  ? exhibitionsById.get(document.exhibitionId)
                  : undefined;
                const exhibitionName = exhibition?.name || "—";

                return (
                  <Panel
                    className="company-active-exhibition-card"
                    key={document.id}
                  >
                    <h2 title={document.contractNumber}>
                      {document.contractNumber}
                    </h2>
                    <div className="data-list">
                      <div>
                        <span>Fuar</span>
                        <strong>{exhibitionName}</strong>
                      </div>
                      <div>
                        <span>Belge</span>
                        <strong>
                          {document.signedPdfFileName ??
                            document.fileName}
                        </strong>
                      </div>
                      <div>
                        <span>Arşivlenme Tarihi</span>
                        <strong>
                          {document.archivedToCompanyArchiveAt
                            ? formatDate(
                                document.archivedToCompanyArchiveAt,
                              )
                            : "—"}
                        </strong>
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <section className="company-workspace-transition">
        <button
          type="button"
          className="btn btn-primary company-workspace-cta-btn"
          onClick={handleOpenGeneralWorkspace}
        >
          Çalışma Alanını Aç
        </button>

        <button
          type="button"
          className="btn company-workspace-cta-btn"
          onClick={handleOpenWorkspaceEmail}
        >
          E-posta Gönder
        </button>

        <div className="company-record-metadata" aria-label="Kayıt bilgileri">
          <div><span>İlk Kayıt:</span><strong title={formatDate(company.created_at)}>{formatDate(company.created_at)}</strong><span>Kaydı Yapan:</span><strong title="—">—</strong></div>
          <div><span>Son Güncelleme:</span><strong title={formatDate(company.updated_at)}>{formatDate(company.updated_at)}</strong><span>Güncelleyen:</span><strong title="—">—</strong></div>
        </div>
      </section>

      {notesModalOpen ? (
        <CompanyDetailModal
          title="Firma Notu"
          onClose={() => {
            setNotesModalOpen(false);
            setEditingNote(false);
            setNoteDraft(permanentNote);
          }}
          footer={editingNote ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditingNote(false); setNoteDraft(permanentNote); }}>İptal</button>
              <button type="button" className="btn btn-primary" onClick={() => {
                const nextNote = noteDraft.trim();
                const temporaryNote = nextNote || placeholderPermanentNote;
                setPermanentNote(temporaryNote);
                setNoteDraft(temporaryNote);
                setEditingNote(false);
              }}>Kaydet</button>
            </>
          ) : <button type="button" className="btn btn-primary" onClick={() => setEditingNote(true)}>Düzenle</button>}
        >
          {editingNote ? (
            <textarea className="company-note-editor" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} autoFocus />
          ) : <p className="company-note-full-text">{permanentNote}</p>}
        </CompanyDetailModal>
      ) : null}

      {filesModalOpen ? (
        <CompanyDetailModal title="Fuar Dosyaları" onClose={() => setFilesModalOpen(false)}>
          <div className="company-files-placeholder">
            <p className="eyebrow">Fuar Klasörleri</p>
            <h3>Henüz klasör yok</h3>
            <p className="muted">Bu alan gelecek sprintte sözleşmeler, stand tasarımları, fotoğraflar ve diğer belgeleri içerecek.</p>
          </div>
        </CompanyDetailModal>
      ) : null}
    </main>
  );
}
