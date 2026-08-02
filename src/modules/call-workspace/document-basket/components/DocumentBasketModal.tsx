import {
  CheckCircle2,
  FileX2,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  DocumentBasketItem,
  DocumentBasketRole,
} from "../models/DocumentBasketItem";
import {
  fetchDocumentBasketItems,
  openDocumentBasketItem,
} from "../services/documentBasketApi";

type DocumentBasketModalProps = {
  open: boolean;
  onClose: () => void;
  selectedDocumentIds: Set<DocumentBasketRole>;
  onSelectedDocumentIdsChange: (
    selectedIds: Set<DocumentBasketRole>,
  ) => void;
  onItemsChange?: (
    items: DocumentBasketItem[],
  ) => void;
};

export function DocumentBasketModal({
  open,
  onClose,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  onItemsChange,
}: DocumentBasketModalProps) {
  const [items, setItems] = useState<
    DocumentBasketItem[] | null
  >(null);

  const [loadError, setLoadError] = useState<
    string | null
  >(null);

  const [openingId, setOpeningId] =
    useState<DocumentBasketRole | null>(
      null,
    );

  const [openError, setOpenError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    setItems(null);
    setLoadError(null);
    setOpenError(null);

    fetchDocumentBasketItems()
      .then((fetchedItems) => {
        if (!cancelled) {
          setItems(fetchedItems);
          onItemsChange?.(fetchedItems);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Belge sepeti durumu alınamadı.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // onItemsChange is a parent-provided callback, not a reactive input:
    // re-fetching on its identity would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!items) {
      return;
    }

    const existingIds = new Set(
      items
        .filter((item) => item.exists)
        .map((item) => item.id),
    );

    let hasStaleSelection = false;

    const filteredIds = new Set<DocumentBasketRole>();

    selectedDocumentIds.forEach((id) => {
      if (existingIds.has(id)) {
        filteredIds.add(id);
      } else {
        hasStaleSelection = true;
      }
    });

    if (hasStaleSelection) {
      onSelectedDocumentIdsChange(filteredIds);
    }
    // Only re-run when a fresh status load could have dropped a
    // previously-selected document; selectedDocumentIds/onChange are
    // re-read via closure but shouldn't themselves retrigger this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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

  async function handleItemClick(
    item: DocumentBasketItem,
  ) {
    if (!item.exists || openingId) {
      return;
    }

    setOpeningId(item.id);
    setOpenError(null);

    try {
      await openDocumentBasketItem(item.id);
    } catch (error) {
      setOpenError(
        error instanceof Error
          ? error.message
          : "Belge açılamadı.",
      );
    } finally {
      setOpeningId(null);
    }
  }

  function handleToggleSelected(
    item: DocumentBasketItem,
  ) {
    if (!item.exists) {
      return;
    }

    const next = new Set(
      selectedDocumentIds,
    );

    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.add(item.id);
    }

    onSelectedDocumentIdsChange(next);
  }

  const selectedDocumentCount =
    items?.filter(
      (item) =>
        item.exists &&
        selectedDocumentIds.has(item.id),
    ).length ?? 0;

  return (
    <div
      className="document-basket-modal-backdrop"
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
        className="document-basket-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-basket-modal-title"
        style={{
          width: "min(560px, 100%)",
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
              <PackageCheck size={14} />
              Belge Sepeti
            </p>

            <h2
              id="document-basket-modal-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "20px",
                lineHeight: 1.3,
              }}
            >
              Gönderilecek Fuar Belgeleri
            </h2>
          </div>

          <button
            type="button"
            aria-label="Belge sepetini kapat"
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

          {!items && !loadError ? (
            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              Belgeler kontrol ediliyor...
            </p>
          ) : null}

          {items?.map((item) => {
            const isOpening =
              openingId === item.id;

            return (
              <div
                key={item.id}
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
                  background: item.exists
                    ? "#ffffff"
                    : "#f8fafc",
                  opacity:
                    !item.exists ||
                    (openingId !== null &&
                      !isOpening)
                      ? 0.6
                      : 1,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={`${item.title} seç`}
                    checked={selectedDocumentIds.has(
                      item.id,
                    )}
                    disabled={
                      !item.exists
                    }
                    onChange={() =>
                      handleToggleSelected(
                        item,
                      )
                    }
                    style={{
                      width: "16px",
                      height: "16px",
                      flex: "0 0 auto",
                      cursor: item.exists
                        ? "pointer"
                        : "not-allowed",
                    }}
                  />

                  <button
                    type="button"
                    disabled={
                      !item.exists ||
                      openingId !== null
                    }
                    onClick={() =>
                      void handleItemClick(
                        item,
                      )
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      border: 0,
                      padding: 0,
                      background:
                        "transparent",
                      color: item.exists
                        ? "#0f172a"
                        : "#94a3b8",
                      cursor: item.exists
                        ? "pointer"
                        : "not-allowed",
                      fontSize: "14px",
                      fontWeight: 700,
                      textAlign: "left",
                    }}
                  >
                    {item.exists ? (
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

                    {item.title}
                  </button>
                </span>

                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#64748b",
                    flex: "0 0 auto",
                  }}
                >
                  {isOpening && (
                    <Loader2 size={14} />
                  )}

                  {isOpening
                    ? "Açılıyor..."
                    : item.exists
                      ? item.fileName
                      : "Belge yok"}
                </span>
              </div>
            );
          })}
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "14px 24px",
            borderTop:
              "1px solid #e2e8f0",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Seçilen Belgeler:{" "}
            {selectedDocumentCount}
          </span>
        </footer>
      </section>
    </div>
  );
}
