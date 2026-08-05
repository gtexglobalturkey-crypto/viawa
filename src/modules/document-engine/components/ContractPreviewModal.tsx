import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  OpportunityPaymentPlanItem,
  OpportunityStandMaterial,
} from "../../../types/database";
import type { ApprovedPriceSnapshot } from "../../call-workspace/pricing/models/ApprovedPriceSnapshot";
import type { ContractDraftData } from "../../call-workspace/proposal/models/ContractDraftData";
import { buildContractDocumentData } from "../engine/buildContractDocumentData";
import { getOrCreateContractNumber } from "../engine/generateContractNumber";
import {
  generateDocumentFileName,
  getNextDocumentVersion,
} from "../engine/generateDocumentFileName";
import {
  createEmptyPaymentPlanFormState,
  paymentPlanFormStateFromRecord,
  paymentPlanFormStateToRecord,
  sumPaymentPlanFormAmounts,
  updatePaymentPlanRowField,
  type PaymentPlanFormState,
  type PaymentPlanRowField,
} from "../engine/paymentPlanFormState";
import {
  createEmptyStandMaterialsFormState,
  parseExtraInformationLines,
  standMaterialsFormStateFromRecord,
  toggleStandMaterialSelection,
  updateStandMaterialQuantity,
  type StandMaterialsFormState,
} from "../engine/standMaterialsFormState";
import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";
import {
  MATERIAL_KEYS,
  MATERIAL_LABELS,
  QUANTITY_MATERIAL_KEYS,
  type MaterialKey,
} from "../merge/participationContractMapping";
import { ParticipationContractDocument } from "../templates/participation-contract/ParticipationContractDocument";

const QUANTITY_MATERIAL_KEY_SET: ReadonlySet<string> = new Set(
  QUANTITY_MATERIAL_KEYS,
);

// Sprint 25.10 / Adım 2 — same pattern WorkspaceEmailPanel's own
// resolveDownloadFileName already uses, duplicated locally (not
// imported, matching that file's own established precedent) since it's
// only needed here for the preview's "PDF İndir" affordance.
const FALLBACK_CONTRACT_FILE_NAME = "sozlesme.pdf";

function resolveDownloadFileName(
  fileName: string,
): string {
  const trimmed = fileName.trim();

  if (!trimmed) {
    return FALLBACK_CONTRACT_FILE_NAME;
  }

  return /\.pdf$/i.test(trimmed)
    ? trimmed
    : `${trimmed}.pdf`;
}

// RC-02 — display-only preview of the server's own payment-plan-total
// rule (see generateParticipationContract.ts's isCloseEnough/
// PAYMENT_PLAN_AMOUNT_TOLERANCE). Never gates onGenerate itself — the
// button stays enabled and the server remains the single enforcement
// point; this is purely so the user sees the mismatch before submitting.
const PAYMENT_PLAN_SUMMARY_TOLERANCE = 0.01;

function isPaymentPlanTotalClose(
  a: number,
  b: number,
): boolean {
  return Math.abs(a - b) <= PAYMENT_PLAN_SUMMARY_TOLERANCE;
}

function formatPaymentPlanMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function createDocumentId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `document-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

type PendingRecordBase = Omit<
  GeneratedDocumentRecord,
  "status" | "createdAt"
>;

type ContractPreviewModalProps = {
  open: boolean;
  contractDraft: ContractDraftData | null;
  approvedSnapshot: ApprovedPriceSnapshot | null;
  existingRecords: GeneratedDocumentRecord[];
  // Sprint 25.8 — the opportunity's currently-saved Stand Malzemeleri
  // selection/quantities and extra-information note. Read fresh from the
  // opportunity every time the modal opens (never guessed) so reopening
  // it shows exactly what was last saved.
  standMaterials: Readonly<Record<string, OpportunityStandMaterial>> | null;
  extraInformation: readonly string[] | null;
  onSaveStandDetails: (updates: {
    standMaterials: Record<string, OpportunityStandMaterial>;
    extraInformation: string[];
  }) => Promise<void>;
  // Sprint 25.8 / Adım 2 — the opportunity's currently-saved Ödeme
  // Planı (up to 5 independent rows). Same read-fresh-on-open contract
  // as standMaterials/extraInformation above.
  paymentPlan: readonly OpportunityPaymentPlanItem[] | null;
  onSavePaymentPlan: (
    paymentPlan: OpportunityPaymentPlanItem[],
  ) => Promise<void>;
  onClose: () => void;
  // BUG-S26-001.3 — the ONLY way a contract PDF gets created now: the
  // Document Service call (DOCX generation, LibreOffice PDF conversion,
  // validation, Storage upload) happens entirely server-side. Resolves
  // `{ success: true }` once the caller has actually persisted the
  // resulting GeneratedDocumentRecord — the modal closes only then.
  // Resolves `{ success: false, message }` on any failure, so the modal
  // stays open with the same preview and the user can retry without
  // losing anything.
  onGenerate: (
    base: PendingRecordBase,
  ) => Promise<
    | { success: true }
    | { success: false; message: string }
  >;
  onEditCompanyInfo: () => void;
  // RC-01 — "🟢 Katılım Onaylandı": opens the ONE shared "Katılım
  // Onaylandı" modal (owned by CustomerWorkspace now, not this modal —
  // "Görüşmeyi Tamamla → Kazanıldı" opens the exact same modal on the
  // exact same record) against the latest not-yet-signed generated
  // record. Fully manual this sprint (no e-signature provider/webhook).
  onOpenParticipationConfirmation: (
    record: GeneratedDocumentRecord,
  ) => void;
};

export function ContractPreviewModal({
  open,
  contractDraft,
  approvedSnapshot,
  existingRecords,
  standMaterials,
  extraInformation,
  onSaveStandDetails,
  paymentPlan,
  onSavePaymentPlan,
  onClose,
  onGenerate,
  onEditCompanyInfo,
  onOpenParticipationConfirmation,
}: ContractPreviewModalProps) {
  const [isGenerating, setIsGenerating] =
    useState(false);

  const [generateError, setGenerateError] =
    useState<string | null>(null);

  const documentIdRef = useRef<
    string | null
  >(null);

  useEffect(() => {
    if (!open) {
      documentIdRef.current = null;
      setGenerateError(null);
      setIsGenerating(false);
    }
  }, [open]);

  // Sprint 25.8 — Stand Malzemeleri local editing state. Re-seeded from
  // the opportunity's saved values only when the modal transitions to
  // open (not on every prop change) so an in-progress edit is never
  // clobbered by a parent re-render.
  const [materials, setMaterials] =
    useState<StandMaterialsFormState>(
      createEmptyStandMaterialsFormState,
    );
  const [extraInfoText, setExtraInfoText] =
    useState("");
  const [
    standDetailsSaving,
    setStandDetailsSaving,
  ] = useState(false);
  const [
    standDetailsError,
    setStandDetailsError,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMaterials(
      standMaterialsFormStateFromRecord(
        standMaterials,
      ),
    );
    setExtraInfoText(
      (extraInformation ?? [])
        .filter((line) => line && line.trim())
        .join("\n"),
    );
    setStandDetailsError(null);
    // Deliberately only re-seeds on open, not on every standMaterials/
    // extraInformation reference change from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function persistStandDetails(
    nextMaterials: StandMaterialsFormState,
    nextExtraInfoText: string,
  ) {
    setStandDetailsSaving(true);
    setStandDetailsError(null);

    try {
      await onSaveStandDetails({
        standMaterials: nextMaterials,
        extraInformation:
          parseExtraInformationLines(
            nextExtraInfoText,
          ),
      });
    } catch (saveError) {
      console.error(
        "Stand materials save error:",
        saveError,
      );
      setStandDetailsError(
        "Stand malzemeleri kaydedilemedi.",
      );
    } finally {
      setStandDetailsSaving(false);
    }
  }

  function handleToggleMaterial(
    key: MaterialKey,
  ) {
    setMaterials((current) => {
      const next = toggleStandMaterialSelection(
        current,
        key,
      );

      void persistStandDetails(
        next,
        extraInfoText,
      );

      return next;
    });
  }

  function handleQuantityChange(
    key: MaterialKey,
    rawValue: string,
  ) {
    setMaterials((current) =>
      updateStandMaterialQuantity(
        current,
        key,
        rawValue,
      ),
    );
  }

  function handleQuantityBlur() {
    void persistStandDetails(
      materials,
      extraInfoText,
    );
  }

  function handleExtraInfoBlur() {
    void persistStandDetails(
      materials,
      extraInfoText,
    );
  }

  // Sprint 25.8 / Adım 2 — Ödeme Planı local editing state. Same
  // re-seed-only-on-open contract as Stand Malzemeleri above.
  const [paymentPlanRows, setPaymentPlanRows] =
    useState<PaymentPlanFormState>(
      createEmptyPaymentPlanFormState,
    );
  const [
    paymentPlanSaving,
    setPaymentPlanSaving,
  ] = useState(false);
  const [
    paymentPlanError,
    setPaymentPlanError,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPaymentPlanRows(
      paymentPlanFormStateFromRecord(
        paymentPlan,
      ),
    );
    setPaymentPlanError(null);
    // Deliberately only re-seeds on open, not on every paymentPlan
    // reference change from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function persistPaymentPlan(
    nextRows: PaymentPlanFormState,
  ) {
    setPaymentPlanSaving(true);
    setPaymentPlanError(null);

    try {
      await onSavePaymentPlan(
        paymentPlanFormStateToRecord(nextRows),
      );
    } catch (saveError) {
      console.error(
        "Payment plan save error:",
        saveError,
      );
      setPaymentPlanError(
        "Ödeme planı kaydedilemedi.",
      );
    } finally {
      setPaymentPlanSaving(false);
    }
  }

  function handlePaymentPlanFieldChange(
    index: number,
    field: PaymentPlanRowField,
    value: string,
  ) {
    setPaymentPlanRows((current) =>
      updatePaymentPlanRowField(
        current,
        index,
        field,
        value,
      ),
    );
  }

  function handlePaymentPlanFieldBlur() {
    void persistPaymentPlan(paymentPlanRows);
  }

  const paymentPlanRowsTotal = useMemo(
    () => sumPaymentPlanFormAmounts(paymentPlanRows),
    [paymentPlanRows],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      // While a generation request is in flight, Escape must not close
      // the modal out from under it.
      if (
        event.key === "Escape" &&
        !isGenerating
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, onClose, isGenerating]);

  const preparedDocument = useMemo(() => {
    if (!contractDraft || !approvedSnapshot) {
      return null;
    }

    if (!documentIdRef.current) {
      documentIdRef.current =
        createDocumentId();
    }

    const contractNumber =
      getOrCreateContractNumber(
        existingRecords,
        contractDraft.opportunityId,
        contractDraft.exhibition
          .exhibitionId ??
          approvedSnapshot.exhibitionId,
        contractDraft.exhibition.startDate ??
          undefined,
      );

    const version = getNextDocumentVersion(
      existingRecords,
      contractNumber,
    );

    const fileName =
      generateDocumentFileName(
        contractNumber,
        contractDraft.exhibition
          .exhibitionShortName ??
          contractDraft.exhibition
            .exhibitionName,
        contractDraft.company.companyName,
        version,
      );

    const { data, missingFieldLabels } =
      buildContractDocumentData(
        contractDraft,
        approvedSnapshot,
        {
          documentId: documentIdRef.current,
          contractNumber,
          version,
          createdAt:
            new Date().toISOString(),
          status: "draft",
        },
      );

    return {
      data,
      missingFieldLabels,
      fileName,
      contractNumber,
      version,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    contractDraft,
    approvedSnapshot,
    existingRecords,
  ]);

  // Sprint 25.10 / Adım 2 — the actual server-generated PDF (real master
  // DOCX -> Document Engine -> Merge Engine -> LibreOffice, captured as
  // pdfDataUrl at generation time — see GeneratedDocumentRecord) for the
  // highest version already on record for this contract number. This is
  // the exact same pdfDataUrl the Workspace Email Panel's "PDF'i aç" /
  // "PDF İndir" already open/download — reused here, not a second
  // parallel source. Recomputed fresh from the existingRecords prop on
  // every render, so a newly generated version (or the modal being
  // reopened after one) is picked up immediately — no blob/object URL,
  // so nothing to revoke or cache-bust.
  const latestGeneratedRecord = useMemo(() => {
    if (!preparedDocument) {
      return null;
    }

    const candidates = existingRecords.filter(
      (record) =>
        record.contractNumber ===
          preparedDocument.contractNumber &&
        Boolean(record.pdfDataUrl),
    );

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((latest, record) =>
      record.version > latest.version
        ? record
        : latest,
    );
  }, [preparedDocument, existingRecords]);

  if (!open) {
    return null;
  }

  async function handleGeneratePdf() {
    if (
      isGenerating ||
      !preparedDocument ||
      !contractDraft ||
      !approvedSnapshot
    ) {
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    const base: PendingRecordBase = {
      id: preparedDocument.data.document
        .documentId,
      documentType:
        "participation-contract",
      contractNumber:
        preparedDocument.contractNumber,
      version: preparedDocument.version,
      companyId:
        contractDraft.company.companyId,
      exhibitionId:
        contractDraft.exhibition
          .exhibitionId ??
        approvedSnapshot.exhibitionId,
      opportunityId:
        contractDraft.opportunityId,
      approvedSnapshotId:
        preparedDocument.data.pricing
          .approvedSnapshotId,
      fileName: preparedDocument.fileName,
    };

    const result = await onGenerate(base);

    if (result.success) {
      setIsGenerating(false);
      onClose();
      return;
    }

    setGenerateError(result.message);
    setIsGenerating(false);
  }

  return (
    <div
      className="contract-preview-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !isGenerating
        ) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "rgba(15, 23, 42, 0.58)",
        backdropFilter: "blur(4px)",
      }}
    >
      <section
        className="contract-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-preview-modal-title"
        style={{
          width: "min(900px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: "18px",
          background: "#ffffff",
          boxShadow:
            "0 24px 64px rgba(15, 23, 42, 0.24)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "20px",
            padding: "18px 22px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 4px",
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Sözleşme Önizleme
            </p>

            <h2
              id="contract-preview-modal-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "18px",
                lineHeight: 1.3,
              }}
            >
              {preparedDocument
                ? `${preparedDocument.contractNumber} · v${preparedDocument.version}`
                : "Sözleşme verisi hazırlanamadı"}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Sözleşme önizlemesini kapat"
            disabled={isGenerating}
            onClick={onClose}
            style={{
              flex: "0 0 auto",
              width: "34px",
              height: "34px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              color: "#334155",
              background: "#ffffff",
              cursor: isGenerating
                ? "not-allowed"
                : "pointer",
              opacity: isGenerating
                ? 0.5
                : 1,
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        {preparedDocument &&
        preparedDocument.missingFieldLabels
          .length > 0 ? (
          <div
            className="contract-preview-modal-warning"
            role="alert"
            style={{
              margin: "12px 22px 0",
              padding: "10px 14px",
              border: "1px solid #fde68a",
              borderRadius: "10px",
              color: "#78350f",
              background: "#fffbeb",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Eksik bilgiler:{" "}
            {preparedDocument.missingFieldLabels.join(
              ", ",
            )}
            . Sözleşmede bu alanlar boş
            görünecektir.
          </div>
        ) : null}

        {generateError ? (
          <div
            className="contract-preview-modal-warning"
            role="alert"
            style={{
              margin: "12px 22px 0",
              padding: "10px 14px",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              color: "#b91c1c",
              background: "#fef2f2",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {generateError}
          </div>
        ) : null}

        {isGenerating ? (
          <div
            role="alert"
            style={{
              margin: "12px 22px 0",
              padding: "12px 14px",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              color: "#1e3a8a",
              background: "#eff6ff",
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            Sözleşme PDF'i hazırlanıyor…
          </div>
        ) : null}

        <section
          aria-labelledby="stand-materials-title"
          style={{
            margin: "14px 22px 0",
            padding: "14px 16px",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <h3
              id="stand-materials-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              Stand Malzemeleri
            </h3>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: standDetailsError
                  ? "#b91c1c"
                  : "#64748b",
              }}
            >
              {standDetailsError
                ? standDetailsError
                : standDetailsSaving
                  ? "Kaydediliyor…"
                  : "Kaydedildi"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(210px, 1fr))",
              gap: "6px 14px",
              maxHeight: "210px",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {MATERIAL_KEYS.map((key) => {
              const entry = materials[key];
              const hasQuantity =
                QUANTITY_MATERIAL_KEY_SET.has(
                  key,
                );

              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 0",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flex: "1 1 auto",
                      minWidth: 0,
                      color: "#334155",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={entry.selected}
                      onChange={() =>
                        handleToggleMaterial(
                          key,
                        )
                      }
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {MATERIAL_LABELS[key]}
                    </span>
                  </label>

                  {hasQuantity ? (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      disabled={!entry.selected}
                      value={
                        entry.quantity ?? ""
                      }
                      onChange={(event) =>
                        handleQuantityChange(
                          key,
                          event.target.value,
                        )
                      }
                      onBlur={
                        handleQuantityBlur
                      }
                      aria-label={`${MATERIAL_LABELS[key]} adet`}
                      style={{
                        width: "52px",
                        flex: "0 0 auto",
                        height: "26px",
                        padding: "0 6px",
                        border:
                          "1px solid #cbd5e1",
                        borderRadius: "6px",
                        color: "#0f172a",
                        background:
                          entry.selected
                            ? "#ffffff"
                            : "#f1f5f9",
                        fontSize: "12px",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: "52px",
                        flex: "0 0 auto",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <label
            style={{
              display: "grid",
              gap: "5px",
              marginTop: "10px",
            }}
          >
            <span
              style={{
                color: "#334155",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Ekstra Malzeme / Açıklamalar
            </span>

            <textarea
              value={extraInfoText}
              onChange={(event) =>
                setExtraInfoText(
                  event.target.value,
                )
              }
              onBlur={handleExtraInfoBlur}
              placeholder="İsteğe bağlı: ek malzeme, adet veya açıklama yazın"
              rows={2}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                maxHeight: "120px",
                padding: "8px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                color: "#0f172a",
                background: "#ffffff",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            />
          </label>
        </section>

        <section
          aria-labelledby="payment-plan-title"
          style={{
            margin: "10px 22px 0",
            padding: "14px 16px",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <h3
              id="payment-plan-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              Ödeme Planı
            </h3>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: paymentPlanError
                  ? "#b91c1c"
                  : "#64748b",
              }}
            >
              {paymentPlanError
                ? paymentPlanError
                : paymentPlanSaving
                  ? "Kaydediliyor…"
                  : "Kaydedildi"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "28px minmax(110px, 1fr) minmax(90px, 1fr) minmax(160px, 2fr)",
              gap: "6px 10px",
              maxHeight: "220px",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            <span />
            <span
              style={{
                color: "#64748b",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Vade Tarihi
            </span>
            <span
              style={{
                color: "#64748b",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Tutar
            </span>
            <span
              style={{
                color: "#64748b",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Açıklama
            </span>

            {paymentPlanRows.map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div
                key={index}
                style={{
                  display: "contents",
                }}
              >
                <span
                  style={{
                    alignSelf: "center",
                    color: "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {index + 1}
                </span>

                <input
                  type="text"
                  value={row.dueDate}
                  placeholder="GG.AA.YYYY"
                  onChange={(event) =>
                    handlePaymentPlanFieldChange(
                      index,
                      "dueDate",
                      event.target.value,
                    )
                  }
                  onBlur={
                    handlePaymentPlanFieldBlur
                  }
                  aria-label={`${index + 1}. taksit vade tarihi`}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "28px",
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    color: "#0f172a",
                    background: "#ffffff",
                    fontSize: "12px",
                  }}
                />

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.amount}
                  placeholder="0"
                  onChange={(event) =>
                    handlePaymentPlanFieldChange(
                      index,
                      "amount",
                      event.target.value,
                    )
                  }
                  onBlur={
                    handlePaymentPlanFieldBlur
                  }
                  aria-label={`${index + 1}. taksit tutarı`}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "28px",
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    color: "#0f172a",
                    background: "#ffffff",
                    fontSize: "12px",
                  }}
                />

                <input
                  type="text"
                  value={row.payee}
                  placeholder="İsteğe bağlı açıklama"
                  onChange={(event) =>
                    handlePaymentPlanFieldChange(
                      index,
                      "payee",
                      event.target.value,
                    )
                  }
                  onBlur={
                    handlePaymentPlanFieldBlur
                  }
                  aria-label={`${index + 1}. taksit açıklaması`}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "28px",
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    color: "#0f172a",
                    background: "#ffffff",
                    fontSize: "12px",
                  }}
                />
              </div>
            ))}
          </div>

          {approvedSnapshot && (
            <div
              style={{
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            >
              {isPaymentPlanTotalClose(
                paymentPlanRowsTotal,
                approvedSnapshot.priceResult.grandTotal,
              ) ? (
                <span
                  style={{
                    color: "#15803d",
                    fontWeight: 700,
                  }}
                >
                  Ödeme planı doğrulandı.
                </span>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "2px",
                    color: "#0f172a",
                  }}
                >
                  <span>
                    Genel Toplam:{" "}
                    {formatPaymentPlanMoney(
                      approvedSnapshot.priceResult
                        .grandTotal,
                      approvedSnapshot.priceResult
                        .currency,
                    )}
                  </span>
                  <span>
                    Vadeler Toplamı:{" "}
                    {formatPaymentPlanMoney(
                      paymentPlanRowsTotal,
                      approvedSnapshot.priceResult
                        .currency,
                    )}
                  </span>
                  <span
                    style={{
                      color: "#b91c1c",
                      fontWeight: 700,
                    }}
                  >
                    Kalan:{" "}
                    {formatPaymentPlanMoney(
                      approvedSnapshot.priceResult
                        .grandTotal -
                        paymentPlanRowsTotal,
                      approvedSnapshot.priceResult
                        .currency,
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        <div
          className="contract-preview-modal-body"
          style={{
            padding: "16px 22px",
            background: "#e2e8f0",
            overflow: "auto",
          }}
        >
          {preparedDocument && latestGeneratedRecord ? (
            <div>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#166534",
                }}
              >
                Gerçek PDF önizleniyor · Sözleşme No:{" "}
                {latestGeneratedRecord.contractNumber} · v
                {latestGeneratedRecord.version}
              </p>
              <iframe
                src={latestGeneratedRecord.pdfDataUrl}
                title="Sözleşme Önizleme"
                style={{
                  width: "100%",
                  height: "780px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  background: "#ffffff",
                  boxShadow:
                    "0 4px 24px rgba(15, 23, 42, 0.18)",
                }}
              />
            </div>
          ) : preparedDocument ? (
            <div>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#92400e",
                }}
              >
                Yaklaşık önizleme · bu sözleşme için henüz
                gerçek PDF üretilmedi
              </p>
              <div
                style={{
                  transform: "scale(0.86)",
                  transformOrigin: "top center",
                  boxShadow:
                    "0 4px 24px rgba(15, 23, 42, 0.18)",
                }}
              >
                <ParticipationContractDocument
                  data={preparedDocument.data}
                />
              </div>
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                padding: "24px",
                color: "#64748b",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              Sözleşme verisi hazırlanamadı.
              Onaylanmış fiyat veya firma
              bilgisi eksik olabilir.
            </p>
          )}
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "14px 22px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          {latestGeneratedRecord && (
            <a
              href={latestGeneratedRecord.pdfDataUrl}
              download={resolveDownloadFileName(
                latestGeneratedRecord.fileName,
              )}
              style={{
                padding: "10px 16px",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              PDF İndir
            </a>
          )}

          {latestGeneratedRecord &&
          latestGeneratedRecord.status !==
            "signed" ? (
            <button
              type="button"
              disabled={isGenerating}
              onClick={() =>
                onOpenParticipationConfirmation(
                  latestGeneratedRecord,
                )
              }
              style={{
                padding: "10px 16px",
                border: "1px solid #15803d",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#15803d",
                fontSize: "13px",
                fontWeight: 800,
                cursor: isGenerating
                  ? "not-allowed"
                  : "pointer",
                opacity: isGenerating
                  ? 0.5
                  : 1,
              }}
            >
              🟢 Katılım Onaylandı
            </button>
          ) : null}

          <button
            type="button"
            disabled={isGenerating}
            onClick={onEditCompanyInfo}
            style={{
              padding: "10px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 700,
              cursor: isGenerating
                ? "not-allowed"
                : "pointer",
              opacity: isGenerating
                ? 0.5
                : 1,
            }}
          >
            Bilgileri Düzenle
          </button>

          <button
            type="button"
            disabled={isGenerating}
            onClick={onClose}
            style={{
              padding: "10px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 700,
              cursor: isGenerating
                ? "not-allowed"
                : "pointer",
              opacity: isGenerating
                ? 0.5
                : 1,
            }}
          >
            Kapat
          </button>

          <button
            type="button"
            disabled={
              !preparedDocument ||
              isGenerating
            }
            onClick={() =>
              void handleGeneratePdf()
            }
            style={{
              padding: "10px 18px",
              border: 0,
              borderRadius: "10px",
              background: preparedDocument
                ? "#7A0F23"
                : "#94a3b8",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 800,
              cursor:
                !preparedDocument ||
                isGenerating
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {isGenerating
              ? "Hazırlanıyor..."
              : "Sözleşme PDF'i Oluştur"}
          </button>
        </footer>
      </section>
    </div>
  );
}
