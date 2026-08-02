import { Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import type { Exhibition } from "../models/Exhibition";

type ExhibitionCreateModalProps = {
  open: boolean;
  onClose: () => void;
  // Resolves true once the exhibition has actually been created (real
  // Supabase row created or an existing matching one reused) — the
  // modal only closes then. Resolves false on failure, so the modal
  // stays open with the typed values intact for a retry.
  onCreate: (
    exhibition: Exhibition,
  ) => Promise<boolean>;
};

type FieldErrors = {
  name?: string;
  shortName?: string;
};

function createExhibitionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `exhibition-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function labelStyle(): CSSProperties {
  return {
    display: "block",
    marginBottom: "4px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 700,
  };
}

function inputStyle(
  hasError: boolean,
): CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    border: `1px solid ${
      hasError ? "#fca5a5" : "#cbd5e1"
    }`,
    borderRadius: "8px",
    fontSize: "13px",
    color: "#0f172a",
    background: "#ffffff",
  };
}

export function ExhibitionCreateModal({
  open,
  onClose,
  onCreate,
}: ExhibitionCreateModalProps) {
  const [name, setName] = useState("");
  const [shortName, setShortName] =
    useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] =
    useState("");
  const [startDate, setStartDate] =
    useState("");
  const [endDate, setEndDate] =
    useState("");

  const [errors, setErrors] =
    useState<FieldErrors>({});

  const [isSaving, setIsSaving] =
    useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName("");
    setShortName("");
    setCity("");
    setCountry("");
    setStartDate("");
    setEndDate("");
    setErrors({});
    setIsSaving(false);
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

  async function handleSubmit() {
    if (isSaving) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedShortName =
      shortName.trim();

    const nextErrors: FieldErrors = {};

    if (!trimmedName) {
      nextErrors.name =
        "Fuar adı zorunludur.";
    }

    if (!trimmedShortName) {
      nextErrors.shortName =
        "Kısa ad zorunludur.";
    }

    if (
      nextErrors.name ||
      nextErrors.shortName
    ) {
      setErrors(nextErrors);
      return;
    }

    const exhibition: Exhibition = {
      id: createExhibitionId(),
      name: trimmedName,
      shortName: trimmedShortName,
      city: city.trim() || undefined,
      country:
        country.trim() || undefined,
      startDate:
        startDate.trim() || undefined,
      endDate:
        endDate.trim() || undefined,
      createdAt:
        new Date().toISOString(),
    };

    setIsSaving(true);

    try {
      const created = await onCreate(
        exhibition,
      );

      if (created) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="exhibition-create-modal-backdrop"
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
        className="exhibition-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exhibition-create-modal-title"
        style={{
          width: "min(420px, 100%)",
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
              <Landmark size={14} />
              Fuarlar
            </p>

            <h2
              id="exhibition-create-modal-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "20px",
                lineHeight: 1.3,
              }}
            >
              Yeni Fuar Ekle
            </h2>
          </div>

          <button
            type="button"
            aria-label="Yeni fuar penceresini kapat"
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
            gap: "14px",
            padding: "24px",
          }}
        >
          <div>
            <label
              htmlFor="exhibition-name"
              style={labelStyle()}
            >
              Fuar Adı *
            </label>

            <input
              id="exhibition-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              style={inputStyle(
                Boolean(errors.name),
              )}
            />

            {errors.name && (
              <p
                role="alert"
                style={{
                  margin: "4px 0 0",
                  color: "#b91c1c",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="exhibition-short-name"
              style={labelStyle()}
            >
              Kısa Adı *
            </label>

            <input
              id="exhibition-short-name"
              type="text"
              value={shortName}
              onChange={(event) =>
                setShortName(
                  event.target.value,
                )
              }
              style={inputStyle(
                Boolean(
                  errors.shortName,
                ),
              )}
            />

            {errors.shortName && (
              <p
                role="alert"
                style={{
                  margin: "4px 0 0",
                  color: "#b91c1c",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {errors.shortName}
              </p>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label
                htmlFor="exhibition-city"
                style={labelStyle()}
              >
                Şehir
              </label>

              <input
                id="exhibition-city"
                type="text"
                value={city}
                onChange={(event) =>
                  setCity(
                    event.target.value,
                  )
                }
                style={inputStyle(false)}
              />
            </div>

            <div>
              <label
                htmlFor="exhibition-country"
                style={labelStyle()}
              >
                Ülke
              </label>

              <input
                id="exhibition-country"
                type="text"
                value={country}
                onChange={(event) =>
                  setCountry(
                    event.target.value,
                  )
                }
                style={inputStyle(false)}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label
                htmlFor="exhibition-start-date"
                style={labelStyle()}
              >
                Başlangıç Tarihi
              </label>

              <input
                id="exhibition-start-date"
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(
                    event.target.value,
                  )
                }
                style={inputStyle(false)}
              />
            </div>

            <div>
              <label
                htmlFor="exhibition-end-date"
                style={labelStyle()}
              >
                Bitiş Tarihi
              </label>

              <input
                id="exhibition-end-date"
                type="date"
                value={endDate}
                onChange={(event) =>
                  setEndDate(
                    event.target.value,
                  )
                }
                style={inputStyle(false)}
              />
            </div>
          </div>
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "14px 24px",
            borderTop:
              "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            style={{
              padding: "8px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              color: "#334155",
              background: "#ffffff",
              cursor: isSaving
                ? "not-allowed"
                : "pointer",
              opacity: isSaving
                ? 0.6
                : 1,
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            İptal
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              void handleSubmit()
            }
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: "10px",
              color: "#ffffff",
              background: isSaving
                ? "#94a3b8"
                : "#991b1b",
              cursor: isSaving
                ? "not-allowed"
                : "pointer",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {isSaving
              ? "Ekleniyor..."
              : "Fuarı Ekle"}
          </button>
        </footer>
      </section>
    </div>
  );
}
