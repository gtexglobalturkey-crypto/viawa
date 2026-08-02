import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ApprovedPriceSnapshot } from "../../call-workspace/pricing/models/ApprovedPriceSnapshot";
import type { ContractDraftData } from "../../call-workspace/proposal/models/ContractDraftData";
import { buildContractDocumentData } from "../engine/buildContractDocumentData";
import { getOrCreateContractNumber } from "../engine/generateContractNumber";
import {
  generateDocumentFileName,
  getNextDocumentVersion,
} from "../engine/generateDocumentFileName";
import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";
import { ParticipationContractDocument } from "../templates/participation-contract/ParticipationContractDocument";

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
};

export function ContractPreviewModal({
  open,
  contractDraft,
  approvedSnapshot,
  existingRecords,
  onClose,
  onGenerate,
  onEditCompanyInfo,
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

        <div
          className="contract-preview-modal-body"
          style={{
            padding: "16px 22px",
            background: "#e2e8f0",
            overflow: "auto",
          }}
        >
          {preparedDocument ? (
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
