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
import { CloseOpportunityModal } from "../call-workspace/components/CloseOpportunityModal";
import { loadApprovedPriceSnapshots } from "../call-workspace/pricing/services/approvedPriceSnapshotStorage";
import { loadGeneratedDocuments } from "../document-engine/services/generatedDocumentStorage";
import type { GeneratedDocumentRecord } from "../document-engine/models/GeneratedDocumentRecord";
import { getCompanyProductGroups } from "../../services/supabase/productGroupService";
import { getCompanySectors } from "../../services/supabase/sectorService";
import { updateOpportunity } from "../../services/supabase/opportunityService";
import { createTimelineEvent } from "../../services/supabase/timelineService";
import { completeOpenRemindersForOpportunity } from "../../services/supabase/reminderService";
import {
  getBusinessStatusLabel,
  isTerminalBusinessStatus,
  MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY,
  resolveCompanyStatus,
} from "../../types/businessStatus";
import {
  buildLostTimelineDescription,
  type LostReasonId,
} from "../../types/opportunityClosure";

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

type GeneratedDocumentRecordCardProps = {
  document: GeneratedDocumentRecord;
  exhibitionsById: Map<string, { name?: string | null }>;
  formatDate: (value?: string | null) => string;
};

// Belge Yaşam Döngüsü — one shared card for both "Teklifler" and
// "Sözleşmeler" modals: both now list the exact same record type
// (GeneratedDocumentRecord), only filtered differently by
// record.status. Kept as a single render so the two lists can never
// visually drift apart.
function GeneratedDocumentRecordCard({
  document,
  exhibitionsById,
  formatDate,
}: GeneratedDocumentRecordCardProps) {
  const exhibition = document.exhibitionId
    ? exhibitionsById.get(document.exhibitionId)
    : undefined;
  const openablePdfUrl =
    document.signedPdfDataUrl ??
    document.pdfDataUrl ??
    null;

  return (
    <Panel
      className="company-history-record"
    >
      <h3 title={document.contractNumber}>
        {document.contractNumber}{" "}
        <span className="company-history-record-version">
          v{document.version}
        </span>
      </h3>
      <div className="data-list">
        <div>
          <span>Fuar</span>
          <strong>{exhibition?.name ?? "—"}</strong>
        </div>
        <div>
          <span>Belge</span>
          <strong>
            {document.signedPdfFileName ??
              document.fileName}
          </strong>
        </div>
        <div>
          <span>Oluşturulma</span>
          <strong>
            {formatDate(document.createdAt)}
          </strong>
        </div>
        <div>
          <span>Durum</span>
          <strong>
            {document.status === "signed"
              ? "İmzalandı"
              : document.status ===
                  "sent-for-signature"
                ? "İmzaya Gönderildi"
                : "PDF Oluşturuldu"}
          </strong>
        </div>
      </div>

      {openablePdfUrl ? (
        <a
          className="company-history-record-pdf-link"
          href={openablePdfUrl}
          target="_blank"
          rel="noreferrer"
        >
          PDF'i Aç
        </a>
      ) : null}
    </Panel>
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
    refresh,
    reminders,
  } = useCompanyWorkspace(id);

  // Kritik Akış Düzeltmesi 3 — "❌ İptal" on an active fuar card opens
  // the existing Katılım Nedeni (Lost reason) modal directly against
  // that one opportunity, without requiring a Workspace visit. Mirrors
  // CustomerWorkspace.closeOpportunityAsLost's own write (stage/
  // closed_at/closure_reason/closure_note + one timeline event) — same
  // fields, same timeline wording — just triggered from here instead.
  const [
    cancellingOpportunityId,
    setCancellingOpportunityId,
  ] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] =
    useState(false);

  async function handleCancelOpportunity(
    reasonId: LostReasonId,
    note: string | null,
  ): Promise<void> {
    if (!cancellingOpportunityId || !company) {
      return;
    }

    setCancelSubmitting(true);

    try {
      await updateOpportunity(
        cancellingOpportunityId,
        {
          stage: "lost",
          closed_at: new Date().toISOString(),
          closure_reason: reasonId,
          closure_note:
            reasonId === "other" ? note : null,
        },
      );

      await createTimelineEvent({
        company_id: company.id,
        opportunity_id: cancellingOpportunityId,
        type: "opportunity-lost",
        title: "Fırsat kaybedildi",
        description: buildLostTimelineDescription({
          reasonId,
          note,
        }),
      });

      // Kritik Akış Düzeltmesi 5 — same shared close-out
      // CustomerWorkspace's Kaybedildi/Kazanıldı/İmzalar Tamamlandı
      // flows use, so "İptal" here produces the exact same Today
      // behavior: this opportunity's own open reminders (and only
      // those) are marked completed. Isolated in its own try/catch so a
      // failure here never turns an otherwise-successful cancellation
      // into a reported error.
      try {
        await completeOpenRemindersForOpportunity(
          reminders,
          cancellingOpportunityId,
        );
      } catch (reminderError) {
        console.error(
          "Opportunity reminder close-out error:",
          reminderError,
        );
      }

      await refresh();

      setCancellingOpportunityId(null);
      showToast(
        "Fırsat iptal edildi ve arşive taşındı.",
        "success",
      );
    } catch (cancelError) {
      console.error(
        "Opportunity cancel error:",
        cancelError,
      );

      showToast(
        "Fırsat iptal edilemedi. Lütfen tekrar deneyin.",
        "error",
      );
    } finally {
      setCancelSubmitting(false);
    }
  }

  const approvedPriceSnapshots = useMemo(
    () =>
      company?.id
        ? Object.values(
            loadApprovedPriceSnapshots(company.id),
          )
        : [],
    [company?.id],
  );

  // Sprint 25.11 / Adım 1 — Katılım Geçmişi → "Teklifler"/"Sözleşmeler"
  // folders. Every generated contract record for this company (any
  // version) — read-only, this page never writes to generatedDocuments.
  // Newest first.
  const allGeneratedDocuments = useMemo(
    () =>
      company?.id
        ? [...loadGeneratedDocuments(company.id)].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          )
        : [],
    [company?.id],
  );

  // Belge Yaşam Döngüsü sadeleştirmesi — hangi buton/ekrandan üretildiği
  // artık ayrım kriteri değil: imzalanana kadar üretilen HER PDF
  // (ilk teklif, revize teklif, "Sözleşme Hazırla" ile üretilen her
  // versiyon, imzaya gönderilen son PDF) "Teklifler"dedir.
  // record.status === "signed" (yalnızca "🟢 Katılım Onaylandı" ile
  // imzalı PDF yüklendiğinde yazılır — CustomerWorkspace.
  // handleSignedPdfUploaded) tek ayrım kriteridir; "Sözleşmeler" yalnızca
  // bu durumdaki kayıtları gösterir.
  const unsignedGeneratedDocuments = useMemo(
    () =>
      allGeneratedDocuments.filter(
        (document) => document.status !== "signed",
      ),
    [allGeneratedDocuments],
  );

  const signedGeneratedDocuments = useMemo(
    () =>
      allGeneratedDocuments.filter(
        (document) => document.status === "signed",
      ),
    [allGeneratedDocuments],
  );

  const activeOpportunities =
    sortedOpportunities.filter(
      (opportunity) =>
        !isTerminalBusinessStatus(
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
  // Sprint 25.11 / Adım 1 — Katılım Geçmişi's two folders. No documents
  // are listed inline on the main page anymore; each folder opens this
  // same CompanyDetailModal shell with the existing records.
  const [proposalsModalOpen, setProposalsModalOpen] = useState(false);
  const [contractsModalOpen, setContractsModalOpen] = useState(false);
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
                {/* Kritik Akış Düzeltmesi (Adım 1.1) — ExhibitionFileList
                    itself renders one open-able card per TERMINAL
                    opportunity; it must never render inline on the main
                    page (that is exactly the "geçmiş kart ana sayfada
                    açık görünüyor" regression). It now renders only
                    inside filesModalOpen below — this trigger is a
                    plain, static opener, same shape as the Katılım
                    Geçmişi folders. */}
                <span
                  className="company-files-card-trigger-icon"
                  aria-hidden="true"
                >
                  📁
                </span>
                <span className="muted">
                  Kayıtlı fuar dosyalarını görüntülemek için tıklayın.
                </span>
              </div>
            </section>
          </aside>
        </div>

        {/* Sprint 25.11 / Adım 1.1 — .company-active-exhibitions was
            hard-pinned to a single grid cell (grid-column:2; grid-row:1)
            back when only "Aktif Fuarlar" ever used that class. Once a
            second section ("Katılım Geçmişi") reused the same class,
            both landed in the exact same cell and rendered on top of
            each other — the reported header/card overlap. This wrapper
            owns that grid cell instead and stacks its children
            (flex column), so any number of sections here lay out one
            below the other, never overlapping. */}
        <div className="company-active-exhibitions-column">
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
                    className="company-active-exhibition-card company-active-exhibition-card--cancellable"
                    key={opportunity.id}
                  >
                    <button
                      type="button"
                      className="company-active-exhibition-cancel-btn"
                      title="Fırsatı İptal Et"
                      aria-label={`${exhibitionName} fırsatını iptal et`}
                      onClick={() =>
                        setCancellingOpportunityId(
                          opportunity.id,
                        )
                      }
                    >
                      ❌ İptal
                    </button>
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

        <section
          className="company-active-exhibitions"
          aria-labelledby="participation-history-title"
        >
          <div className="section-head">
            <p
              className="eyebrow"
              id="participation-history-title"
            >
              Katılım Geçmişi
            </p>
          </div>

          <div className="company-history-folder-grid">
            <button
              type="button"
              className="company-history-folder"
              onClick={() =>
                setProposalsModalOpen(true)
              }
            >
              <span
                className="company-history-folder-icon"
                aria-hidden="true"
              >
                📁
              </span>
              Teklifler
              <span className="company-history-folder-count">
                {unsignedGeneratedDocuments.length}
              </span>
            </button>

            <button
              type="button"
              className="company-history-folder"
              onClick={() =>
                setContractsModalOpen(true)
              }
            >
              <span
                className="company-history-folder-icon"
                aria-hidden="true"
              >
                📁
              </span>
              Sözleşmeler
              <span className="company-history-folder-count">
                {signedGeneratedDocuments.length}
              </span>
            </button>
          </div>
        </section>
        </div>
      </div>

      <section className="company-workspace-transition">
        <button
          type="button"
          className="btn btn-primary company-workspace-cta-btn"
          onClick={handleOpenGeneralWorkspace}
        >
          Çalışma Alanını Aç
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
          <ExhibitionFileList
            opportunities={sortedOpportunities}
            exhibitionsById={exhibitionsById}
          />
        </CompanyDetailModal>
      ) : null}

      {cancellingOpportunityId ? (
        <CloseOpportunityModal
          initialStep="lost-reason"
          submitting={cancelSubmitting}
          onClose={() => {
            if (!cancelSubmitting) {
              setCancellingOpportunityId(null);
            }
          }}
          onContinue={() =>
            setCancellingOpportunityId(null)
          }
          onConfirmWon={() =>
            setCancellingOpportunityId(null)
          }
          onConfirmLost={(reasonId, note) =>
            void handleCancelOpportunity(
              reasonId,
              note,
            )
          }
        />
      ) : null}

      {proposalsModalOpen ? (
        <CompanyDetailModal
          title="Teklifler"
          onClose={() =>
            setProposalsModalOpen(false)
          }
        >
          {unsignedGeneratedDocuments.length ===
          0 ? (
            <p className="muted">
              Henüz oluşturulmuş bir teklif yok.
            </p>
          ) : (
            <div className="company-history-record-list">
              {unsignedGeneratedDocuments.map(
                (document) => (
                  <GeneratedDocumentRecordCard
                    key={document.id}
                    document={document}
                    exhibitionsById={
                      exhibitionsById
                    }
                    formatDate={formatDate}
                  />
                ),
              )}
            </div>
          )}
        </CompanyDetailModal>
      ) : null}

      {contractsModalOpen ? (
        <CompanyDetailModal
          title="Sözleşmeler"
          onClose={() =>
            setContractsModalOpen(false)
          }
        >
          {signedGeneratedDocuments.length ===
          0 ? (
            <p className="muted">
              Henüz imzalanmış bir sözleşme yok.
            </p>
          ) : (
            <div className="company-history-record-list">
              {signedGeneratedDocuments.map(
                (document) => (
                  <GeneratedDocumentRecordCard
                    key={document.id}
                    document={document}
                    exhibitionsById={
                      exhibitionsById
                    }
                    formatDate={formatDate}
                  />
                ),
              )}
            </div>
          )}
        </CompanyDetailModal>
      ) : null}
    </main>
  );
}
