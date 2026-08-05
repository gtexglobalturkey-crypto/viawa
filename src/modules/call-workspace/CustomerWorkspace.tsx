import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import { useAuth } from "../../features/auth/AuthContext";
import {
  executeAction,
} from "../../features/execution";
import {
  createCallNote,
} from "../../services/supabase/noteService";
import {
  ACTIVE_OPPORTUNITY_LIMIT_ERROR_CODE,
  createOpportunity,
  getOpportunitiesByCompany,
  getOpportunity,
  updateOpportunity,
} from "../../services/supabase/opportunityService";
import {
  getApprovedPriceSnapshot,
  saveApprovedPriceSnapshot,
} from "../../services/supabase/documentProviderService";
import {
  canCloseOpportunity,
  getBusinessStatusLabel,
  isForwardStageTransition,
  MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY,
} from "../../types/businessStatus";
import {
  buildLostTimelineDescription,
} from "../../types/opportunityClosure";
import type { LostReasonId } from "../../types/opportunityClosure";
import type { OpportunityStage } from "../../types/salesAction";
import {
  createActiveReminderIfAbsent,
  completeOpenRemindersForOpportunity as completeOpenRemindersForOpportunityInStorage,
  updateReminder,
} from "../../services/supabase/reminderService";
import {
  createTimelineEvent,
  getTimelineEventsByCompany,
} from "../../services/supabase/timelineService";
import type {
  AiMemory,
  CallNote,
  Company,
  Contact,
  EmailRecord,
  Exhibition,
  Opportunity,
  OpportunityPaymentPlanItem,
  OpportunityStandMaterial,
  Reminder,
  TimelineEvent,
} from "../../types/database";
import {
  getWorkspaceFollowUpActionLabel,
  resolveWorkspaceFollowUpExecutionActionId,
} from "../../types/workspaceFollowUpAction";

import { ExhibitionWorkspace } from "../exhibitions/components/ExhibitionWorkspace";
import { useExhibitionSelection } from "../exhibitions/context/ExhibitionSelectionContext";
import type { SelectedExhibitionDocument } from "../exhibitions/models/SelectedExhibitionDocument";

import { CloseOpportunityModal } from "./components/CloseOpportunityModal";
import { LiveInteraction } from "./components/LiveInteraction";
import type { ManualFollowUpSelection } from "./components/LiveInteraction";
import { TimelinePanel } from "./components/TimelinePanel";
import { WorkspaceEmailPanel } from "./components/WorkspaceEmailPanel";
import { ContractTemplateModal } from "./contract-tool";
import { DocumentBasketModal } from "./document-basket";
import type {
  DocumentBasketItem,
  DocumentBasketRole,
} from "./document-basket";
import {
  decideOpportunityCommitAction,
  resolveSessionOpportunity,
  selectOpportunityForExhibition,
} from "./models/exhibitionOpportunityMatch";
import {
  getSessionDraft,
  migrateNoExhibitionDraft,
  withSessionDraft,
  withSessionDraftCleared,
} from "./models/exhibitionSessionDraft";
import type {
  ExhibitionSessionDraft,
  ExhibitionSessionStore,
} from "./models/exhibitionSessionDraft";
import {
  createEmptyWorkspaceEmailDraft,
  formatWorkspaceEmailEventSummary,
  unlinkedMailEvents,
  withMailEventAppended,
  withMailEventsLinked,
} from "./models/exhibitionSessionMail";
import type {
  QuotationPriceSource,
  WorkspaceEmailEvent,
} from "./models/exhibitionSessionMail";
import type { SalesToolId } from "./models/salesTools";
import { formatWorkspaceDate } from "./models/workspaceFormatters";
import { createCallWorkspaceViewModel } from "./models/workspaceMapper";
import type { PriceCalculatedMeta } from "./pricing/components/PriceCalculatorModal";
import {
  approvedPriceKey,
} from "./pricing/models/ApprovedPriceSnapshot";
import type { ApprovedPriceSnapshot } from "./pricing/models/ApprovedPriceSnapshot";
import type { PriceResult } from "./pricing/models/PriceResult";
import {
  loadApprovedPriceSnapshots,
  saveApprovedPriceSnapshots,
} from "./pricing/services/approvedPriceSnapshotStorage";
import { commitApprovedPrice } from "./pricing/services/commitApprovedPrice";
import { reconcileApprovedPrice } from "./pricing/services/reconcileApprovedPrice";
import { ProposalPreviewModal } from "./proposal/components/ProposalPreviewModal";
import { buildContractDraft } from "./proposal/engine/buildContractDraft";
import { runProposalEngine } from "./proposal/engine/proposalEngine";
import type { ContractDraftData } from "./proposal/models/ContractDraftData";
import type { ProposalInput } from "./proposal/models/ProposalInput";
import type { ProposalResult } from "./proposal/models/ProposalResult";

import {
  ContractPreviewModal,
} from "../document-engine";
import type {
  GeneratedDocumentRecord,
} from "../document-engine";
import { ParticipationConfirmedModal } from "../document-engine/components/ParticipationConfirmedModal";
import { selectLatestUnsignedDocument } from "../document-engine/engine/selectLatestUnsignedDocument";
import {
  loadGeneratedDocuments,
  saveGeneratedDocuments,
} from "../document-engine";
import {
  MissingAuthSessionError,
  sendForSignature,
} from "../document-engine/services/dropboxSignService";
import {
  describeContractPdfFailure,
  readBlobAsDataUrl,
  requestContractPdf,
} from "../document-engine/services/contractPdfService";
import {
  buildContractPdfStoragePath,
  computeContractPdfDocumentRecordId,
} from "../document-engine/engine/contractPdfStorageIdentity";

// BUG-S26.2.8 — TEMPORARY DIAGNOSTIC helper: a safe, secret/PDF-content-free
// summary of one GeneratedDocumentRecord for console logging. Never
// includes pdfDataUrl/signedPdfDataUrl content or storagePath/
// signatureRequestId values themselves — only whether they're present.
function summarizeGeneratedDocumentForDiagnostics(
  record: GeneratedDocumentRecord,
) {
  return {
    id: record.id,
    documentType: record.documentType,
    status: record.status,
    companyId: record.companyId,
    opportunityId:
      record.opportunityId ?? null,
    exhibitionId: record.exhibitionId,
    contractNumber: record.contractNumber,
    version: record.version,
    fileName: record.fileName,
    storageBucket:
      record.storageBucket ?? null,
    hasStoragePath: Boolean(
      record.storagePath,
    ),
    hasPdfDataUrl: Boolean(
      record.pdfDataUrl,
    ),
    createdAt: record.createdAt,
    hasSignatureRequestId: Boolean(
      record.signatureRequestId,
    ),
  };
}

const DEFAULT_PROPOSAL_PAYMENT_TERMS =
  "Payment terms to be confirmed between EREXPO and the participating company.";

function getProposalValidityDate(): string {
  const validityDate = new Date();

  validityDate.setDate(
    validityDate.getDate() + 30,
  );

  return validityDate.toISOString();
}

const ENABLED_SALES_TOOL_IDS = [
  "quotation",
  "contract-template",
  "document-basket",
  "email",
] as const satisfies readonly SalesToolId[];

// Sprint 25.2 — shown when an action that needs a real, persisted
// opportunity (creating one on demand via ensureActiveOpportunity below)
// hits the BUG-S25-001 cap. Same message/behavior the old
// handleCreateContextOpportunity used before Sprint 25.1 removed it.
const ACTIVE_OPPORTUNITY_LIMIT_TOAST_MESSAGE = `Bu firma için en fazla ${MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY} aktif fırsat oluşturabilirsiniz. Yeni bir fırsat eklemek için mevcut aktif fırsatlardan birini tamamlayın veya kayıp olarak kapatın.`;

// Sprint 25.2 — Approved Price Snapshot (and therefore contract prep)
// genuinely requires a real, persisted opportunity id — that dependency
// is real (Document Engine untouched, not worked around). Shown as the
// disabled "Sözleşme Hazırla" button's tooltip while no real opportunity
// exists yet for the selected fuar.
const QUOTATION_DISABLED_DRAFT_MESSAGE =
  "Sözleşme hazırlamak için önce görüşmeyi tamamlayarak fırsatı kaydedin.";

// Sprint 25.2.1 — shown on every fuar-dependent tool (fiyat hesaplama,
// sözleşme, kroki/fuar takvimi) while no fuar is selected at all. Company,
// contact and general note-taking stay usable regardless — only these are
// gated.
const FUAR_REQUIRED_DISABLED_MESSAGE =
  "Devam etmek için sidebar'dan bir fuar seçin.";

// Sprint 25.2 — a stand-in used ONLY to build the view model
// (createCallWorkspaceViewModel) and for read-only display before any
// opportunity actually exists for the selected fuar. Never sent to
// Supabase directly — every write path (ensureActiveOpportunity) checks
// for this id and creates/resolves a real opportunity first.
const DRAFT_OPPORTUNITY_ID = "__draft__";

function buildDraftOpportunity(input: {
  companyId: string;
  exhibitionId: string | null;
  contactId: string | null;
  ownerId: string | null;
}): Opportunity {
  const now = new Date().toISOString();

  return {
    id: DRAFT_OPPORTUNITY_ID,
    company_id: input.companyId,
    exhibition_id: input.exhibitionId,
    contact_id: input.contactId,
    stage: "new",
    interest_level: 0,
    estimated_value: 0,
    next_action: null,
    next_action_date: null,
    owner: input.ownerId,
    created_at: now,
    updated_at: now,
  };
}

export type CustomerWorkspaceProps = {
  company: Company;
  opportunities: Opportunity[];
  timeline: TimelineEvent[];
  reminders: Reminder[];
  emails: EmailRecord[];
  callNotes: CallNote[];
  aiMemory: AiMemory | null;
  exhibitions: Exhibition[];
  contacts: Contact[];
  initialContactId?: string | null;
  /**
   * Sprint 25.1 / Adım 2 — set once by CallWorkspacePage from the
   * `openEmail` query param (Company Detail's "E-posta Gönder" button).
   * Consumed exactly once, on mount — see the effect below.
   */
  initialOpenEmailPanel?: boolean;
  /** Same origin as initialOpenEmailPanel — the `template` query param. */
  initialEmailPanelTemplateId?: string | null;
  /**
   * Sprint 25.1 / Adım 3 — the `opportunityId` query param, set by a
   * Today task link (Send Quotation, Follow-up Quotation/Contract).
   * Consumed once, on mount, only to pre-select that opportunity's fuar
   * in the sidebar when none is selected yet — see the effect below.
   * Never overrides an already-selected fuar, never creates/selects an
   * opportunity by itself (that's still entirely
   * resolveSessionOpportunity's job, unchanged).
   */
  initialOpportunityId?: string | null;
  onRefresh: () => Promise<void>;
};

