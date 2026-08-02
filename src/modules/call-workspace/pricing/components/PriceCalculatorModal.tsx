import {
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { exhibitionNamesMatch } from "../../../exhibitions/utils/exhibitionNameMatch";
import { buildPricingRuleFromConfig } from "../engine/pricingConfigAdapter";
import {
  runPricingEngine,
  type PricingEngineInput,
} from "../engine/pricingEngine";
import type { PricingSource } from "../models/ApprovedPriceSnapshot";
import type { ExhibitionPricingConfig } from "../models/ExhibitionPricingConfig";
import type {
  DiscountType,
  StandLocationType,
  StandType,
} from "../models/PriceInput";
import type { PriceResult } from "../models/PriceResult";
import { fetchExhibitionPricingConfig } from "../services/exhibitionPricingApi";

export type PriceCalculatorExhibitionContext = {
  id: string;
  name: string;
  shortName?: string | null;
};

export type PriceCalculatedMeta = {
  exhibitionId: string;
  exhibitionName: string;
  pricingSource: PricingSource;
  pricingSourceVersion: string;
  pricingConfigUpdatedAt: string;
  matchedRepositoryFolder: string;
};

type PriceCalculatorModalProps = {
  isOpen: boolean;
  exhibition: PriceCalculatorExhibitionContext | null;
  onClose: () => void;
  onCalculated?: (
    result: PriceResult,
    meta: PriceCalculatedMeta,
  ) => void;
};

type FormState = {
  standType: string;
  standLocationType: string;
  standAreaSqm: string;
  discountType: DiscountType;
  discountValue: string;
};

function createInitialFormState(
  config: ExhibitionPricingConfig,
): FormState {
  return {
    standType:
      config.standTypes[0]?.id ?? "",
    standLocationType:
      config.locationSurcharges[0]?.id ??
      "",
    standAreaSqm: "",
    discountType: "percentage",
    discountValue: "0",
  };
}

type ConfigLoadState =
  | { phase: "loading" }
  // No real Supabase exhibition matches at all — no id to link to.
  | { phase: "not-found" }
  // Exhibition exists in Supabase but has no pricing config row yet —
  // matchedExhibitionId lets the UI offer a direct link to its
  // Repository "Fiyat Hesaplayıcı" tab.
  | {
      phase: "config-missing";
      matchedExhibitionId: string;
    }
  | { phase: "invalid"; error: string }
  | {
      phase: "loaded";
      config: ExhibitionPricingConfig;
      matchedExhibitionId: string;
    };

function parseNumber(
  value: string,
): number {
  const normalizedValue = value
    .trim()
    .replace(",", ".");

  const parsedValue =
    Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return parsedValue;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "tr-TR",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatConfigDate(
  value: string,
): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(parsedDate);
}

// Defensive re-check: the repository folder resolver already fuzzy-
// matches by name, but the config's own declared identity is checked
// again here so a folder-matching false positive can never surface a
// different exhibition's numbers as if they belonged to the selected one.
function configMatchesExhibition(
  config: ExhibitionPricingConfig,
  exhibition: PriceCalculatorExhibitionContext,
): boolean {
  return (
    exhibitionNamesMatch(
      config.exhibitionName,
      exhibition.name,
    ) ||
    exhibitionNamesMatch(
      config.exhibitionName,
      exhibition.shortName,
    ) ||
    exhibitionNamesMatch(
      config.exhibitionId,
      exhibition.name,
    ) ||
    exhibitionNamesMatch(
      config.exhibitionId,
      exhibition.shortName,
    )
  );
}

export function PriceCalculatorModal({
  isOpen,
  exhibition,
  onClose,
  onCalculated,
}: PriceCalculatorModalProps) {
  const [
    configLoadState,
    setConfigLoadState,
  ] = useState<ConfigLoadState>({
    phase: "loading",
  });

  const [form, setForm] =
    useState<FormState | null>(null);

  const [result, setResult] =
    useState<PriceResult | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen || !exhibition) {
      return;
    }

    let cancelled = false;

    setConfigLoadState({
      phase: "loading",
    });
    setForm(null);
    setResult(null);
    setError(null);

    fetchExhibitionPricingConfig(
      exhibition.name,
      exhibition.shortName,
    )
      .then((apiResult) => {
        if (cancelled) {
          return;
        }

        if (
          apiResult.status === "not-found"
        ) {
          setConfigLoadState({
            phase: "not-found",
          });

          return;
        }

        if (
          apiResult.status ===
          "config-missing"
        ) {
          setConfigLoadState({
            phase: "config-missing",
            matchedExhibitionId:
              apiResult.matchedExhibitionId,
          });

          return;
        }

        if (
          apiResult.status === "invalid"
        ) {
          setConfigLoadState({
            phase: "invalid",
            error: apiResult.error,
          });

          return;
        }

        if (
          !configMatchesExhibition(
            apiResult.config,
            exhibition,
          )
        ) {
          setConfigLoadState({
            phase: "not-found",
          });

          return;
        }

        setConfigLoadState({
          phase: "loaded",
          config: apiResult.config,
          matchedExhibitionId:
            apiResult.matchedExhibitionId,
        });

        setForm(
          createInitialFormState(
            apiResult.config,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setConfigLoadState({
            phase: "invalid",
            error:
              "Fuar fiyat yapılandırması yüklenemedi.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    exhibition?.id,
    exhibition?.name,
    exhibition?.shortName,
  ]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, onClose]);

  function updateForm<
    Key extends keyof FormState,
  >(
    key: Key,
    value: FormState[Key],
  ) {
    setForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [key]: value,
          }
        : currentForm,
    );

    setError(null);
    setResult(null);
  }

  function handleCalculate() {
    if (
      configLoadState.phase !== "loaded" ||
      !form
    ) {
      return;
    }

    const config = configLoadState.config;
    const standAreaSqm = parseNumber(
      form.standAreaSqm,
    );
    const discountValue = parseNumber(
      form.discountValue,
    );

    if (standAreaSqm <= 0) {
      setError(
        "Stand area must be greater than 0 m².",
      );

      setResult(null);
      return;
    }

    if (discountValue < 0) {
      setError(
        "Discount cannot be negative.",
      );

      setResult(null);
      return;
    }

    if (
      !config.discount.enabled &&
      discountValue > 0
    ) {
      setError(
        "Discount is not available for this exhibition.",
      );

      setResult(null);
      return;
    }

    const maxDiscountPercent =
      config.discount.maxPercent ?? 100;

    if (
      form.discountType ===
        "percentage" &&
      discountValue > maxDiscountPercent
    ) {
      setError(
        `Percentage discount cannot exceed ${maxDiscountPercent}%.`,
      );

      setResult(null);
      return;
    }

    try {
      const pricingRule =
        buildPricingRuleFromConfig(
          config,
        );

      const pricingInput: PricingEngineInput =
        {
          standType:
            form.standType as StandType,
          standLocationType:
            form.standLocationType as StandLocationType,
          standAreaSqm,
          discountType:
            form.discountType,
          discountValue,
        };

      const calculatedResult =
        runPricingEngine(
          pricingRule,
          pricingInput,
        );

      setResult(
        calculatedResult,
      );

      setError(null);
    } catch (calculationError) {
      const message =
        calculationError instanceof
        Error
          ? calculationError.message
          : "Price calculation failed.";

      setError(message);
      setResult(null);
    }
  }

  function handleReset() {
    if (configLoadState.phase === "loaded") {
      setForm(
        createInitialFormState(
          configLoadState.config,
        ),
      );
    }

    setResult(null);
    setError(null);
  }

  function handleApprove() {
    if (
      !result ||
      !exhibition ||
      configLoadState.phase !== "loaded" ||
      configLoadState.config.status !==
        "active"
    ) {
      return;
    }

    onCalculated?.(result, {
      exhibitionId: exhibition.id,
      exhibitionName: exhibition.name,
      pricingSource: "exhibition-config",
      pricingSourceVersion:
        configLoadState.config
          .schemaVersion,
      pricingConfigUpdatedAt:
        configLoadState.config.updatedAt,
      matchedRepositoryFolder:
        configLoadState.matchedExhibitionId,
    });

    onClose();
  }

  if (!isOpen) {
    return null;
  }

  const loadedConfig =
    configLoadState.phase === "loaded"
      ? configLoadState.config
      : null;

  const currency =
    result?.currency ??
    loadedConfig?.currency ??
    "";

  const isDraft =
    loadedConfig?.status === "draft";

  const isArchived =
    loadedConfig?.status === "archived";

  const canApprove =
    loadedConfig?.status === "active";

  return (
    <div
      className="price-calculator-modal-backdrop"
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
        className="price-calculator-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-calculator-title"
        style={{
          width: "min(760px, 100%)",
          maxHeight:
            "calc(100vh - 48px)",
          overflowY: "auto",
          border:
            "1px solid #e2e8f0",
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
                letterSpacing:
                  "0.08em",
                textTransform:
                  "uppercase",
              }}
            >
              {exhibition?.name ??
                "Fuar seçilmedi"}
            </p>

            <h2
              id="price-calculator-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "22px",
                lineHeight: 1.25,
              }}
            >
              Fiyat Hesapla
            </h2>

            {loadedConfig && (
              <p
                style={{
                  margin: "8px 0 0",
                  color: "#64748b",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Para Birimi:{" "}
                {loadedConfig.currency}
                {" · "}
                Fiyat Kaynağı: Fuar
                Repository
                {" · "}
                Güncelleme:{" "}
                {formatConfigDate(
                  loadedConfig.updatedAt,
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label="Close price calculator"
            onClick={onClose}
            style={{
              flex: "0 0 auto",
              width: "36px",
              height: "36px",
              border:
                "1px solid #cbd5e1",
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

        {!exhibition ? (
          <div
            role="alert"
            style={{
              margin: "24px",
              padding: "16px 18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "12px",
              color: "#64748b",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Fiyat hesaplamak için önce
            sidebar'dan bir fuar seçin.
          </div>
        ) : configLoadState.phase ===
          "loading" ? (
          <div
            style={{
              margin: "24px",
              padding: "16px 18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "12px",
              color: "#64748b",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Fuar fiyat yapılandırması
            yükleniyor...
          </div>
        ) : configLoadState.phase ===
          "not-found" ? (
          <div
            role="alert"
            style={{
              margin: "24px",
              padding: "16px 18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "12px",
              color: "#64748b",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Bu fuar Fuar Repository'de
            kayıtlı değil. Fiyat
            hesaplamak için önce fuarı
            Reference Data veya Fuarlar
            panelinden oluşturun.
          </div>
        ) : configLoadState.phase ===
          "config-missing" ? (
          <div
            role="alert"
            style={{
              margin: "24px",
              padding: "16px 18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "12px",
              color: "#64748b",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            <p style={{ margin: 0 }}>
              Bu fuar için fiyat
              yapılandırması bulunamadı.
              Lütfen önce Repository &gt;
              Fiyat Hesaplayıcı
              bölümünden fiyatları
              tanımlayın.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/exhibitions/${configLoadState.matchedExhibitionId}/repository`,
                )
              }
              style={{
                marginTop: "12px",
                height: "38px",
                padding: "0 16px",
                border: 0,
                borderRadius: "10px",
                color: "#ffffff",
                background: "#991b1b",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Repository'yi Aç
            </button>
          </div>
        ) : configLoadState.phase ===
          "invalid" ? (
          <div
            role="alert"
            style={{
              margin: "24px",
              padding: "16px 18px",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              color: "#b91c1c",
              background: "#fef2f2",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Bu fuarın fiyat
            yapılandırması geçersiz.
          </div>
        ) : isArchived ? (
          <div
            role="alert"
            style={{
              margin: "24px",
              padding: "16px 18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "12px",
              color: "#64748b",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Bu fiyat yapılandırması
            arşivlenmiş.
          </div>
        ) : (
          form && (
          <>
          {isDraft && (
            <div
              role="alert"
              style={{
                margin: "24px 24px 0",
                padding: "12px 16px",
                border:
                  "1px solid #fde68a",
                borderRadius: "10px",
                color: "#78350f",
                background: "#fffbeb",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              Bu fuarın fiyat
              yapılandırması taslak
              durumunda.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "16px",
                alignContent: "start",
              }}
            >
              <label
                style={{
                  display: "grid",
                  gap: "7px",
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Stand Type
                </span>

                <select
                  value={form.standType}
                  onChange={(event) =>
                    updateForm(
                      "standType",
                      event.target
                        .value,
                    )
                  }
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "0 12px",
                    border:
                      "1px solid #cbd5e1",
                    borderRadius: "10px",
                    color: "#0f172a",
                    background:
                      "#ffffff",
                    fontSize: "14px",
                  }}
                >
                  {configLoadState.config.standTypes.map(
                    (standType) => (
                      <option
                        key={
                          standType.id
                        }
                        value={
                          standType.id
                        }
                      >
                        {
                          standType.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "7px",
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Stand Location
                </span>

                <select
                  value={
                    form.standLocationType
                  }
                  onChange={(event) =>
                    updateForm(
                      "standLocationType",
                      event.target
                        .value,
                    )
                  }
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "0 12px",
                    border:
                      "1px solid #cbd5e1",
                    borderRadius: "10px",
                    color: "#0f172a",
                    background:
                      "#ffffff",
                    fontSize: "14px",
                  }}
                >
                  {configLoadState.config.locationSurcharges.map(
                    (surcharge) => (
                      <option
                        key={
                          surcharge.id
                        }
                        value={
                          surcharge.id
                        }
                      >
                        {
                          surcharge.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "7px",
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Stand Area (m²)
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={
                    form.standAreaSqm
                  }
                  placeholder="Example: 24"
                  onChange={(event) =>
                    updateForm(
                      "standAreaSqm",
                      event.target.value,
                    )
                  }
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    height: "42px",
                    padding: "0 12px",
                    border:
                      "1px solid #cbd5e1",
                    borderRadius: "10px",
                    color: "#0f172a",
                    background:
                      "#ffffff",
                    fontSize: "14px",
                  }}
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: "12px",
                }}
              >
                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                  }}
                >
                  <span
                    style={{
                      color: "#334155",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Discount Type
                  </span>

                  <select
                    value={
                      form.discountType
                    }
                    disabled={
                      !configLoadState
                        .config.discount
                        .enabled
                    }
                    onChange={(event) =>
                      updateForm(
                        "discountType",
                        event.target
                          .value as DiscountType,
                      )
                    }
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius:
                        "10px",
                      color: "#0f172a",
                      background:
                        "#ffffff",
                      fontSize: "14px",
                    }}
                  >
                    <option value="percentage">
                      Percentage
                    </option>

                    <option value="fixed">
                      Fixed Amount
                    </option>
                  </select>
                </label>

                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                  }}
                >
                  <span
                    style={{
                      color: "#334155",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Discount
                  </span>

                  <input
                    type="number"
                    min="0"
                    max={
                      form.discountType ===
                      "percentage"
                        ? configLoadState
                            .config
                            .discount
                            .maxPercent ??
                          100
                        : undefined
                    }
                    step="0.01"
                    disabled={
                      !configLoadState
                        .config.discount
                        .enabled
                    }
                    value={
                      form.discountValue
                    }
                    onChange={(event) =>
                      updateForm(
                        "discountValue",
                        event.target
                          .value,
                      )
                    }
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      height: "42px",
                      padding: "0 12px",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius:
                        "10px",
                      color: "#0f172a",
                      background:
                        "#ffffff",
                      fontSize: "14px",
                    }}
                  />
                </label>
              </div>

              {error ? (
                <div
                  role="alert"
                  style={{
                    padding: "10px 12px",
                    border:
                      "1px solid #fecaca",
                    borderRadius: "10px",
                    color: "#b91c1c",
                    background:
                      "#fef2f2",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    handleCalculate
                  }
                  style={{
                    flex: 1,
                    height: "44px",
                    border: 0,
                    borderRadius: "10px",
                    color: "#ffffff",
                    background:
                      "#991b1b",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 800,
                  }}
                >
                  Calculate
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    height: "44px",
                    padding: "0 18px",
                    border:
                      "1px solid #cbd5e1",
                    borderRadius: "10px",
                    color: "#334155",
                    background:
                      "#ffffff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <aside
              style={{
                minWidth: 0,
                padding: "18px",
                border:
                  "1px solid #e2e8f0",
                borderRadius: "14px",
                background: "#f8fafc",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px",
                  color: "#0f172a",
                  fontSize: "16px",
                }}
              >
                Calculation Result
              </h3>

              {result ? (
                <div
                  style={{
                    display: "grid",
                    gap: "11px",
                  }}
                >
                  <ResultRow
                    label="Base Amount"
                    value={formatMoney(
                      result.sqmAmount,
                      currency,
                    )}
                  />

                  <ResultRow
                    label="Location Surcharge"
                    value={formatMoney(
                      result.locationSurcharge,
                      currency,
                    )}
                  />

                  <ResultRow
                    label="Participation Fee"
                    value={formatMoney(
                      result.participationFee,
                      currency,
                    )}
                  />

                  <ResultRow
                    label="Registration Fee"
                    value={formatMoney(
                      result.registrationFee,
                      currency,
                    )}
                  />

                  <ResultRow
                    label="Service Fee"
                    value={formatMoney(
                      result.serviceFee,
                      currency,
                    )}
                  />

                  <ResultRow
                    label="Subtotal"
                    value={formatMoney(
                      result.subtotal,
                      currency,
                    )}
                  />

                  <ResultRow
                    label="Discount"
                    value={`- ${formatMoney(
                      result.discountAmount,
                      currency,
                    )}`}
                  />

                  <ResultRow
                    label="VAT"
                    value={formatMoney(
                      result.vatAmount,
                      currency,
                    )}
                  />

                  <div
                    style={{
                      marginTop: "6px",
                      paddingTop: "14px",
                      borderTop:
                        "1px solid #cbd5e1",
                    }}
                  >
                    <ResultRow
                      label="Grand Total"
                      value={formatMoney(
                        result.grandTotal,
                        currency,
                      )}
                      emphasized
                    />
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleApprove
                    }
                    disabled={!canApprove}
                    title={
                      canApprove
                        ? undefined
                        : "Bu fuarın fiyat yapılandırması taslak durumunda."
                    }
                    style={{
                      marginTop: "8px",
                      height: "44px",
                      border: 0,
                      borderRadius: "10px",
                      color: "#ffffff",
                      background:
                        canApprove
                          ? "#166534"
                          : "#94a3b8",
                      cursor:
                        canApprove
                          ? "pointer"
                          : "not-allowed",
                      fontSize: "14px",
                      fontWeight: 800,
                    }}
                  >
                    Fiyatı Onayla
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    minHeight: "220px",
                    placeItems: "center",
                    padding: "20px",
                    border:
                      "1px dashed #cbd5e1",
                    borderRadius: "12px",
                    color: "#64748b",
                    textAlign: "center",
                    background:
                      "#ffffff",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  Enter the stand details
                  and click Calculate to
                  see the pricing
                  breakdown.
                </div>
              )}
            </aside>
          </div>
          </>
          )
        )}
      </section>
    </div>
  );
}

type ResultRowProps = {
  label: string;
  value: string;
  emphasized?: boolean;
};

function ResultRow({
  label,
  value,
  emphasized = false,
}: ResultRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent:
          "space-between",
        gap: "16px",
      }}
    >
      <span
        style={{
          color: emphasized
            ? "#0f172a"
            : "#64748b",
          fontSize: emphasized
            ? "15px"
            : "13px",
          fontWeight: emphasized
            ? 800
            : 600,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: emphasized
            ? "#991b1b"
            : "#0f172a",
          fontSize: emphasized
            ? "18px"
            : "14px",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
