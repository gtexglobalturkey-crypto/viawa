import {
  CheckCircle2,
  FileText,
  FileX2,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { ContractTemplateStatus } from "../model/ContractTemplateStatus";
import {
  fetchContractTemplateStatus,
  openContractTemplate,
} from "../services/contractTemplateApi";

type ContractTemplateModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ContractTemplateModal({
  open,
  onClose,
}: ContractTemplateModalProps) {
  const [status, setStatus] = useState<
    ContractTemplateStatus | null
  >(null);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [opening, setOpening] =
    useState(false);

  const [openError, setOpenError] =
    useState<string | null>(null);

  const [
    openSuccessMessage,
    setOpenSuccessMessage,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    setStatus(null);
    setLoadError(null);
    setOpenError(null);
    setOpenSuccessMessage(null);

    fetchContractTemplateStatus()
      .then((fetchedStatus) => {
        if (!cancelled) {
          setStatus(fetchedStatus);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Sözleşme şablonu durumu alınamadı.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
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
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  async function handleOpenTemplate() {
    if (
      !status?.exists ||
      opening
    ) {
      return;
    }

    setOpening(true);
    setOpenError(null);
    setOpenSuccessMessage(null);

    try {
      await openContractTemplate();

      setOpenSuccessMessage(
        "Şablon açıldı.",
      );
    } catch (error) {
      setOpenError(
        error instanceof Error
          ? error.message
          : "Sözleşme şablonu açılamadı.",
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      className="contract-template-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
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
        className="contract-template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-template-modal-title"
        style={{
          width: "min(480px, 100%)",
          maxHeight:
            "calc(100vh - 48px)",
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
            justifyContent:
              "space-between",
            gap: "20px",
            padding: "22px 24px",
            borderBottom:
              "1px solid #e2e8f0",
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
                textTransform:
                  "uppercase",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FileText size={14} />
              Sözleşme Şablonu
            </p>

            <h2
              id="contract-template-modal-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "20px",
                lineHeight: 1.3,
              }}
            >
              Şablon Önizleme
            </h2>
          </div>

          <button
            type="button"
            aria-label="Sözleşme şablonu penceresini kapat"
            onClick={onClose}
            style={{
              flex: "0 0 auto",
              width: "36px",
              height: "36px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              color: "#334155",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            display: "grid",
            gap: "10px",
            padding: "24px",
          }}
        >
          {loadError ? (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: "10px 12px",
                border:
                  "1px solid #fecaca",
                borderRadius: "10px",
                color: "#b91c1c",
                background: "#fef2f2",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {loadError}
            </p>
          ) : null}

          {openError ? (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: "10px 12px",
                border:
                  "1px solid #fecaca",
                borderRadius: "10px",
                color: "#b91c1c",
                background: "#fef2f2",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {openError}
            </p>
          ) : null}

          {openSuccessMessage ? (
            <p
              role="status"
              style={{
                margin: 0,
                padding: "10px 12px",
                border:
                  "1px solid #bbf7d0",
                borderRadius: "10px",
                color: "#15803d",
                background: "#f0fdf4",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {openSuccessMessage}
            </p>
          ) : null}

          {!status && !loadError ? (
            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              Şablon kontrol ediliyor...
            </p>
          ) : null}

          {status ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "12px",
                width: "100%",
                padding: "12px 14px",
                border:
                  "1px solid #e2e8f0",
                borderRadius: "12px",
                background:
                  status.exists
                    ? "#ffffff"
                    : "#f8fafc",
                opacity: status.exists
                  ? 1
                  : 0.6,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: 0,
                  color: status.exists
                    ? "#0f172a"
                    : "#94a3b8",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {status.exists ? (
                  <CheckCircle2
                    size={16}
                    color="#15803d"
                  />
                ) : (
                  <FileX2
                    size={16}
                    color="#94a3b8"
                  />
                )}

                {status.exists
                  ? status.fileName
                  : "Sözleşme şablonu bulunamadı"}
              </span>

              {status.exists && (
                <button
                  type="button"
                  disabled={opening}
                  onClick={() =>
                    void handleOpenTemplate()
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flex: "0 0 auto",
                    padding: "8px 12px",
                    border: 0,
                    borderRadius: "10px",
                    color: "#ffffff",
                    background: "#991b1b",
                    cursor: opening
                      ? "not-allowed"
                      : "pointer",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {opening && (
                    <Loader2 size={13} />
                  )}

                  {opening
                    ? "Açılıyor..."
                    : "Şablonu Aç"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