export function CustomerWorkspace({
  company,
  opportunities,
  timeline,
  reminders,
  emails,
  callNotes,
  aiMemory,
  exhibitions,
  contacts,
  initialContactId,
  initialOpenEmailPanel,
  initialEmailPanelTemplateId,
  initialOpportunityId,
  onRefresh,
}: CustomerWorkspaceProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, session } = useAuth();
  const { showToast } = useToast();

  // Sidebar "Fuarlar" selection (Exhibition Workspace) — a separate
  // concept from selectedExhibitionId above, which picks among this
  // company's own real exhibitions for pricing/proposal purposes.
  const {
    exhibitions: sidebarExhibitions,
    selectedExhibitionId: selectedSidebarExhibitionId,
    setSelectedExhibitionId: setSelectedSidebarExhibitionId,
  } = useExhibitionSelection();

  const selectedSidebarExhibition =
    sidebarExhibitions.find(
      (candidate) =>
        candidate.id ===
        selectedSidebarExhibitionId,
    ) ?? null;

  // Mirrors ExhibitionWorkspace's own checkbox state (lifted via callback,
  // not owned here) so the "E-posta" tool below can read it. Remounting
  // ExhibitionWorkspace with a new `key` on exhibition change fires this
  // callback with an empty array again, so switching fuars can't leak a
  // previous fuar's selections into this state.
  const [
    exhibitionSelectedDocuments,
    setExhibitionSelectedDocuments,
  ] = useState<
    SelectedExhibitionDocument[]
  >([]);

  const [
    noteSaving,
    setNoteSaving,
  ] = useState(false);

  const [
    followUpSaving,
    setFollowUpSaving,
  ] = useState(false);

  // Keyed by opportunityId+exhibitionId (approvedPriceKey) rather than a
  // single slot — switching the sidebar fuar or the active opportunity
  // must never surface a different pair's approved price. Backed by a
  // TEMPORARY localStorage repository (no Supabase table/migration this
  // sprint) so it survives a page reload — see
  // pricing/services/approvedPriceSnapshotStorage.ts. Lazily initialized
  // from that store; CallWorkspacePage keys this whole component by
  // company.id so switching companies always re-runs this initializer
  // for the new company instead of carrying over stale data.
  const [
    approvedPrices,
    setApprovedPrices,
  ] = useState<
    Record<string, ApprovedPriceSnapshot>
  >(() =>
    loadApprovedPriceSnapshots(company.id),
  );

  useEffect(() => {
    saveApprovedPriceSnapshots(
      company.id,
      approvedPrices,
    );
  }, [company.id, approvedPrices]);

  // Sprint 25.3 — every fuar the workspace has touched keeps its own
  // independent Exhibition Session draft (note, price, next activity —
  // see models/exhibitionSessionDraft.ts). None of it is ever sent to
  // Supabase automatically; only commitWorkspaceSession's "Görüşmeyi
  // Tamamla" path applies a session's draft for real, and only then
  // clears that one session — every other fuar's draft is left alone.
  const [
    exhibitionSessions,
    setExhibitionSessions,
  ] = useState<ExhibitionSessionStore>({});

  // One-time carry-forward: a general note written before any fuar was
  // selected (NO_EXHIBITION_SESSION_KEY) moves into the newly selected
  // fuar's session the first time it's picked, so it isn't stranded —
  // see Sprint 25.2.1's "genel not kaybolmasın" requirement. A fuar that
  // already has its own session is never touched by this.
  useEffect(() => {
    setExhibitionSessions((current) =>
      migrateNoExhibitionDraft(
        current,
        selectedSidebarExhibitionId,
      ),
    );
  }, [selectedSidebarExhibitionId]);

  const activeSessionDraft = useMemo(
    () =>
      getSessionDraft(
        exhibitionSessions,
        selectedSidebarExhibitionId,
      ),
    [
      exhibitionSessions,
      selectedSidebarExhibitionId,
    ],
  );

  const draftPriceResult =
    activeSessionDraft.priceResult;
  const draftNextActivity =
    activeSessionDraft.nextActivity;

  // Sprint 25.4B — generalized so the Workspace Email Panel can patch
  // whichever fuar it's locked to (panelSessionExhibitionId), which may
  // differ from the sidebar's live selection — see Section E.
  function updateSessionDraftFor(
    exhibitionId: string | null,
    patch: Partial<ExhibitionSessionDraft>,
  ) {
    setExhibitionSessions((current) =>
      withSessionDraft(
        current,
        exhibitionId,
        patch,
      ),
    );
  }

  function updateActiveSessionDraft(
    patch: Partial<ExhibitionSessionDraft>,
  ) {
    updateSessionDraftFor(
      selectedSidebarExhibitionId,
      patch,
    );
  }

  const [
    proposalPreview,
    setProposalPreview,
  ] =
    useState<ProposalResult | null>(
      null,
    );

  const [
    contractDraft,
    setContractDraft,
  ] =
    useState<ContractDraftData | null>(
      null,
    );

  // The exact ApprovedPriceSnapshot contractDraft was built from — kept
  // alongside it since ContractDraftData itself doesn't carry
  // pricingSource/pricingSourceVersion, which the Document Engine needs.
  const [
    contractDraftSnapshot,
    setContractDraftSnapshot,
  ] =
    useState<ApprovedPriceSnapshot | null>(
      null,
    );

  const [
    isProposalPreviewOpen,
    setIsProposalPreviewOpen,
  ] = useState(false);

  const [
    isContractPreviewOpen,
    setIsContractPreviewOpen,
  ] = useState(false);

  // Immutable, versioned record of every PDF the user actually confirmed
  // saving (see the print-confirmation flow below) — backed by the same
  // kind of TEMPORARY localStorage repository as approvedPrices (see
  // document-engine/services/generatedDocumentStorage.ts), so contract
  // numbers and version history survive a page reload.
  const [
    generatedDocuments,
    setGeneratedDocuments,
  ] = useState<
    GeneratedDocumentRecord[]
  >(() => loadGeneratedDocuments(company.id));

  useEffect(() => {
    saveGeneratedDocuments(
      company.id,
      generatedDocuments,
    );
  }, [company.id, generatedDocuments]);

  // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC: fires on every commit where
  // generatedDocuments actually changed (including any change caused
  // indirectly by onRefresh/a remount), so this catches a later
  // overwrite/reset even if it doesn't happen at a call site we already
  // log explicitly.
  useEffect(() => {
    console.error(
      "[BUG-S26.2.8] GENERATED DOCUMENTS STATE",
      {
        companyId: company.id,
        count: generatedDocuments.length,
        records: generatedDocuments.map(
          summarizeGeneratedDocumentForDiagnostics,
        ),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedDocuments]);

  // SPRINT 26.2 — no standalone "İmzaya Gönder" button exists anywhere
  // in the workspace (the "Belge ve İmza Durumu" card was intentionally
  // removed in Sprint 26.1 and must not come back); the one and only
  // trigger is Workspace Email's "Sözleşme Gönder" (see
  // handleWorkspaceEmailEvent). Guards against a double sendForSignature
  // call firing two in-flight requests (and therefore two timeline
  // entries) for the same document.
  const [
    sendingSignatureIds,
    setSendingSignatureIds,
  ] = useState<Set<string>>(
    new Set(),
  );

  // Incremented to force-open the Price Calculator from outside
  // LiveInteraction (e.g. when "Sözleşme Hazırla" is pressed with no
  // approved price yet) — LiveInteraction owns the modal's open state
  // itself and just watches this counter change.
  const [
    priceCalculatorOpenRequestId,
    setPriceCalculatorOpenRequestId,
  ] = useState(0);

  const [
    isDocumentBasketOpen,
    setIsDocumentBasketOpen,
  ] = useState(false);

  const [
    isContractTemplateOpen,
    setIsContractTemplateOpen,
  ] = useState(false);

  // Sprint 25.4B — Workspace Email Panel. panelSessionExhibitionId is
  // captured once when the panel opens (Section E "Panel Kilidi") and
  // stays fixed for the panel's whole lifetime, even if the sidebar's own
  // fuar selection changes while the panel is still open.
  const [
    isEmailPanelOpen,
    setIsEmailPanelOpen,
  ] = useState(false);

  const [
    panelSessionExhibitionId,
    setPanelSessionExhibitionId,
  ] = useState<string | null>(null);

  const [
    emailPanelRequestedTemplateId,
    setEmailPanelRequestedTemplateId,
  ] = useState<string | null>(null);

  // Section E — "Firma veya contact bağlamı route nedeniyle tamamen
  // değişirse panel güvenli şekilde kapansın." Company changes already
  // force a full remount (CallWorkspacePage keys CustomerWorkspace by
  // company.id), which resets all of this for free; contact changes do
  // not remount (initialContactId is just a prop update), so this closes
  // the panel explicitly whenever it changes.
  useEffect(() => {
    setIsEmailPanelOpen(false);
    setPanelSessionExhibitionId(null);
    setEmailPanelRequestedTemplateId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContactId]);

  // BUG-S26-003 — "Görüşme Sonucu" is now the last step of "Görüşmeyi
  // Tamamla" itself (the standalone "Fırsatı Kapat" button is gone).
  // isCloseOpportunityModalOpen/closingOpportunity are the same state
  // Sprint 25.5 introduced, reused as-is; pendingSessionCompletion is new
  // — it holds the note/nextAction the user already wrote, captured the
  // moment "Görüşmeyi Tamamla" is clicked, so whichever outcome the user
  // picks in the modal can still commit it (the Commit Engine itself is
  // untouched — see commitWorkspaceSession below).
  const [
    isCloseOpportunityModalOpen,
    setIsCloseOpportunityModalOpen,
  ] = useState(false);

  const [
    closingOpportunity,
    setClosingOpportunity,
  ] = useState(false);

  const [
    pendingSessionCompletion,
    setPendingSessionCompletion,
  ] = useState<{
    note: string;
    nextAction: string;
  } | null>(null);

  // RC-01 — "Katılım Onaylandı" modalının tek, paylaşılan durumu.
  // Hem "Sözleşme Hazırla" (ContractPreviewModal'daki "🟢 Katılım
  // Onaylandı" butonu) hem de "Görüşmeyi Tamamla → Kazanıldı" bu aynı
  // modalı, aynı kayıt üzerinde açar — iki paralel akış yerine tek akış.
  // Modal, bu değer null olmadığında açık sayılır.
  const [
    participationConfirmationTarget,
    setParticipationConfirmationTarget,
  ] = useState<GeneratedDocumentRecord | null>(
    null,
  );

  // Owned here (not inside DocumentBasketModal) so the selection survives
  // closing/reopening the modal for as long as this Working Space stays
  // mounted, and so other tools (e.g. the email module) can read it.
  const [
    selectedDocumentBasketIds,
    setSelectedDocumentBasketIds,
  ] = useState<Set<DocumentBasketRole>>(
    new Set(),
  );

  const [
    documentBasketItems,
    setDocumentBasketItems,
  ] = useState<DocumentBasketItem[]>([]);

  // Sprint 25.4E — the "ready-to-consume list for the email tool" this
  // used to feed no longer exists: Workspace Email's only attachment
  // source is now the Exhibition Repository's explicit selection (see
  // exhibitionSessionMail.buildWorkspaceEmailAttachments). This value has
  // no other reader, but the underlying document-basket selection state
  // above it is untouched — the Belge Sepeti tool/modal still owns and
  // uses it for its own (Document Engine-adjacent) purposes.

  // Sprint 25.1 — company and the explicitly selected contact are the
  // workspace's fixed context; they never change because of which
  // opportunity (if any) happens to match the sidebar's fuar.
  const resolvedContact = useMemo(() => {
    if (!initialContactId) {
      return null;
    }

    return contacts.find(
      (contact) =>
        contact.id === initialContactId &&
        contact.company_id === company.id,
    ) ?? null;
  }, [
    company.id,
    contacts,
    initialContactId,
  ]);

  // Sprint 25.2 — set the moment ensureActiveOpportunity() below
  // successfully creates a new opportunity for the current fuar, so
  // every action in this same session reuses it immediately rather than
  // racing a stale `opportunities` prop (which only updates once
  // onRefresh() resolves). Reset whenever the sidebar fuar changes — a
  // session id from a different fuar must never leak into this one.
  const [
    sessionOpportunityId,
    setSessionOpportunityId,
  ] = useState<string | null>(null);

  useEffect(() => {
    setSessionOpportunityId(null);
  }, [selectedSidebarExhibitionId]);

  // RC-04 — guards the terminal empty state's "Yeni Fuar Fırsatı
  // Oluştur" button against a double-click racing two creates while the
  // first is still in flight.
  const [
    isStartingNewOpportunity,
    setIsStartingNewOpportunity,
  ] = useState(false);

  // Sprint 25.1/25.2 — the workspace's one fuar context is
  // selectedSidebarExhibitionId (ExhibitionSelectionContext); the
  // opportunity shown here, if any, is derived FROM it — never the other
  // way around. This is a plain value recomputed every render, not
  // effect-driven state, so there is no synchronization step and
  // therefore no possible mismatch/staleness between the two: switching
  // the sidebar fuar just re-derives this on the next render. Prefers an
  // active opportunity for that fuar; falls back to the most recent
  // (opportunities are already ordered newest-first) non-active one so a
  // closed/won record for that fuar still shows instead of nothing.
  // sessionOpportunityId (this render's own just-created record) is
  // checked first so it is never shadowed by a stale opportunities prop.
  // Sprint 25.2 — the workspace's real, usable-for-actions opportunity.
  // A terminal (signed/lost) match for the fuar is never silently
  // treated as this — see resolveSessionOpportunity's own doc comment.
  // sessionOpportunityId takes priority so an opportunity created
  // earlier in this session (ensureActiveOpportunity below) is reused
  // immediately, without waiting for the opportunities prop to refresh.
  //
  // Kritik Akış Düzeltmesi 2 — initialOpportunityId (a specific record
  // requested via URL, e.g. a Today task link) is passed through as
  // explicitOpportunityId so that exact opportunity's own id/stage
  // decides the result whenever a fuar has more than one opportunity —
  // never a sibling picked by the active-first/most-recent guess.
  const selectedOpportunity = useMemo(
    () =>
      resolveSessionOpportunity({
        opportunities,
        selectedExhibitionId:
          selectedSidebarExhibitionId,
        sessionOpportunityId,
        explicitOpportunityId:
          initialOpportunityId,
      }),
    [
      opportunities,
      selectedSidebarExhibitionId,
      sessionOpportunityId,
      initialOpportunityId,
    ],
  );

  // Sprint 25.5 — selectedOpportunity deliberately stays null for a
  // terminal-only fuar match (see its own note above and
  // resolveSessionOpportunity's doc comment) so "Görüşmeyi Tamamla"
  // still creates a fresh opportunity rather than silently reusing a
  // closed one. But "Fırsatı Kapat" (Section 6: a closed opportunity
  // must be reopenable, read-only) needs something to actually show and
  // close even when there's no active match — a signed-but-not-yet-
  // verdicted opportunity, or an already-won/lost one being reviewed.
  // viewedOpportunity is that: same active-first preference, but falls
  // back to the fuar's most recent record (selectOpportunityForExhibition
  // already does exactly this) instead of null. Used ONLY for display and
  // for "Fırsatı Kapat" — the Commit Engine's reuse/create decision below
  // still reads selectedOpportunity, unchanged.
  const viewedOpportunity = useMemo(
    () =>
      selectOpportunityForExhibition(
        opportunities,
        selectedSidebarExhibitionId,
        initialOpportunityId,
      ),
    [
      opportunities,
      selectedSidebarExhibitionId,
      initialOpportunityId,
    ],
  );

  // Sprint 25.2 — a real opportunity is never required just to open and
  // use the workspace. draftOpportunity is a read-only stand-in so the
  // existing view-model mapper and LiveInteraction — both otherwise
  // unchanged — always have something valid to render once a fuar is
  // selected; isDraftOpportunity marks that it isn't real yet. Every
  // write path resolves or creates a real opportunity first
  // (ensureActiveOpportunity below) before touching Supabase — this
  // object itself is never sent anywhere.
  const draftOpportunity = useMemo(
    () =>
      buildDraftOpportunity({
        companyId: company.id,
        exhibitionId: selectedSidebarExhibitionId,
        contactId: resolvedContact?.id ?? null,
        ownerId: user?.id ?? null,
      }),
    [
      company.id,
      selectedSidebarExhibitionId,
      resolvedContact,
      user?.id,
    ],
  );

  // Sprint 25.5 — falls back to viewedOpportunity (not just draftOpportunity)
  // so reopening a fuar whose only record is already terminal shows that
  // record's real historical data instead of a blank draft — Section 6
  // "Geçmiş bilgiler yalnızca görüntülenebilir."
  const activeOpportunity =
    selectedOpportunity ?? viewedOpportunity ?? draftOpportunity;
  const isDraftOpportunity =
    !selectedOpportunity && !viewedOpportunity;

  // Sprint 25.5 — based on viewedOpportunity (not selectedOpportunity):
  // the read-only lockdown needs to reach a signed opportunity too, which
  // selectedOpportunity never resolves to (see viewedOpportunity's own
  // note above). A draft (no record at all) is never "closed". Every
  // stage except won/lost counts as open — including "signed": Signed ≠
  // Won, so a signed-but-not-yet-verdicted opportunity still behaves as
  // a normal, open workspace until the user explicitly says Kazanıldı/
  // Katılmadı via "Görüşmeyi Tamamla" (BUG-S26-003 — there is no
  // standalone "Fırsatı Kapat" entry point anymore).
  const isOpportunityClosed = Boolean(
    viewedOpportunity &&
      !canCloseOpportunity(viewedOpportunity.stage),
  );
  const closedOpportunityReason = isOpportunityClosed
    ? "Bu fırsat kapatılmıştır."
    : null;

  // Sprint 25.4B — everything the Workspace Email Panel reads is scoped
  // to panelSessionExhibitionId (the fuar it was opened for), not
  // whatever the sidebar currently shows — see Section E "Fuar Bağlamı
  // ve Panel Kilidi". sessionOpportunityId is intentionally NOT consulted
  // here: it only ever tracks an opportunity created for the *current*
  // sidebar fuar, which is meaningless once the panel's locked fuar and
  // the sidebar's live fuar diverge.
  const panelSessionExhibition =
    sidebarExhibitions.find(
      (candidate) =>
        candidate.id === panelSessionExhibitionId,
    ) ?? null;

  const isSidebarExhibitionMismatched =
    panelSessionExhibitionId !== null &&
    panelSessionExhibitionId !== selectedSidebarExhibitionId;

  const panelSessionMailDraft = getSessionDraft(
    exhibitionSessions,
    panelSessionExhibitionId,
  ).mailDraft;

  const panelSessionDraftPriceResult = getSessionDraft(
    exhibitionSessions,
    panelSessionExhibitionId,
  ).priceResult;

  const panelSessionOpportunity = panelSessionExhibitionId
    ? resolveSessionOpportunity({
        opportunities,
        selectedExhibitionId: panelSessionExhibitionId,
        sessionOpportunityId: null,
      })
    : null;

  // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC: the exact props WorkspaceEmailPanel
  // is about to receive (or already has) — panelSessionOpportunity?.id is
  // the opportunityId used for attachment resolution; compare this
  // against GENERATED RECORD CREATED's opportunityId to see if they
  // actually match.
  useEffect(() => {
    if (
      !isEmailPanelOpen ||
      !panelSessionExhibitionId
    ) {
      return;
    }

    console.error(
      "[BUG-S26.2.8] EMAIL PANEL PROPS",
      {
        panelSessionExhibitionId,
        panelSessionOpportunityId:
          panelSessionOpportunity?.id ??
          null,
        panelSessionOpportunityStage:
          panelSessionOpportunity?.stage ??
          null,
        generatedDocumentsCount:
          generatedDocuments.length,
        generatedDocumentsForExhibition:
          generatedDocuments
            .filter(
              (document) =>
                document.exhibitionId ===
                panelSessionExhibitionId,
            )
            .map(
              summarizeGeneratedDocumentForDiagnostics,
            ),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEmailPanelOpen,
    panelSessionExhibitionId,
    panelSessionOpportunity,
    generatedDocuments,
  ]);

  const panelSessionApprovedPrice: QuotationPriceSource | null =
    panelSessionOpportunity &&
    panelSessionOpportunity.price_grand_total != null &&
    panelSessionOpportunity.price_currency != null &&
    panelSessionOpportunity.price_stand_area_sqm != null &&
    panelSessionOpportunity.price_stand_type != null
      ? {
          standType: panelSessionOpportunity.price_stand_type,
          standAreaSqm:
            panelSessionOpportunity.price_stand_area_sqm,
          currency: panelSessionOpportunity.price_currency,
          grandTotal:
            panelSessionOpportunity.price_grand_total,
        }
      : null;

  function handleWorkspaceEmailDraftChange(
    patch: Partial<
      NonNullable<typeof panelSessionMailDraft>
    >,
  ): void {
    if (!panelSessionExhibitionId) {
      return;
    }

    setExhibitionSessions((current) => {
      const draft = getSessionDraft(
        current,
        panelSessionExhibitionId,
      );

      const baseline =
        draft.mailDraft ??
        createEmptyWorkspaceEmailDraft(
          emailPanelRequestedTemplateId ??
            "Information Package",
        );

      return withSessionDraft(
        current,
        panelSessionExhibitionId,
        {
          mailDraft: { ...baseline, ...patch },
        },
      );
    });
  }

  // SPRINT 26.2.1 — back to a plain append. The Dropbox Sign trigger
  // moved from here (fire-and-forget, after the mail record already
  // existed) to useWorkspaceEmailDraft's Contract-send branch, which now
  // awaits handleSendContractForSignature and only writes the mail
  // record — meaning this handler only ever runs — after a real
  // successful signature request. See handleSendContractForSignature/
  // handleSendForSignature above.
  function handleWorkspaceEmailEvent(
    event: WorkspaceEmailEvent,
  ): void {
    if (!panelSessionExhibitionId) {
      return;
    }

    setExhibitionSessions((current) =>
      withMailEventAppended(
        current,
        panelSessionExhibitionId,
        event,
      ),
    );
  }

  // Sprint 25.2.1 — company (a required prop, never null) is the only
  // render requirement now; a fuar is no longer needed just to build
  // this view model. draftOpportunity already carries exhibition_id:
  // null gracefully when no fuar is selected — the mapper below already
  // treats a null exhibition_id as "no exhibition" throughout (same as
  // any other opportunity with no DB exhibition link).
  const workspace = useMemo(() => {
    const mappedWorkspace = createCallWorkspaceViewModel({
      company,
      opportunity: activeOpportunity,
      timelineEvents: timeline,
      reminders,
      emails,
      callNotes,
      aiMemory,
      exhibitions,
    });

    const contactWorkspace = resolvedContact
      ? {
          ...mappedWorkspace.customer,
          id: resolvedContact.id,
          firstName: resolvedContact.first_name ?? "",
          lastName: resolvedContact.last_name ?? "",
          fullName:
            [resolvedContact.first_name, resolvedContact.last_name]
              .filter(Boolean)
              .join(" ") || "—",
          title: resolvedContact.title ?? "Rol atanmadı",
          email: resolvedContact.email ?? "Kayıtlı değil",
          phone: resolvedContact.phone ?? "Kayıtlı değil",
          isPrimary: resolvedContact.is_primary,
        }
      : mappedWorkspace.customer;

    const approvedPrice = isDraftOpportunity
      ? undefined
      : Object.values(approvedPrices).find(
          (snapshot) =>
            snapshot.opportunityId ===
            activeOpportunity.id,
        );
    const pricedExhibition = approvedPrice
      ? sidebarExhibitions.find(
          (exhibition) =>
            exhibition.id === approvedPrice.exhibitionId,
        )
      : null;

    return {
      ...mappedWorkspace,
      customer: contactWorkspace,
      exhibition: {
        ...mappedWorkspace.exhibition,
        name:
          pricedExhibition?.shortName?.trim() ||
          approvedPrice?.exhibitionName?.trim() ||
          mappedWorkspace.exhibition.name,
      },
    };
  }, [
    company,
    activeOpportunity,
    isDraftOpportunity,
    selectedSidebarExhibitionId,
    timeline,
    reminders,
    emails,
    callNotes,
    aiMemory,
    exhibitions,
    resolvedContact,
    approvedPrices,
    sidebarExhibitions,
  ]);

  useEffect(() => {
    const navigationState = location.state as
      | {
          quotationSent?: boolean;
          companyId?: string;
          opportunityId?: string;
        }
      | null;

    if (
      !navigationState?.quotationSent ||
      navigationState.companyId !== company.id ||
      navigationState.opportunityId !== selectedOpportunity?.id
    ) {
      return;
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });

    void onRefresh().then(() => {
      showToast(
        "Teklif gÃ¶nderildi. Takip gÃ¶revi oluÅŸturuldu.",
        "success",
      );
    });
  }, [
    company.id,
    location.pathname,
    location.search,
    location.state,
    navigate,
    onRefresh,
    selectedOpportunity?.id,
    showToast,
  ]);

  // Sprint 25.1 — shared between the lighter shell below and the full
  // workspace return further down, so the repository panel always
  // reflects the sidebar's fuar regardless of whether a matching
  // opportunity exists.
  const exhibitionRepositoryPanel = (
    <ExhibitionWorkspace
      key={
        selectedSidebarExhibition?.id ??
        "empty"
      }
      exhibition={
        selectedSidebarExhibition
      }
      onSelectedDocumentsChange={
        setExhibitionSelectedDocuments
      }
    />
  );

  // Sprint 25.2.1 — company is the only hard requirement to render the
  // workspace now (see the workspace useMemo above) — no early return
  // here anymore. Whether a fuar or a real opportunity exists only
  // changes which parts of the render below are enabled.
  const activeWorkspace = workspace;
  const activeManualFollowUp =
    reminders.find(
      (reminder) =>
        !reminder.completed &&
        reminder.opportunity_id === activeOpportunity.id &&
        reminder.task_type ===
          "manual-opportunity-follow-up",
    ) ?? null;

  // Sprint 25.2/25.3 — the single place a real opportunity gets created
  // for the current fuar. Called ONLY from commitWorkspaceSession, the
  // one Commit Engine ("Görüşmeyi Tamamla") — price calculation,
  // note-drafting, and next-activity selection must never reach this.
  // Idempotent within this session: sessionOpportunityId (set the moment
  // creation succeeds) makes selectedOpportunity resolve to the same
  // real record immediately, so a second completion fired moments later
  // would reuse it instead of racing a duplicate create.
  async function ensureActiveOpportunity(): Promise<Opportunity | null> {
    if (selectedOpportunity) {
      return selectedOpportunity;
    }

    if (!selectedSidebarExhibition) {
      showToast(
        "Görüşmeyi tamamlamak için sidebar'dan bir fuar seçin.",
        "error",
      );

      return null;
    }

    try {
      const created = await createOpportunity({
        company_id: company.id,
        exhibition_id:
          selectedSidebarExhibition.id,
        contact_id:
          resolvedContact?.id ?? null,
        stage: "new",
        interest_level: 0,
        estimated_value: 0,
        next_action: null,
        next_action_date: null,
        owner: user?.id ?? null,
      });

      setSessionOpportunityId(created.id);

      return created;
    } catch (creationError) {
      console.error(
        "Opportunity creation error:",
        creationError,
      );

      showToast(
        (creationError as { code?: string } | null)
          ?.code ===
          ACTIVE_OPPORTUNITY_LIMIT_ERROR_CODE
          ? ACTIVE_OPPORTUNITY_LIMIT_TOAST_MESSAGE
          : "Fırsat oluşturulamadı.",
        "error",
      );

      return null;
    }
  }

  // RC-04 — the terminal/closed empty state's "Yeni Fuar Fırsatı
  // Oluştur" button. Reuses ensureActiveOpportunity as-is: it already
  // never reuses a terminal (won/lost) match for this fuar (see
  // selectedOpportunity's own doc comment above), already enforces the
  // 4-active-opportunity limit with the existing toast, and already
  // scopes the new row to whichever fuar is currently selected in the
  // sidebar — so this handler adds nothing except the explicit refresh
  // needed to make the fresh opportunity replace the closed-state
  // notice (opportunities is a prop; only onRefresh() can update it).
  async function handleStartNewOpportunityFromClosedState(): Promise<void> {
    if (isStartingNewOpportunity) {
      return;
    }

    setIsStartingNewOpportunity(true);

    try {
      const created = await ensureActiveOpportunity();

      if (created) {
        await refreshWorkspaceSafely();
      }
    } finally {
      setIsStartingNewOpportunity(false);
    }
  }

  // Sprint 25.2.1 — "Not Kaydet" never creates or requires an
  // opportunity. Returns whether it actually persisted (LiveInteraction
  // only clears the note textarea when true) — false covers both the
  // legitimate "held as a local draft until Görüşmeyi Tamamla" case and
  // the noteSaving/no-user guard, neither of which is an error.
  // Sprint 25.3 — "Not Kaydet" no longer talks to Supabase at all. The
  // text is already staged into the active Exhibition Session draft as
  // the user types (see handleDraftNoteChange below); this only gives
  // the user an explicit confirmation that it's held safely as a draft.
  function handleSaveNoteDraft(): void {
    showToast(
      "Not taslak olarak tutuluyor. Görüşme tamamlandığında kaydedilecek.",
      "success",
    );
  }

  function handleDraftNoteChange(note: string): void {
    updateActiveSessionDraft({ note });
  }

  // BUG-S26-003 — "Görüşmeyi Tamamla" no longer commits immediately: it
  // first asks "Görüşme Sonucu" (see CloseOpportunityModal). Nothing is
  // written yet at this point — note/nextAction are just captured so
  // whichever outcome the user picks can still pass them to
  // commitWorkspaceSession unchanged.
  async function handleCompleteSession(
    note: string,
    nextAction: string,
  ) {
    if (noteSaving || closingOpportunity) {
      return;
    }

    setPendingSessionCompletion({ note, nextAction });
    setIsCloseOpportunityModalOpen(true);
  }

  // Sprint 25.3 — the ONE Commit Engine. This is the only function in the
  // whole workspace allowed to create/update an Opportunity, write a
  // Timeline event, create a Reminder, change stage, or save a Call Note —
  // every other workspace action (typing a note, calculating a price,
  // picking a follow-up date) only ever touches the in-memory Exhibition
  // Session draft and never reaches this function. "Görüşmeyi Tamamla"
  // (handleCompleteSession above) is its one and only caller.
  //
  // Locked order (Section 2 — do not reorder):
  //   1. Validation (company/user/not already saving)
  //   2. Selected Exhibition kontrolü
  //   3. Existing Opportunity araştır
  //   4. Gerekirse Create Opportunity (BUG-S25-001 limit enforced here)
  //   5. Draft Price uygula
  //   6. Draft Next Activity uygula — outcome "won"/"lost" iken atlanır
  //      (BUG-S26-003.1: terminal bir kayıtta yeni takip/reminder
  //      oluşmaz — Lost için bkz. closeOpportunityAsLost'un kendi
  //      reminder temizliği ve next_action sıfırlaması; Won artık
  //      burada hiç sonuçlanmıyor — bkz. handleCallResultWon/RC-01, o
  //      da yalnızca "Katılım Onaylandı" onaylandığında
  //      completeCustomerSignatureWonTransition ile sonuçlanır).
  //   7. Call Note kaydet
  //   8. Timeline / Stage / Reminder (executeAction → execution engine)
  //      — outcome "won"/"lost" iken atlanır: executionListeners.ts
  //      kendi otomatik takip reminder'ını oluşturur (bu dosyaya
  //      dokunulmadan önlenemez); Lost'un kendi timeline kaydı
  //      (closeOpportunityAsLost) / Won'un nihai timeline kaydı
  //      (completeCustomerSignatureWonTransition) zaten "ne olduğunu"
  //      doğru ve daha spesifik şekilde kaydediyor.
  //   8.5. Workspace Email event'lerini (varsa) timeline'a bağla —
  //        Sprint 25.4B Section L, idempotent (sendOperationKey bazlı).
  //        Tüm outcome'larda çalışır.
  //   9. Yalnızca başarılıysa: yalnızca bu fuarın Exhibition Session
  //      draftı temizlenir — diğer fuarların draftları dokunulmaz.
  //
  // Atomicity: if step 2 blocks or step 4 fails (e.g. the four-active-
  // opportunity limit), nothing below it runs and no draft is cleared —
  // the workspace is left exactly as it was and the user can retry.
  //
  // BUG-S26-003.1 — `outcome`/`navigateOnSuccess` are the one, explicit,
  // additive option this task allows: they only ever SKIP steps 6/8 and
  // the final navigate call — the locked step order itself, and what
  // each step does when it runs, is unchanged. Defaults preserve
  // "Görüşme Devam Ediyor"'s exact pre-existing behavior for any
  // existing caller that doesn't pass options at all.
  async function commitWorkspaceSession(
    note: string,
    nextAction: string,
    options: {
      outcome?: "ongoing" | "won" | "lost";
      navigateOnSuccess?: boolean;
    } = {},
  ): Promise<boolean> {
    const outcome = options.outcome ?? "ongoing";
    const navigateOnSuccess =
      options.navigateOnSuccess ?? true;

    if (noteSaving || !user) {
      return false;
    }

    // Sprint 25.5 — a closed (won/lost) opportunity's workspace is fully
    // read-only; "Görüşmeyi Tamamla" is one of the actions Section 6
    // requires to stay passive. Folded into the existing Step 1
    // Validation guard above rather than inserted as a new numbered
    // step — the locked Commit Engine order itself is unchanged.
    if (isOpportunityClosed) {
      showToast(closedOpportunityReason!, "error");

      return false;
    }

    setNoteSaving(true);

    try {
      // Steps 1-2 — Validation / Selected Exhibition kontrolü
      const decision = decideOpportunityCommitAction({
        hasSelectedOpportunity: Boolean(
          selectedOpportunity,
        ),
        hasSelectedExhibition: Boolean(
          selectedSidebarExhibition,
        ),
      });

      if (decision === "blocked-no-exhibition") {
        showToast(
          "Görüşmeyi tamamlamak için sidebar'dan bir fuar seçin.",
          "error",
        );

        return false;
      }

      // Steps 3-4 — Existing Opportunity araştır / Gerekirse Create
      let opportunity: Opportunity;

      if (decision === "reuse") {
        opportunity = selectedOpportunity!;
      } else {
        // Atomicity: if creation fails (e.g. BUG-S25-001 limit
        // reached), nothing below runs — no note, timeline, reminder or
        // stage write happens for a half-completed session, and no
        // draft is cleared.
        const ensured =
          await ensureActiveOpportunity();

        if (!ensured) {
          return false;
        }

        opportunity = ensured;
      }

      const committedExhibitionId =
        selectedSidebarExhibitionId;

      // Step 5 — Draft Price uygula
      if (draftPriceResult) {
        await applyPriceToOpportunity(
          opportunity,
          draftPriceResult.result,
          draftPriceResult.meta,
        );
      }

      // Step 6 — Draft Next Activity uygula (yalnızca "ongoing")
      if (
        outcome === "ongoing" &&
        draftNextActivity
      ) {
        await applyNextActivityToOpportunity(
          opportunity,
          draftNextActivity,
        );
      }

      // Step 7 — Call Note kaydet
      const completedNote =
        note.trim();

      if (completedNote) {
        await createCallNote({
          company_id: company.id,
          opportunity_id:
            opportunity.id,
          note: completedNote,
          created_by: user.id,
        });
      }

      // Step 8 — Timeline / Stage / Reminder (yalnızca "ongoing" —
      // executionListeners.ts kendi otomatik takip reminder'ını
      // oluşturur, won/lost'ta bu istenmiyor; bkz. yukarıdaki not)
      if (outcome === "ongoing") {
        const actionId =
          resolveWorkspaceFollowUpExecutionActionId(
            nextAction,
          );

        const actionTitle =
          getWorkspaceFollowUpActionLabel(
            nextAction,
          );

        await executeAction({
          actionId,
          title: actionTitle,
          companyId: company.id,
          opportunityId:
            opportunity.id,
        });
      }

      // Step 8.5 — Sprint 25.4B Section L: link this fuar's still-
      // unlinked Workspace Email events into the opportunity timeline,
      // now that a real opportunity is guaranteed to exist. Each event is
      // marked linked immediately after its own timeline write succeeds
      // (not batched at the end) — so if a later event in the list fails,
      // the ones already linked stay linked, and a retried commit only
      // ever re-attempts genuinely-unlinked events (mail event id /
      // sendOperationKey is the idempotency key — see
      // exhibitionSessionMail.ts). A failure here throws just like any
      // other step, so Step 9 below never runs and no draft is cleared.
      const pendingMailEvents = unlinkedMailEvents(
        activeSessionDraft.mailEvents,
      );

      for (const mailEvent of pendingMailEvents) {
        await createTimelineEvent({
          company_id: company.id,
          opportunity_id: opportunity.id,
          type: "workspace-email-sent",
          title: "Workspace e-postası VIAWA kaydına eklendi",
          description:
            formatWorkspaceEmailEventSummary(mailEvent),
        });

        const linkedAt = new Date().toISOString();

        setExhibitionSessions((current) =>
          withMailEventsLinked(
            current,
            committedExhibitionId,
            [mailEvent.id],
            linkedAt,
          ),
        );
      }

      await onRefresh();

      // Step 9 — Draft temizleme: only this fuar's Exhibition Session,
      // and only now that everything above has actually succeeded.
      setExhibitionSessions((current) =>
        withSessionDraftCleared(
          current,
          committedExhibitionId,
        ),
      );

      // BUG-S26-003.1 — "won"/"lost" defer this until the closure write
      // (stage/closed_at/closure fields + its own timeline event) has
      // also succeeded; the caller (handleCallResultWon/Lost) navigates
      // itself once that's confirmed. "ongoing" keeps navigating here,
      // exactly as before.
      if (navigateOnSuccess) {
        navigate("/today");
      }

      showToast(
        "Görüşme notu kaydedildi ve iş akışı güncellendi.",
        "success",
      );

      return true;
    } catch (noteError) {
      console.error(
        "Call note saving error:",
        noteError,
      );

      showToast(
        "Görüşme notu kaydedilemedi.",
        "error",
      );

      throw noteError;
    } finally {
      setNoteSaving(false);
    }
  }

  // Sprint 25.4B — the single funnel all three Workspace Email entry
  // points (Section A) go through. Opportunity is never required (that
  // whole gate is gone); the only hard requirement is a fuar selected in
  // the sidebar right now — Section E.
  function openWorkspaceEmailPanel(
    requestedTemplateId: string | null,
    // Sprint 25.1 / Adım 2.1 — the Company Detail auto-intent (below)
    // retries this on every selectedSidebarExhibitionId change while no
    // fuar is selected yet; that isn't a user action against a guard
    // they can see, so it must not surface the "select a fuar" toast
    // the way a manual "E-posta" click still does. The guard conditions
    // themselves are unchanged — only whether they toast is affected.
    options?: { silent?: boolean },
  ): boolean {
    // Sprint 25.5 Section 6 — "E-posta gönderme" is one of the actions a
    // closed (won/lost) opportunity's workspace must keep passive.
    if (isOpportunityClosed) {
      if (!options?.silent) {
        showToast(closedOpportunityReason!, "error");
      }

      return false;
    }

    if (!selectedSidebarExhibitionId) {
      if (!options?.silent) {
        showToast(
          "E-posta hazırlamak için önce sidebar'dan bir fuar seçin.",
          "error",
        );
      }

      return false;
    }

    const exhibitionId = selectedSidebarExhibitionId;

    setExhibitionSessions((current) => {
      const existingMailDraft = getSessionDraft(
        current,
        exhibitionId,
      ).mailDraft;

      if (existingMailDraft) {
        return current;
      }

      return withSessionDraft(current, exhibitionId, {
        mailDraft: createEmptyWorkspaceEmailDraft(
          requestedTemplateId ?? "Information Package",
        ),
      });
    });

    setPanelSessionExhibitionId(exhibitionId);
    setEmailPanelRequestedTemplateId(requestedTemplateId);
    setIsEmailPanelOpen(true);

    // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC: the opportunity resolved HERE
    // (via resolveSessionOpportunity, active-only) is a DIFFERENT
    // computation than panelSessionOpportunity used later for the actual
    // attachment resolution — logged separately (EMAIL PANEL PROPS) so
    // the two can be compared directly.
    console.error(
      "[BUG-S26.2.8] EMAIL PANEL OPEN",
      {
        requestedTemplateId,
        exhibitionId,
        generatedDocumentsCount:
          generatedDocuments.length,
        generatedDocumentsForExhibition:
          generatedDocuments
            .filter(
              (document) =>
                document.exhibitionId ===
                exhibitionId,
            )
            .map(
              summarizeGeneratedDocumentForDiagnostics,
            ),
      },
    );

    return true;
  }

  // Sprint 25.1 / Adım 3.1 — gates the pending email intent below: stays
  // false only while a real initialOpportunityId still needs to be
  // resolved into a sidebar fuar switch. Starts already TRUE when there
  // is no initialOpportunityId at all — Company Detail's "Çalışma
  // Alanını Aç", manual sidebar Workspace opens, and opportunity-less
  // Workspace opens (Kapsam Ayrımı) are unaffected by this gate.
  const [
    isInitialOpportunityContextResolved,
    setIsInitialOpportunityContextResolved,
  ] = useState(
    () => !initialOpportunityId,
  );

  // Sprint 25.1 / Adım 3 → 3.1 — a Today task's opportunity carries the
  // one real fuar this Workspace session must land on; it must win over
  // whatever fuar happened to already be selected (Adım 3's bug: it
  // only acted when NOTHING was selected, so an unrelated already-
  // selected fuar silently won instead). Unconditional now — no new
  // opportunity-selection logic, still just seeds the existing
  // setSelectedExhibitionId (from useExhibitionSelection, already used
  // to READ the selection above) with that opportunity's own
  // exhibition_id. A not-found/foreign/no-exhibition opportunity is
  // simply left alone (opportunities is already company-scoped, so a
  // foreign id can never match) — isInitialOpportunityContextResolved
  // still flips true right after, so the email intent below proceeds
  // exactly as it already safely does with no opportunity context.
  const initialOpportunitySelectionConsumedRef =
    useRef(false);

  useEffect(() => {
    if (
      initialOpportunitySelectionConsumedRef.current
    ) {
      return;
    }

    initialOpportunitySelectionConsumedRef.current =
      true;

    if (!initialOpportunityId) {
      return;
    }

    const matchedOpportunity =
      opportunities.find(
        (opportunity) =>
          opportunity.id ===
          initialOpportunityId,
      );

    if (matchedOpportunity?.exhibition_id) {
      setSelectedSidebarExhibitionId(
        matchedOpportunity.exhibition_id,
      );
    }

    // Set in the same effect tick as the exhibition switch above, so
    // both land in the same React 18 batched re-render — the pending
    // email intent effect below only ever observes the NEW
    // selectedSidebarExhibitionId together with this flip to true,
    // never a stale in-between render with the old fuar still active.
    setIsInitialOpportunityContextResolved(
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sprint 25.1 / Adım 2.1 — the Company Detail "E-posta Gönder" intent
  // stays PENDING (not consumed) until openWorkspaceEmailPanel actually
  // succeeds — a fuar may not be selected yet when this mounts, and the
  // user picking one afterward (Sidebar → ExhibitionSelectionContext →
  // selectedSidebarExhibitionId) must still open the panel once, without
  // requiring a second click anywhere. Silent: this auto-intent must
  // never surface the "select a fuar" toast a manual "E-posta" click
  // still gets — see openWorkspaceEmailPanel's options param.
  const [
    isEmailIntentPending,
    setIsEmailIntentPending,
  ] = useState(() =>
    Boolean(initialOpenEmailPanel),
  );

  // Belt-and-braces against StrictMode's dev-only double-invocation of
  // effects that fire during initial mount: isEmailIntentPending's own
  // setState is async, so two back-to-back invocations of this same
  // effect (same closure, same isEmailIntentPending=true) could both
  // pass the state check before either commits — this ref is mutated
  // synchronously, so the second invocation always sees it.
  const emailIntentConsumedRef = useRef(false);

  useEffect(() => {
    if (
      emailIntentConsumedRef.current ||
      !isEmailIntentPending ||
      // Sprint 25.1 / Adım 3.1 — never open onto whatever fuar was
      // selected before the Today-intent exhibition switch above has
      // had a chance to run.
      !isInitialOpportunityContextResolved ||
      !selectedSidebarExhibitionId
    ) {
      return;
    }

    const opened = openWorkspaceEmailPanel(
      initialEmailPanelTemplateId ??
        "Information Package",
      { silent: true },
    );

    if (!opened) {
      // isOpportunityClosed blocked this particular fuar — stays
      // pending so picking a different, open fuar can still succeed.
      return;
    }

    emailIntentConsumedRef.current = true;
    setIsEmailIntentPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEmailIntentPending,
    isInitialOpportunityContextResolved,
    selectedSidebarExhibitionId,
  ]);

  function closeWorkspaceEmailPanel(): void {
    setIsEmailPanelOpen(false);
    setPanelSessionExhibitionId(null);
    setEmailPanelRequestedTemplateId(null);
  }

  // BUG-S26-003.1 Section 2B — "Bu opportunity'ye ait açık reminder
  // varsa mevcut servislerle tamamlanır/kapatılır." Reads from the
  // `reminders` prop already in scope (no new fetch) — safe to call
  // again on a retry, since marking an already-completed reminder
  // completed again is a harmless no-op.
  //
  // Kritik Akış Düzeltmesi 5 — the actual filter+write now lives once,
  // shared, in reminderService.completeOpenRemindersForOpportunity (also
  // used by CompanyDetailPage's "İptal" and, below, by
  // completeCustomerSignatureWonTransition) — this stays a thin wrapper
  // around it so its existing call site here (closeOpportunityAsLost)
  // needs zero changes.
  async function completeOpenRemindersForOpportunity(
    opportunityId: string,
  ): Promise<void> {
    await completeOpenRemindersForOpportunityInStorage(
      reminders,
      opportunityId,
    );
  }

  // Same repair-check pattern completeCustomerSignatureWonTransition
  // already uses below: an independent "is this specific fact already
  // true" probe, so a retried closure never re-writes what already
  // succeeded and never silently skips what didn't.
  async function hasOpportunityClosureTimelineEvent(
    opportunityId: string,
    type:
      | "opportunity-won"
      | "opportunity-lost"
      | "contract-archived",
  ): Promise<boolean> {
    const events =
      await getTimelineEventsByCompany(company.id);

    return events.some(
      (event) =>
        event.opportunity_id === opportunityId &&
        event.type === type,
    );
  }

  // RC-01 — "Kazanıldı" artık ayrı bir won-stage kapanışı denemez
  // (eski closeOpportunityAsWon buradaydı — kaldırıldı, çünkü "Kazanıldı"
  // olabilmek için sözleşmenin ÖNCEDEN imzalı olmasını şart koşuyordu:
  // döngüsel bir çıkmaz, çünkü imzalı hale gelmenin TEK yolu zaten bu
  // akıştı). Kilitli ürün kararı: tek terminal geçiş "signed" — bkz.
  // completeCustomerSignatureWonTransition. Bu, o akış için "en güncel,
  // henüz imzalanmamış gerçek Katılım Belgesi" kaydını bulur — asıl kural
  // selectLatestUnsignedDocument'ta (birim testli), burada yalnızca
  // component'in kendi generatedDocuments state'ine bağlanan ince bir
  // sarmalayıcı.
  function findLatestUnsignedDocumentForOpportunity(
    opportunityId: string,
  ): GeneratedDocumentRecord | null {
    return selectLatestUnsignedDocument(
      generatedDocuments,
      opportunityId,
    );
  }

  async function closeOpportunityAsLost(
    opportunity: Opportunity,
    reasonId: LostReasonId,
    note: string | null,
  ): Promise<boolean> {
    try {
      const alreadyRecorded =
        await hasOpportunityClosureTimelineEvent(
          opportunity.id,
          "opportunity-lost",
        );

      if (
        opportunity.stage === "lost" &&
        alreadyRecorded
      ) {
        return true;
      }

      await completeOpenRemindersForOpportunity(
        opportunity.id,
      );

      if (opportunity.stage !== "lost") {
        await updateOpportunity(opportunity.id, {
          stage: "lost",
          closed_at: new Date().toISOString(),
          next_action: null,
          next_action_date: null,
          closure_reason: reasonId,
          closure_note:
            reasonId === "other" ? note : null,
        });
      }

      if (!alreadyRecorded) {
        await createTimelineEvent({
          company_id: company.id,
          opportunity_id: opportunity.id,
          type: "opportunity-lost",
          title: "Fırsat kaybedildi",
          description: buildLostTimelineDescription({
            reasonId,
            note,
          }),
        });
      }

      await onRefresh();

      showToast(
        "Fırsat katılmadı olarak kapatıldı.",
        "success",
      );

      return true;
    } catch (closeError) {
      console.error(
        "Opportunity close (lost) error:",
        closeError,
      );

      showToast(
        "Görüşme kaydedildi ancak fırsat katılmadı olarak işaretlenemedi. Lütfen tekrar deneyin.",
        "error",
      );

      return false;
    }
  }

  // BUG-S26-003 — commitWorkspaceSession (unchanged) resolves-or-creates
  // the real opportunity internally, but only updates sessionOpportunityId
  // (React state) — a value this same render's closures can't see yet.
  // Re-reading it fresh from Supabase, right after the commit succeeds,
  // is the only reliable way to get the exact opportunity that call just
  // used, whether it already existed or was created moments ago.
  async function resolveJustCommittedOpportunity(): Promise<
    Opportunity | null
  > {
    const companyOpportunities =
      await getOpportunitiesByCompany(company.id);

    return selectOpportunityForExhibition(
      companyOpportunities,
      selectedSidebarExhibitionId,
    );
  }

  function handleCloseCallResultModal(): void {
    if (closingOpportunity || noteSaving) {
      return;
    }

    setIsCloseOpportunityModalOpen(false);
    setPendingSessionCompletion(null);
  }

  // "Görüşme Devam Ediyor" — today's unchanged "Görüşmeyi Tamamla"
  // behavior, reached one click later than before.
  async function handleCallResultOngoing(): Promise<void> {
    if (!pendingSessionCompletion) {
      return;
    }

    const { note, nextAction } = pendingSessionCompletion;

    setIsCloseOpportunityModalOpen(false);
    setPendingSessionCompletion(null);

    await commitWorkspaceSession(note, nextAction);
  }

  // BUG-S26-003.1 Section 1 — the locked order: commit (no navigate) →
  // resolve the real opportunity → Won closure (no navigate on its own
  // either) → only once THAT has also succeeded, close the modal and
  // navigate exactly once. Any failure along the way (commit, resolve,
  // or closure) returns early: no navigate, modal stays open, the error
  // is already toasted by whichever step failed, and the user can retry
  // (pendingSessionCompletion is only cleared on full success).
  async function handleCallResultWon(): Promise<void> {
    if (!pendingSessionCompletion || closingOpportunity) {
      return;
    }

    const { note, nextAction } = pendingSessionCompletion;

    setClosingOpportunity(true);

    try {
      const committed = await commitWorkspaceSession(
        note,
        nextAction,
        { outcome: "won", navigateOnSuccess: false },
      );

      if (!committed) {
        return;
      }

      const opportunity =
        await resolveJustCommittedOpportunity();

      if (!opportunity) {
        showToast(
          "Görüşme kaydedildi ancak fırsat bulunamadı; kapanış işaretlenemedi.",
          "error",
        );

        return;
      }

      // RC-01 — "Kazanıldı" artık kendi başına bir kapanış yazımı
      // yapmıyor: en güncel, henüz imzalanmamış gerçek Katılım Belgesi'ni
      // bulur ve "Katılım Onaylandı" modalını açar. Gerçek stage/timeline/
      // reminder yazımı yalnızca kullanıcı orada imzalı PDF'yi onayladığında
      // (handleSignedPdfUploaded → completeCustomerSignatureWonTransition)
      // gerçekleşir — bu yüzden burada Workspace'i kapatmıyoruz/yönlendirmi
      // yoruz, yalnızca modalı açıyoruz.
      const latestUnsignedDocument =
        findLatestUnsignedDocumentForOpportunity(
          opportunity.id,
        );

      if (!latestUnsignedDocument) {
        showToast(
          "Bu fırsat için henüz bir Katılım Belgesi oluşturulmamış. Önce \"Sözleşme Hazırla\" ile belge oluşturun.",
          "error",
        );

        return;
      }

      setIsCloseOpportunityModalOpen(false);
      setPendingSessionCompletion(null);
      setParticipationConfirmationTarget(
        latestUnsignedDocument,
      );
    } finally {
      setClosingOpportunity(false);
    }
  }

  async function handleCallResultLost(
    reasonId: LostReasonId,
    note2: string | null,
  ): Promise<void> {
    if (!pendingSessionCompletion || closingOpportunity) {
      return;
    }

    const { note, nextAction } = pendingSessionCompletion;

    setClosingOpportunity(true);

    try {
      const committed = await commitWorkspaceSession(
        note,
        nextAction,
        { outcome: "lost", navigateOnSuccess: false },
      );

      if (!committed) {
        return;
      }

      const opportunity =
        await resolveJustCommittedOpportunity();

      if (!opportunity) {
        showToast(
          "Görüşme kaydedildi ancak fırsat bulunamadı; kapanış işaretlenemedi.",
          "error",
        );

        return;
      }

      const closed = await closeOpportunityAsLost(
        opportunity,
        reasonId,
        note2,
      );

      if (!closed) {
        return;
      }

      setIsCloseOpportunityModalOpen(false);
      setPendingSessionCompletion(null);
      navigate("/today");
    } finally {
      setClosingOpportunity(false);
    }
  }

  // Sprint 25.4B Section A.2 — "handleQuickAction(templateId), paneli
  // ilgili template seçili şekilde açar."
  function handleQuickAction(
    templateId: string,
  ) {
    openWorkspaceEmailPanel(templateId);
  }

  // Sprint 25.4B Section A.1 — "Ana E-posta butonu paneli boş/default
  // şablonla açar."
  function handleOpenEmailTool(): void {
    openWorkspaceEmailPanel(null);
  }

  // Sprint 22.9.9 (Part 2/3) — the one canonical refresh-isolation
  // helper for every stage writer below. Stage persistence and the
  // workspace refresh are independent operations: this always awaits
  // and explicitly handles the refresh itself (no unhandled rejection
  // is possible), and its result never gets folded into — or mistaken
  // for — the stage write's own success/failure.
  async function refreshWorkspaceSafely(): Promise<boolean> {
    try {
      await onRefresh();

      return true;
    } catch (refreshError) {
      console.error(
        "Workspace refresh error:",
        refreshError,
      );

      return false;
    }
  }

  const REFRESH_WARNING_SUFFIX =
    " Ekran otomatik yenilenemedi, sayfayı manuel yenileyin.";

  // Sprint 22.9.1 — the stage automation below only runs once the price
  // write itself has succeeded (never on a failed/skipped price save),
  // and its own failure is reported separately rather than folded into
  // (or silently swallowed by) the price-save error path.
  const PRICE_APPROVED_STAGE: OpportunityStage =
    "quotation-ready";

  // The persistent approved_price_snapshots row (written via
  // saveApprovedPriceSnapshot below) is the only thing document
  // generation actually reads — both the browser preview
  // (viawaContractDataSource.ts) and the document-service
  // (persistentContractDataSource.ts) resolve the approved price through
  // loadPersistentApprovedPriceSnapshot(), never through localStorage.
  // The local approvedPrices state (see approvedPriceSnapshotStorage.ts)
  // is only a same-session UI cache, so it must not be marked "approved"
  // until this persistence has actually succeeded — see
  // commitApprovedPrice() below, which enforces that ordering.
  //
  // Sprint 25.2 — extracted so both the real-opportunity path
  // (handlePriceCalculated below) and ensureActiveOpportunity (applying
  // a price that was calculated before any opportunity existed) can
  // call the exact same logic against a real, already-resolved
  // opportunity. Never called with a draft opportunity.
  async function applyPriceToOpportunity(
    opportunity: Opportunity,
    result: PriceResult,
    meta: PriceCalculatedMeta,
  ): Promise<void> {
    const key = approvedPriceKey(
      opportunity.id,
      meta.exhibitionId,
    );

    const approvedAt = new Date().toISOString();
    const persistentSnapshot: ApprovedPriceSnapshot = {
      opportunityId: opportunity.id,
      exhibitionId: meta.exhibitionId,
      exhibitionName: meta.exhibitionName,
      pricingSource: meta.pricingSource,
      pricingSourceVersion: meta.pricingSourceVersion,
      pricingConfigUpdatedAt: meta.pricingConfigUpdatedAt,
      matchedRepositoryFolder: meta.matchedRepositoryFolder,
      approvedAt,
      priceInput: result.appliedInput,
      priceResult: result,
    };

    const persistResult = await commitApprovedPrice(
      { updateOpportunity, saveApprovedPriceSnapshot },
      {
        companyId: company.id,
        opportunityId: opportunity.id,
        snapshot: persistentSnapshot,
        opportunityPricePatch: {
          price_stand_type:
            result.appliedInput
              .standType,
          price_stand_area_sqm:
            result.appliedInput
              .standAreaSqm,
          price_location_surcharge_type:
            result.appliedInput
              .standLocationType,
          price_currency:
            result.currency,
          price_base_amount:
            result.sqmAmount,
          price_location_surcharge_amount:
            result.locationSurcharge,
          price_registration_fee:
            result.registrationFee,
          price_service_fee:
            result.serviceFee,
          price_subtotal:
            result.subtotal,
          price_vat_rate:
            result.appliedInput
              .vatRate ?? null,
          price_vat_amount:
            result.vatAmount,
          price_grand_total:
            result.grandTotal,
          price_calculated_at: approvedAt,
          // Kritik Akış Düzeltmesi 1 — a payment plan is entered against
          // a specific approved price/teklif. The moment a *new* price
          // snapshot is approved for this opportunity (this exact write),
          // any payment_plan left over from the previous teklif no longer
          // corresponds to the new figures, so it must not silently carry
          // forward into the next contract. Stand materials/extra
          // information are opportunity-level facts (not tied to a price
          // snapshot) and are deliberately left untouched here.
          payment_plan: null,
        },
        onPersisted: (snapshot) => {
          setApprovedPrices((current) => ({
            ...current,
            [key]: snapshot,
          }));
        },
      },
    );

    if (!persistResult.success) {
      console.error(
        "Opportunity price persistence error:",
        persistResult.error,
      );

      showToast(
        "Fiyat onaylandı ancak fırsat kaydına yazılamadı.",
        "error",
      );

      return;
    }

    // Sprint 22.9.9 (Part 1) — a backward transition (e.g. re-approving
    // a price after the opportunity already moved on to
    // "quotation-sent" or "signed") is skipped silently: the price
    // fields above are still saved, just without also claiming a stage
    // change that would actually regress the pipeline.
    if (
      !isForwardStageTransition(
        opportunity.stage,
        PRICE_APPROVED_STAGE,
      )
    ) {
      showToast(
        "Fiyat onaylandı.",
        "success",
      );

      return;
    }

    let stageWriteSucceeded = false;

    try {
      await updateOpportunity(
        opportunity.id,
        { stage: PRICE_APPROVED_STAGE },
      );

      stageWriteSucceeded = true;
    } catch (stageError) {
      console.error(
        "Opportunity stage update error:",
        stageError,
      );

      showToast(
        "Fiyat kaydedildi ancak fırsat aşaması güncellenemedi.",
        "error",
      );
    }

    if (stageWriteSucceeded) {
      const refreshed =
        await refreshWorkspaceSafely();

      showToast(
        `Fiyat onaylandı ve fırsat aşaması "${getBusinessStatusLabel(
          PRICE_APPROVED_STAGE,
        )}" olarak güncellendi.` +
          (refreshed
            ? ""
            : REFRESH_WARNING_SUFFIX),
        "success",
      );
    }
  }

  async function handlePriceCalculated(
    result: PriceResult,
    meta: PriceCalculatedMeta,
  ): Promise<void> {
    if (isOpportunityClosed) {
      showToast(closedOpportunityReason!, "error");

      return;
    }

    if (!selectedOpportunity) {
      // Sprint 25.2/25.3 — no real opportunity exists for this fuar yet.
      // Held only in this fuar's Exhibition Session draft instead of
      // creating an opportunity just from calculating a price — that
      // only happens deliberately, via "Görüşmeyi Tamamla" (the Commit
      // Engine), which then applies this exact result via
      // applyPriceToOpportunity.
      updateActiveSessionDraft({ priceResult: { result, meta } });

      showToast(
        "Fiyat hesaplandı. Görüşme tamamlandığında fırsatla ilişkilendirilecek.",
        "success",
      );

      return;
    }

    await applyPriceToOpportunity(
      selectedOpportunity,
      result,
      meta,
    );
  }

  async function handleCreateProposal(): Promise<void> {
    if (isOpportunityClosed) {
      showToast(closedOpportunityReason!, "error");

      return;
    }

    if (!selectedSidebarExhibition) {
      showToast(
        "Seçili fuar için onaylanmış fiyat bulunamadı.",
        "error",
      );

      setPriceCalculatorOpenRequestId(
        (currentId) => currentId + 1,
      );

      return;
    }

    const key = approvedPriceKey(
      activeOpportunity.id,
      selectedSidebarExhibition.id,
    );

    // A locally-cached "approved" entry is only ever a hint (see
    // reconcileApprovedPrice) — it is never trusted on its own here. The
    // persistent approved_price_snapshots row is confirmed first, and
    // local state is overwritten or cleared to match it.
    const reconciled = await reconcileApprovedPrice(
      { loadPersistentSnapshot: getApprovedPriceSnapshot },
      {
        opportunityId: activeOpportunity.id,
        exhibitionId: selectedSidebarExhibition.id,
      },
    );

    if (!reconciled.approved) {
      setApprovedPrices((current) => {
        if (!(key in current)) {
          return current;
        }

        const next = { ...current };
        delete next[key];
        return next;
      });

      showToast(
        "Seçili fuar için onaylanmış fiyat bulunamadı.",
        "error",
      );

      setPriceCalculatorOpenRequestId(
        (currentId) => currentId + 1,
      );

      return;
    }

    const approvedPrice = reconciled.snapshot;

    setApprovedPrices((current) => ({
      ...current,
      [key]: approvedPrice,
    }));

    const priceResult =
      approvedPrice.priceResult;

    setContractDraft(
      buildContractDraft({
        company,
        contacts,
        sidebarExhibition:
          selectedSidebarExhibition,
        opportunityId:
          activeOpportunity.id,
        priceResult,
      }),
    );

    setContractDraftSnapshot(
      approvedPrice,
    );

    const proposalInput: ProposalInput =
      {
        companyId: company.id,
        companyName:
          company.company_name,
        exhibitionId:
          selectedSidebarExhibition.id,
        exhibitionName:
          selectedSidebarExhibition.name,
        standType:
          priceResult.appliedInput
            .standType,
        standLocationType:
          priceResult.appliedInput
            .standLocationType,
        standAreaSqm:
          priceResult.appliedInput
            .standAreaSqm,
        priceResult,
        validityDate:
          getProposalValidityDate(),
        paymentTerms:
          DEFAULT_PROPOSAL_PAYMENT_TERMS,
        representativeName:
          activeWorkspace.opportunity
            .owner,
      };

    try {
      const proposal =
        runProposalEngine(
          proposalInput,
        );

      // Kept for compatibility (unchanged existing pipeline — see
      // report) but no longer the modal actually shown: "Sözleşme
      // Hazırla" now opens the Document Engine's real A4/PDF preview
      // below instead of this data-check-only preview.
      setProposalPreview(proposal);
    } catch (proposalError) {
      console.error(
        "Proposal generation error:",
        proposalError,
      );

      setProposalPreview(null);
    }

    setIsContractPreviewOpen(true);
  }

  // BUG-S26-001.3 — the ONE way a contract PDF is created: calls the
  // already production-verified Document Service (server-side DOCX
  // generation, LibreOffice PDF conversion, PDF validation, Storage
  // upload — see contractPdfService.ts). No print step, no manual file
  // re-selection. ContractPreviewModal's "Sözleşme PDF'i Oluştur" button
  // calls this directly and awaits the result — the modal only closes
  // once this has actually created the record; any failure leaves the
  // modal open, with a clean (never raw/technical) message, so the user
  // can retry without redoing anything.
  async function handleGenerateContractPdf(
    base: Omit<
      GeneratedDocumentRecord,
      "status" | "createdAt"
    >,
  ): Promise<
    | { success: true }
    | { success: false; message: string }
  > {
    // Defensive dedup: don't create a second record or a second
    // timeline entry for the same contract version on a retry.
    const isDuplicate = generatedDocuments.some(
      (existing) =>
        existing.companyId ===
          base.companyId &&
        (existing.opportunityId ?? null) ===
          (base.opportunityId ?? null) &&
        existing.exhibitionId ===
          base.exhibitionId &&
        existing.contractNumber ===
          base.contractNumber &&
        existing.version === base.version,
    );

    if (isDuplicate) {
      showToast(
        "Bu sözleşme sürümü zaten kaydedilmiş.",
        "info",
      );

      return { success: true };
    }

    if (!user || !session?.access_token) {
      return {
        success: false,
        message:
          "Oturum bulunamadı, sözleşme oluşturulamadı.",
      };
    }

    if (!base.opportunityId) {
      return {
        success: false,
        message:
          "Sözleşme için bir fırsat gereklidir.",
      };
    }

    const generated = await requestContractPdf({
      accessToken: session.access_token,
      companyId: base.companyId,
      opportunityId: base.opportunityId,
    });

    if (!generated.ok) {
      console.error(
        "Contract PDF generation error:",
        generated.code,
        generated.message,
      );

      return {
        success: false,
        message:
          describeContractPdfFailure(
            generated,
          ),
      };
    }

    // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.8] PDF RESPONSE RECEIVED",
      {
        fileName: generated.fileName,
        pdfBlobSize: generated.pdfBlob.size,
        companyId: base.companyId,
        opportunityId:
          base.opportunityId ?? null,
        exhibitionId: base.exhibitionId,
        contractNumber:
          base.contractNumber,
        version: base.version,
      },
    );

    let storagePath: string;
    let pdfDataUrl: string;

    try {
      const documentRecordId =
        await computeContractPdfDocumentRecordId(
          base.companyId,
          base.opportunityId,
          base.approvedSnapshotId,
        );

      storagePath =
        buildContractPdfStoragePath(
          user.id,
          base.companyId,
          documentRecordId,
          generated.fileName,
        );

      pdfDataUrl = await readBlobAsDataUrl(
        generated.pdfBlob,
      );
    } catch (identityError) {
      console.error(
        "Contract PDF storage identity error:",
        identityError,
      );

      return {
        success: false,
        message:
          "Sözleşme PDF'i oluşturuldu ancak kaydedilemedi. Lütfen tekrar deneyin.",
      };
    }

    const record: GeneratedDocumentRecord = {
      ...base,
      fileName: generated.fileName,
      status: "pdf-generated",
      createdAt: new Date().toISOString(),
      storageBucket: "contract-documents",
      storagePath,
      storageUploadedAt:
        new Date().toISOString(),
      storageSize:
        generated.pdfBlob.size,
      storageMimeType: "application/pdf",
      pdfDataUrl,
    };

    // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.8] GENERATED RECORD CREATED",
      summarizeGeneratedDocumentForDiagnostics(
        record,
      ),
    );

    setGeneratedDocuments((current) => {
      // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.8] SET GENERATED DOCUMENTS",
        {
          previousCount: current.length,
          nextCount: current.length + 1,
          addingRecordId: record.id,
          previousRecordIds: current.map(
            (existing) => existing.id,
          ),
        },
      );

      return [...current, record];
    });

    try {
      await createTimelineEvent({
        company_id: company.id,
        opportunity_id:
          record.opportunityId ?? null,
        type: "contract-generated",
        title:
          "Katılım sözleşmesi oluşturuldu",
        description: `Sözleşme No: ${record.contractNumber} · Fuar: ${
          selectedSidebarExhibition?.name ??
          "—"
        } · Dosya: ${record.fileName} · Versiyon: v${record.version} · Oluşturulma: ${formatWorkspaceDate(
          record.createdAt,
        )}`,
      });

      await onRefresh();
    } catch (timelineError) {
      console.error(
        "Contract document timeline error:",
        timelineError,
      );

      showToast(
        "Sözleşme oluşturuldu ancak zaman çizelgesine eklenemedi.",
        "error",
      );

      return { success: true };
    }

    // Sprint 22.9.2 — the proposal/contract PDF is already generated and
    // persisted by this point (Document Service upload + document record
    // above), so a failure here only concerns the stage field, not the
    // proposal itself, and is reported as its own, separate warning
    // rather than rolled into (or hidden behind) the generation success
    // above.
    const PROPOSAL_READY_STAGE: OpportunityStage =
      "proposal-ready";

    // Sprint 22.9.9 (Part 1) — a backward transition (e.g. regenerating
    // a document for an opportunity already at "quotation-sent" or
    // "signed") is skipped silently: the PDF/document record above is
    // still fully saved, just without also claiming a stage change
    // that would actually regress the pipeline.
    if (
      !isForwardStageTransition(
        activeOpportunity.stage,
        PROPOSAL_READY_STAGE,
      )
    ) {
      showToast(
        "Sözleşme PDF'i oluşturuldu ve VIAWA'ya kaydedildi.",
        "success",
      );

      return { success: true };
    }

    let stageWriteSucceeded = false;

    try {
      await updateOpportunity(
        activeOpportunity.id,
        { stage: PROPOSAL_READY_STAGE },
      );

      stageWriteSucceeded = true;
    } catch (stageError) {
      console.error(
        "Opportunity stage update error (proposal-ready):",
        stageError,
      );

      showToast(
        "Sözleşme oluşturuldu ancak fırsat aşaması güncellenemedi.",
        "error",
      );
    }

    if (stageWriteSucceeded) {
      const refreshed =
        await refreshWorkspaceSafely();

      showToast(
        `Sözleşme PDF olarak oluşturuldu ve fırsat aşaması "${getBusinessStatusLabel(
          PROPOSAL_READY_STAGE,
        )}" olarak güncellendi.` +
          (refreshed
            ? ""
            : REFRESH_WARNING_SUFFIX),
        "success",
      );
    }

    return { success: true };
  }

  // SPRINT 26.2.1 — called from exactly one place: the Workspace Email
  // "Sözleşme Gönder" flow (useWorkspaceEmailDraft's Contract-send branch,
  // via handleSendContractForSignature below), which now AWAITS this
  // result instead of firing it and forgetting it — the panel only
  // closes and only records the mail event once this actually resolves
  // success. Returns a structured result instead of showing its own
  // toast (Sprint 26.2 and earlier had it toast directly; the caller now
  // owns the exact contract-specific wording) — every message returned
  // here is already a clean, non-technical Turkish sentence, never a raw
  // error. Calls the real dropbox-sign-send Edge Function (Sprint
  // 21.8/21.8.1) via dropboxSignService — its own state/timeline
  // side effects are otherwise unchanged from Sprint 26.2.
  async function handleSendForSignature(
    record: GeneratedDocumentRecord,
  ): Promise<
    | {
        success: true;
        updatedRecord: GeneratedDocumentRecord;
      }
    | { success: false; message: string }
  > {
    if (
      sendingSignatureIds.has(
        record.id,
      )
    ) {
      return {
        success: false,
        message:
          "Bu sözleşme için bir imza isteği zaten işleniyor.",
      };
    }

    // Defense in depth — whichever caller eventually invokes this
    // should already only do so for "pdf-generated" documents, but
    // don't rely on that alone: a second real Dropbox Sign send would
    // create a duplicate, real signature request. Already having a
    // signatureRequestId is treated as success (idempotent retry), not
    // failure — nothing new needs to happen.
    if (record.signatureRequestId) {
      return { success: true, updatedRecord: record };
    }

    if (record.status !== "pdf-generated") {
      return {
        success: false,
        message:
          "Bu belge şu anda imzaya gönderilebilir durumda değil.",
      };
    }

    if (
      record.storageBucket !==
        "contract-documents" ||
      !record.storagePath?.trim() ||
      record.storageMimeType !==
        "application/pdf" ||
      !record.storageSize ||
      record.storageSize <= 0
    ) {
      return {
        success: false,
        message:
          "Bu sözleşmenin güvenli PDF kaydı bulunamadı.",
      };
    }

    // The Dropbox Sign signer — sourced from this company's own
    // signatory contact (is_signatory), same concept the contract
    // template itself already uses (see buildContractDraft.ts).
    // GeneratedDocumentRecord has no signer fields of its own.
    const signatoryContact =
      contacts.find(
        (contact) =>
          contact.is_signatory,
      );

    const signerName = [
      signatoryContact?.first_name,
      signatoryContact?.last_name,
    ]
      .filter((part) =>
        Boolean(part?.trim()),
      )
      .join(" ")
      .trim();

    const signerEmail =
      signatoryContact?.email?.trim() ??
      "";

    if (!signerName || !signerEmail) {
      return {
        success: false,
        message:
          "Firma için imza yetkilisi (ad ve e-posta) tanımlı değil.",
      };
    }

    setSendingSignatureIds(
      (current) =>
        new Set(current).add(
          record.id,
        ),
    );

    try {
      const updatedRecord =
        await sendForSignature(record, {
          name: signerName,
          email: signerEmail,
        });

      setGeneratedDocuments(
        (current) =>
          current.map(
            (existing) =>
              existing.id ===
              record.id
                ? updatedRecord
                : existing,
          ),
      );

      try {
        await createTimelineEvent({
          company_id: company.id,
          opportunity_id:
            record.opportunityId ?? null,
          type: "contract-sent",
          title:
            "Sözleşme imzaya gönderildi",
          description: `Sözleşme No: ${record.contractNumber} · Versiyon: v${record.version} · Sağlayıcı: Dropbox Sign`,
        });
      } catch (timelineError) {
        // Non-fatal — the real, unrepeatable side effect (the actual
        // Dropbox Sign request) already succeeded; a missing timeline
        // entry doesn't need to (and can't safely) roll that back. Only
        // logged, never shown as a failure to the user.
        console.error(
          "Contract sent timeline error:",
          timelineError,
        );
      }

      return { success: true, updatedRecord };
    } catch (sendError) {
      console.error(
        "Send for signature error:",
        sendError,
      );

      const message =
        sendError instanceof
        MissingAuthSessionError
          ? "Oturum bulunamadı. Lütfen tekrar giriş yapın."
          : sendError instanceof Error &&
              sendError.message
            ? sendError.message
            : "İmza daveti gönderilemedi. Lütfen tekrar deneyin.";

      return { success: false, message };
    } finally {
      setSendingSignatureIds(
        (current) => {
          const next = new Set(
            current,
          );

          next.delete(record.id);

          return next;
        },
      );
    }
  }

  // SPRINT 26.2.1 — the one entry point Workspace Email's "Sözleşme
  // Gönder" calls (via useWorkspaceEmailDraft's onSendContractForSignature
  // prop). Shows the "gönderiliyor" toast (CustomerWorkspace already owns
  // toasting for everything contract-related) right before the real
  // network call, then hands back handleSendForSignature's result
  // unchanged — the caller (the email send flow) decides what happens
  // next (write the mail record and close, or keep the panel/draft).
  async function handleSendContractForSignature(
    record: GeneratedDocumentRecord,
  ): Promise<
    | { success: true; testMode: boolean }
    | { success: false; message: string }
  > {
    showToast(
      "Sözleşme imzaya gönderiliyor…",
      "info",
    );

    const result =
      await handleSendForSignature(record);

    // SPRINT 26.2.2 — fail-safe default true if the field is somehow
    // absent (matches dropboxSignService.ts's own parsing default):
    // never claim a binding send happened when it's actually unknown.
    return result.success
      ? {
          success: true,
          testMode:
            result.updatedRecord
              .signatureTestMode ?? true,
        }
      : result;
  }

  // Sprint 22.9.6 — there is no real Dropbox Sign webhook/status-sync
  // path in this codebase (dropboxSignService.ts's getSignatureStatus/
  // downloadSignedPdf/cancelSignatureRequest are all unimplemented
  // stubs; only sendForSignature is real). This manual upload —
  // confirmed, single external customer signer, no internal
  // countersignature expected — is therefore the one and only place
  // that ever observes "the customer has completed signing," so it is
  // reused as the authoritative completion signal rather than adding a
  // second, parallel one.
  const CUSTOMER_SIGNED_WON_STAGE: OpportunityStage =
    "signed";

  // Sprint 22.9.7 — exactly one timeline event for the customer
  // signature completion + won-stage transition (previously this fired
  // two: "contract-signed" and "opportunity-won"). The type also
  // doubles as the dedup key a retry checks before inserting again.
  const CUSTOMER_SIGNATURE_TIMELINE_TYPE =
    "customer-signature-completed";
  const CUSTOMER_SIGNATURE_TIMELINE_DESCRIPTION =
    "Müşteri imzası tamamlandı. Sözleşme yürürlüğe girdi.";

  async function hasCustomerSignatureTimelineEvent(
    opportunityId: string,
  ): Promise<boolean> {
    const events =
      await getTimelineEventsByCompany(
        company.id,
      );

    return events.some(
      (event) =>
        event.opportunity_id ===
          opportunityId &&
        event.type ===
          CUSTOMER_SIGNATURE_TIMELINE_TYPE,
    );
  }

  // The Opportunity side of a completed customer signature, kept
  // separate from "mark the document as signed" (below) so it can be
  // retried on its own. Both the stage and the timeline record are
  // checked and repaired independently — the stage already reading
  // "signed" is NOT by itself a reason to stop, since the timeline
  // record may still be missing from an earlier partial failure (and
  // vice versa). Only once BOTH are confirmed already in place does
  // this do nothing.
  async function completeCustomerSignatureWonTransition(
    opportunityId: string,
  ): Promise<void> {
    let opportunityRecord;

    try {
      opportunityRecord =
        await getOpportunity(
          opportunityId,
        );
    } catch (lookupError) {
      console.error(
        "Opportunity stage lookup error:",
        lookupError,
      );

      showToast(
        "Sözleşme imzalandı ancak fırsat aşaması doğrulanamadı.",
        "error",
      );

      return;
    }

    // Kritik Akış Düzeltmesi 5 — "İmzalar Tamamlandı" is one of the four
    // ways an opportunity reaches a terminal stage (alongside Won, Lost,
    // and Firma Sayfası "İptal"), so it must close out this opportunity's
    // open reminders exactly like the other three — same shared helper,
    // called unconditionally (idempotent: a retry after stage/timeline
    // already succeeded still safely no-ops on already-completed
    // reminders). Its own failure never blocks the stage/timeline repair
    // below.
    try {
      await completeOpenRemindersForOpportunity(
        opportunityId,
      );
    } catch (reminderError) {
      console.error(
        "Opportunity reminder close-out error:",
        reminderError,
      );
    }

    const stageAlreadySigned =
      opportunityRecord?.stage ===
      CUSTOMER_SIGNED_WON_STAGE;

    let timelineAlreadyRecorded = false;
    let timelineLookupFailed = false;

    try {
      timelineAlreadyRecorded =
        await hasCustomerSignatureTimelineEvent(
          opportunityId,
        );
    } catch (lookupError) {
      console.error(
        "Customer signature timeline lookup error:",
        lookupError,
      );

      // Can't confirm either way — treated as "not yet repaired" below
      // (not as "already recorded"), so this never blocks the stage
      // repair, and the timeline insert itself is skipped rather than
      // risking a duplicate from an unconfirmed lookup. Safe to retry.
      timelineLookupFailed = true;
    }

    // Sprint 22.9.9 (Part 1) — a backward transition (the Opportunity
    // is already further along than "signed" — e.g. "lost") is skipped
    // silently, exactly like the "already signed" case above: neither
    // is treated as a failure, and both simply skip the write.
    const shouldAttemptStageWrite =
      !stageAlreadySigned &&
      isForwardStageTransition(
        opportunityRecord?.stage,
        CUSTOMER_SIGNED_WON_STAGE,
      );

    let stageRepaired = false;
    let stageFailed = false;

    if (shouldAttemptStageWrite) {
      try {
        await updateOpportunity(
          opportunityId,
          {
            stage: CUSTOMER_SIGNED_WON_STAGE,
          },
        );

        stageRepaired = true;
      } catch (stageError) {
        console.error(
          "Opportunity won-stage update error:",
          stageError,
        );

        stageFailed = true;
      }
    }

    let timelineRepaired = false;
    let timelineFailed = false;

    if (
      !timelineAlreadyRecorded &&
      !timelineLookupFailed
    ) {
      try {
        await createTimelineEvent({
          company_id: company.id,
          opportunity_id: opportunityId,
          type: CUSTOMER_SIGNATURE_TIMELINE_TYPE,
          title: "Sözleşme imzalandı",
          description:
            CUSTOMER_SIGNATURE_TIMELINE_DESCRIPTION,
        });

        timelineRepaired = true;
      } catch (timelineError) {
        console.error(
          "Customer signature timeline error:",
          timelineError,
        );

        timelineFailed = true;
      }
    } else if (timelineLookupFailed) {
      timelineFailed = true;
    }

    // Sprint 22.9.9 (Part 2/3) — refresh is isolated from the
    // stage/timeline outcomes above: it's awaited and explicitly
    // handled by refreshWorkspaceSafely (never an unhandled rejection),
    // and a refresh failure only ever softens a SUCCESS message below —
    // it never turns into (or hides behind) a false "update failed".
    let refreshed = true;

    if (stageRepaired || timelineRepaired) {
      refreshed = await refreshWorkspaceSafely();
    }

    // Stage and timeline are reported together but never let one
    // outcome hide the other — a failure on either side is always
    // surfaced, and success is only claimed for what actually ran.
    if (stageFailed && timelineFailed) {
      showToast(
        "Sözleşme imzalandı ancak fırsat aşaması ve zaman çizelgesi güncellenemedi.",
        "error",
      );
    } else if (stageFailed) {
      showToast(
        "Sözleşme imzalandı ancak fırsat aşaması güncellenemedi.",
        "error",
      );
    } else if (timelineFailed) {
      showToast(
        "Fırsat aşaması güncellendi ancak zaman çizelgesine eklenemedi.",
        "error",
      );
    } else if (stageRepaired && timelineRepaired) {
      showToast(
        `Sözleşme imzalandı ve fırsat aşaması "${getBusinessStatusLabel(
          CUSTOMER_SIGNED_WON_STAGE,
        )}" olarak güncellendi.` +
          (refreshed
            ? ""
            : REFRESH_WARNING_SUFFIX),
        "success",
      );
    } else if (stageRepaired) {
      showToast(
        `Fırsat aşaması "${getBusinessStatusLabel(
          CUSTOMER_SIGNED_WON_STAGE,
        )}" olarak güncellendi.` +
          (refreshed
            ? ""
            : REFRESH_WARNING_SUFFIX),
        "success",
      );
    } else if (timelineRepaired) {
      showToast(
        "Müşteri imza kaydı zaman çizelgesine eklendi." +
          (refreshed
            ? ""
            : REFRESH_WARNING_SUFFIX),
        "success",
      );
    }
    // else: both already complete (or the only outstanding write was a
    // backward transition) — no toast.
  }

  // RC-01 — the one function that ever transitions a document to status
  // "signed". Manual this sprint (no Zoho/Adobe/Dropbox Sign, no
  // webhook/API — see the sprint's own locked product decision): the
  // rep gets the signed PDF back over Outlook and uploads it here. Two
  // real UI triggers now share this exact same function, both through
  // the single participationConfirmationTarget modal above: "Sözleşme
  // Hazırla"'s own "🟢 Katılım Onaylandı" button, and "Görüşmeyi
  // Tamamla" → "Kazanıldı" (handleCallResultWon).
  function handleSignedPdfUploaded(
    record: GeneratedDocumentRecord,
    file: File,
  ): void {

    // Repair entry point — a stale closure or a second invocation must
    // not re-read the PDF or re-run the document-signed state change.
    // It DOES still retry the Opportunity transition if that part
    // didn't complete last time — see completeCustomerSignatureWonTransition.
    if (record.status === "signed") {
      if (record.opportunityId) {
        void completeCustomerSignatureWonTransition(
          record.opportunityId,
        );
      }

      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      showToast(
        "İmzalı PDF okunamadı.",
        "error",
      );
    };

    reader.onload = () => {
      const signedPdfDataUrl =
        typeof reader.result === "string"
          ? reader.result
          : null;

      if (!signedPdfDataUrl) {
        showToast(
          "İmzalı PDF okunamadı.",
          "error",
        );

        return;
      }

      setGeneratedDocuments((current) =>
        current.map((existing) =>
          existing.id === record.id
            ? {
                ...existing,
                status: "signed",
                signedPdfDataUrl,
                signedPdfFileName:
                  file.name,
                signatureCompletedAt:
                  new Date().toISOString(),
              }
            : existing,
        ),
      );

      // TODO: Fairy tetikleyici noktası — sözleşme imzalandığında Fairy'ye
      // bildirim gönderilecek (animasyon bu sprintte kapsam dışı).

      if (!record.opportunityId) {
        showToast(
          "İmzalı PDF yüklendi, sözleşme imzalandı olarak işaretlendi.",
          "success",
        );

        return;
      }

      void completeCustomerSignatureWonTransition(
        record.opportunityId,
      );
    };

    reader.readAsDataURL(file);
  }

  function handleCloseContractPreview(): void {
    setIsContractPreviewOpen(false);
  }

  function handleEditCompanyInfo(): void {
    setIsContractPreviewOpen(false);
    navigate(
      `/companies/${encodeURIComponent(
        company.id,
      )}`,
    );
  }

  // Sprint 25.8 — Stand Malzemeleri / Ekstra Malzeme persistence. Follows
  // the same write-then-refresh pattern as every other opportunity field
  // update in this file (see e.g. handleGenerateContractPdf's stage
  // write above) so activeOpportunity reflects the save the next time
  // the Sözleşme Önizleme modal is reopened.
  async function handleSaveStandDetails(updates: {
    standMaterials: Record<
      string,
      OpportunityStandMaterial
    >;
    extraInformation: string[];
  }): Promise<void> {
    await updateOpportunity(
      activeOpportunity.id,
      {
        stand_materials:
          updates.standMaterials,
        extra_information:
          updates.extraInformation,
      },
    );

    await refreshWorkspaceSafely();
  }

  // Sprint 25.8 / Adım 2 — Ödeme Planı persistence. Same write-then-
  // refresh pattern as handleSaveStandDetails just above.
  async function handleSavePaymentPlan(
    paymentPlan: OpportunityPaymentPlanItem[],
  ): Promise<void> {
    await updateOpportunity(
      activeOpportunity.id,
      { payment_plan: paymentPlan },
    );

    await refreshWorkspaceSafely();
  }

  function handleSalesKitToolSelect(
    toolId: SalesToolId,
  ): void {
    if (toolId === "document-basket") {
      setIsDocumentBasketOpen(true);

      return;
    }

    if (toolId === "contract-template") {
      setIsContractTemplateOpen(true);

      return;
    }

    if (toolId === "email") {
      handleOpenEmailTool();

      return;
    }

    if (toolId !== "quotation") {
      return;
    }

    void handleCreateProposal();
  }

  function handleCloseDocumentBasket(): void {
    setIsDocumentBasketOpen(false);
  }

  function handleCloseContractTemplate(): void {
    setIsContractTemplateOpen(false);
  }

  // Sprint 25.4B Section A.3 — "handleSendProposalViaCommunication,
  // paneli Quotation ... şablonuyla açar." No longer navigates to
  // /communication at all; opens the same Workspace Email Panel as the
  // other two entry points, pre-selected to the Quotation template.
  function handleSendProposalViaCommunication(): void {
    setIsProposalPreviewOpen(false);
    openWorkspaceEmailPanel("Quotation");
  }

  function handleCloseProposalPreview(): void {
    setIsProposalPreviewOpen(false);
  }

  // Sprint 25.2.1/25.3 — extracted so commitWorkspaceSession can apply a
  // pending draftNextActivity to a real, already-resolved opportunity.
  // Never calls ensureActiveOpportunity itself and is never called from
  // handleSaveManualFollowUp — only from the Commit Engine, after the
  // opportunity already exists.
  async function applyNextActivityToOpportunity(
    opportunity: Opportunity,
    selection: ManualFollowUpSelection,
  ): Promise<void> {
    const { reminder, created } =
      await createActiveReminderIfAbsent({
        companyId: company.id,
        opportunityId: opportunity.id,
        taskType:
          "manual-opportunity-follow-up",
        title: selection.title,
        dueDate: selection.dueDate,
      });

    if (!created) {
      await updateReminder(reminder.id, {
        title: selection.title,
        due_date: selection.dueDate,
      });
    }

    if (created) try {
      await createTimelineEvent({
        company_id: company.id,
        opportunity_id: opportunity.id,
        type: "reminder-created",
        title:
          "Takip hatırlatıcısı oluşturuldu",
        description: `"${reminder.title}" için ${formatWorkspaceDate(
          reminder.due_date,
        )} tarihinde bir hatırlatıcı oluşturuldu.`,
      });
    } catch (timelineError) {
      console.error(
        "Reminder timeline creation error:",
        timelineError,
      );
    }

    try {
      await updateOpportunity(
        opportunity.id,
        {
          next_action: selection.title,
          next_action_date: selection.dueDate,
        },
      );
    } catch (opportunityMirrorError) {
      console.error(
        "Manual follow-up opportunity mirror error:",
        opportunityMirrorError,
      );

      showToast(
        "Takip kaydedildi ancak fırsat özeti güncellenemedi.",
        "error",
      );
    }
  }

  // Sprint 25.2.1/25.3 — purely local (held in this fuar's Exhibition
  // Session draft) until "Görüşmeyi Tamamla" commits it (see
  // applyNextActivityToOpportunity above, called from
  // commitWorkspaceSession). Never calls ensureActiveOpportunity and
  // never writes a reminder/timeline/opportunity row on its own —
  // picking a follow-up time mid-call must not, by itself, create an
  // opportunity or any other permanent record.
  async function handleSaveManualFollowUp(
    selection: ManualFollowUpSelection,
  ): Promise<void> {
    if (isOpportunityClosed) {
      showToast(closedOpportunityReason!, "error");

      return;
    }

    updateActiveSessionDraft({
      nextActivity: selection,
    });

    showToast(
      "Sonraki aktivite seçildi. Görüşme tamamlandığında kaydedilecek.",
      "success",
    );
  }

  return (
    <>
      <section className="sw-workspace-grid">
        <div className="sw-left-half">
          {exhibitionRepositoryPanel}
        </div>

        <section className="sw-main-column">
          {!selectedSidebarExhibition ? (
            <p className="muted sw-draft-opportunity-note">
              Devam etmek için sidebar'dan bir fuar seçin.
            </p>
          ) : isDraftOpportunity ? (
            <p className="muted sw-draft-opportunity-note">
              Bu fuar için henüz kayıtlı fırsat yok. Görüşme tamamlandığında oluşturulacak.
            </p>
          ) : null}

          {/* Kritik Akış Düzeltmesi 6 — a terminal (Kaybedildi/İmzalar
              Tamamlandı) opportunity's live work area (fuar/stand/m²/
              fiyat/not/sonraki aktivite + Fiyat Hesapla/Sözleşme Hazırla/
              E-posta/Takip Et — all of it lives inside LiveInteraction,
              see its own `workspace` prop) must never render as if work
              were still ongoing. isOpportunityClosed already exists
              (unchanged — still based on viewedOpportunity, see its own
              note above) and already gates every write path; this is
              the one missing piece — using that same flag to swap the
              live work area for a plain closed-state notice instead of
              LiveInteraction. selectedOpportunity (used elsewhere for
              the Commit Engine's reuse/create decision, and — via
              resolveSessionOpportunity's own active-first preference —
              already resolves to another active opportunity for this
              exact fuar when one exists, e.g. BUG-Kritik-2's lost+active
              pair) is untouched. TimelinePanel below is untouched on
              purpose — Timeline is explicitly preserved, not part of
              the "live work area". */}
          {isOpportunityClosed ? (
            <div className="sw-closed-opportunity-notice">
              <h2>
                Bu fırsat tamamlanmıştır.
              </h2>
              <p>
                Bu fuar için aktif çalışma
                bulunmuyor.
              </p>
              <p className="muted">
                Yeni bir fuar fırsatı
                oluşturabilir veya başka bir
                aktif fırsat seçebilirsiniz.
              </p>
              <button
                type="button"
                className="sw-start-new-opportunity-button"
                onClick={() =>
                  void handleStartNewOpportunityFromClosedState()
                }
                disabled={isStartingNewOpportunity}
              >
                {isStartingNewOpportunity
                  ? "Oluşturuluyor..."
                  : "Yeni Fuar Fırsatı Oluştur"}
              </button>
            </div>
          ) : (
            <LiveInteraction
              workspace={activeWorkspace}
            saving={noteSaving}
            draftNote={activeSessionDraft.note}
            onDraftNoteChange={
              handleDraftNoteChange
            }
            onSaveNote={handleSaveNoteDraft}
            onCompleteSession={
              handleCompleteSession
            }
            onQuickAction={
              handleQuickAction
            }
            manualFollowUp={
              draftNextActivity ??
              (activeManualFollowUp
                ? {
                    title: activeManualFollowUp.title,
                    dueDate: activeManualFollowUp.due_date,
                  }
                : null)
            }
            onSaveManualFollowUp={
              handleSaveManualFollowUp
            }
            followUpSaving={
              followUpSaving
            }
            onPriceCalculated={
              handlePriceCalculated
            }
            onSalesToolSelect={
              handleSalesKitToolSelect
            }
            enabledToolIds={
              ENABLED_SALES_TOOL_IDS
            }
            priceCalculatorOpenRequestId={
              priceCalculatorOpenRequestId
            }
            priceCalculatorExhibition={
              selectedSidebarExhibition
            }
            fuarRequiredDisabledReason={
              !selectedSidebarExhibition
                ? FUAR_REQUIRED_DISABLED_MESSAGE
                : null
            }
            quotationDisabledReason={
              isDraftOpportunity
                ? QUOTATION_DISABLED_DRAFT_MESSAGE
                : null
            }
            closedOpportunityReason={
              closedOpportunityReason
            }
            />
          )}

          <TimelinePanel
            conversation={
              activeWorkspace
                .conversationHistory
            }
            workspace={activeWorkspace}
          />
        </section>
      </section>

      <ProposalPreviewModal
        open={isProposalPreviewOpen}
        proposal={proposalPreview}
        contractDraft={contractDraft}
        onClose={
          handleCloseProposalPreview
        }
        onSendViaCommunication={
          handleSendProposalViaCommunication
        }
      />

      <ContractPreviewModal
        open={isContractPreviewOpen}
        contractDraft={contractDraft}
        approvedSnapshot={
          contractDraftSnapshot
        }
        existingRecords={
          generatedDocuments
        }
        standMaterials={
          activeOpportunity.stand_materials ??
          null
        }
        extraInformation={
          activeOpportunity.extra_information ??
          null
        }
        onSaveStandDetails={
          handleSaveStandDetails
        }
        paymentPlan={
          activeOpportunity.payment_plan ??
          null
        }
        onSavePaymentPlan={
          handleSavePaymentPlan
        }
        onClose={
          handleCloseContractPreview
        }
        onGenerate={
          handleGenerateContractPdf
        }
        onEditCompanyInfo={
          handleEditCompanyInfo
        }
        onOpenParticipationConfirmation={
          setParticipationConfirmationTarget
        }
      />

      {participationConfirmationTarget ? (
        <ParticipationConfirmedModal
          submitting={false}
          onClose={() =>
            setParticipationConfirmationTarget(
              null,
            )
          }
          onConfirm={(file) => {
            handleSignedPdfUploaded(
              participationConfirmationTarget,
              file,
            );
            setParticipationConfirmationTarget(
              null,
            );
          }}
        />
      ) : null}

      <DocumentBasketModal
        open={isDocumentBasketOpen}
        onClose={
          handleCloseDocumentBasket
        }
        selectedDocumentIds={
          selectedDocumentBasketIds
        }
        onSelectedDocumentIdsChange={
          setSelectedDocumentBasketIds
        }
        onItemsChange={
          setDocumentBasketItems
        }
      />

      <ContractTemplateModal
        open={isContractTemplateOpen}
        onClose={
          handleCloseContractTemplate
        }
      />

      {isEmailPanelOpen &&
      panelSessionExhibitionId &&
      panelSessionMailDraft ? (
        <WorkspaceEmailPanel
          open={isEmailPanelOpen}
          onClose={closeWorkspaceEmailPanel}
          company={company}
          contacts={contacts}
          resolvedContact={resolvedContact}
          panelSessionExhibitionId={
            panelSessionExhibitionId
          }
          panelSessionExhibitionName={
            panelSessionExhibition?.name ?? "Fuar"
          }
          isSidebarExhibitionMismatched={
            isSidebarExhibitionMismatched
          }
          draft={panelSessionMailDraft}
          onDraftChange={
            handleWorkspaceEmailDraftChange
          }
          onEmailEvent={handleWorkspaceEmailEvent}
          repositoryDocuments={
            exhibitionSelectedDocuments
          }
          draftPriceResult={
            panelSessionDraftPriceResult
          }
          approvedOpportunityPrice={
            panelSessionApprovedPrice
          }
          requestedTemplateId={
            emailPanelRequestedTemplateId
          }
          generatedDocuments={generatedDocuments}
          opportunityId={
            panelSessionOpportunity?.id ?? null
          }
          onSendContractForSignature={
            handleSendContractForSignature
          }
        />
      ) : null}

      {isCloseOpportunityModalOpen ? (
        <CloseOpportunityModal
          onClose={handleCloseCallResultModal}
          onContinue={() =>
            void handleCallResultOngoing()
          }
          onConfirmWon={() => void handleCallResultWon()}
          onConfirmLost={(reasonId, note) =>
            void handleCallResultLost(reasonId, note)
          }
          submitting={closingOpportunity || noteSaving}
        />
      ) : null}
    </>
  );
}
