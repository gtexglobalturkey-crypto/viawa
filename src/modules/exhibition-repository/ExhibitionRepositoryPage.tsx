import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { PricingServiceFeeType } from "../call-workspace/pricing/models/ExhibitionPricingConfig";
import { useNavigate, useParams } from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import {
  getExhibition,
  type Exhibition,
} from "../../services/supabase/exhibitionService";

import {
  createDefaultPricingRecord,
  type ExhibitionPricingRecord,
} from "./models/ExhibitionPricingRecord";
import {
  getExhibitionPricingConfig,
  saveExhibitionPricingConfig,
} from "./services/exhibitionPricingRepositoryService";

type RepositoryTabId =
  | "info"
  | "pricing"
  | "floorplan"
  | "documents"
  | "contract-template"
  | "settings";

type RepositoryTab = {
  id: RepositoryTabId;
  label: string;
  icon: string;
};

// Only "pricing" is functional this sprint (Sprint 22.1 MVP) — the other
// five are intentionally inert placeholders, matching the sprint's
// "yalnızca yönetim iskeleti ve Fiyat Hesaplayıcı" scope.
const REPOSITORY_TABS: RepositoryTab[] = [
  {
    id: "info",
    label: "Fuar Bilgileri",
    icon: "📋",
  },
  {
    id: "pricing",
    label: "Fiyat Hesaplayıcı",
    icon: "💰",
  },
  {
    id: "floorplan",
    label: "Kroki Yönetimi",
    icon: "🗺️",
  },
  {
    id: "documents",
    label: "Belgeler",
    icon: "📄",
  },
  {
    id: "contract-template",
    label: "Sözleşme Şablonu",
    icon: "📝",
  },
  {
    id: "settings",
    label: "Repository Ayarları",
    icon: "⚙️",
  },
];

const ENABLED_TAB_ID: RepositoryTabId =
  "pricing";

// Kept as strings so a field can be freely edited/emptied while typing;
// only parsed to numbers on save (see fromFormState).
type PricingFormState = {
  currency: string;
  vatRate: string;
  spaceOnlyPrice: string;
  shellSchemePrice: string;
  premiumShellPrice: string;
  customStandPrice: string;
  outdoorPrice: string;
  locationNormalRate: string;
  locationCornerRate: string;
  locationTwoFrontsRate: string;
  locationIslandRate: string;
  locationDoubleDeckRate: string;
  registrationFee: string;
  serviceFeeType: PricingServiceFeeType;
  serviceFeeValue: string;
  additionalServicesFee: string;
  discountEnabled: boolean;
  discountMaxPercent: string;
};

// Rates are stored fractionally (0.10 = 10%) but edited as whole
// percentages in the form (10) — converted at this boundary only.
function toFormState(
  record: ExhibitionPricingRecord,
): PricingFormState {
  return {
    currency: record.currency,
    vatRate: String(record.vatRate * 100),
    spaceOnlyPrice: String(
      record.spaceOnlyPrice,
    ),
    shellSchemePrice: String(
      record.shellSchemePrice,
    ),
    premiumShellPrice: String(
      record.premiumShellPrice,
    ),
    customStandPrice: String(
      record.customStandPrice,
    ),
    outdoorPrice: String(
      record.outdoorPrice,
    ),
    locationNormalRate: String(
      record.locationNormalRate * 100,
    ),
    locationCornerRate: String(
      record.locationCornerRate * 100,
    ),
    locationTwoFrontsRate: String(
      record.locationTwoFrontsRate * 100,
    ),
    locationIslandRate: String(
      record.locationIslandRate * 100,
    ),
    locationDoubleDeckRate: String(
      record.locationDoubleDeckRate * 100,
    ),
    registrationFee: String(
      record.registrationFee,
    ),
    serviceFeeType:
      record.serviceFeeType,
    serviceFeeValue: String(
      record.serviceFee,
    ),
    additionalServicesFee: String(
      record.additionalServicesFee,
    ),
    discountEnabled:
      record.discountEnabled,
    discountMaxPercent:
      record.discountMaxPercent === null
        ? ""
        : String(
            record.discountMaxPercent,
          ),
  };
}

function parseFormNumber(
  value: string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function fromFormState(
  exhibitionId: string,
  form: PricingFormState,
): ExhibitionPricingRecord {
  return {
    exhibitionId,
    currency:
      form.currency.trim() || "EUR",
    vatRate:
      parseFormNumber(form.vatRate) /
      100,
    spaceOnlyPrice: parseFormNumber(
      form.spaceOnlyPrice,
    ),
    shellSchemePrice: parseFormNumber(
      form.shellSchemePrice,
    ),
    premiumShellPrice: parseFormNumber(
      form.premiumShellPrice,
    ),
    customStandPrice: parseFormNumber(
      form.customStandPrice,
    ),
    outdoorPrice: parseFormNumber(
      form.outdoorPrice,
    ),
    locationNormalRate:
      parseFormNumber(
        form.locationNormalRate,
      ) / 100,
    locationCornerRate:
      parseFormNumber(
        form.locationCornerRate,
      ) / 100,
    locationTwoFrontsRate:
      parseFormNumber(
        form.locationTwoFrontsRate,
      ) / 100,
    locationIslandRate:
      parseFormNumber(
        form.locationIslandRate,
      ) / 100,
    locationDoubleDeckRate:
      parseFormNumber(
        form.locationDoubleDeckRate,
      ) / 100,
    registrationFee: parseFormNumber(
      form.registrationFee,
    ),
    serviceFeeType: form.serviceFeeType,
    serviceFee: parseFormNumber(
      form.serviceFeeValue,
    ),
    additionalServicesFee:
      parseFormNumber(
        form.additionalServicesFee,
      ),
    discountEnabled:
      form.discountEnabled,
    discountMaxPercent:
      form.discountMaxPercent.trim()
        ? parseFormNumber(
            form.discountMaxPercent,
          )
        : null,
    updatedAt:
      new Date().toISOString(),
  };
}

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  fontSize: "11px",
  fontWeight: 700,
  color: "#334155",
};

const fieldInputStyle: CSSProperties = {
  width: "100%",
  height: "24px",
  padding: "0 7px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  color: "#0f172a",
  background: "#ffffff",
  fontSize: "11px",
};

const generalGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(110px, 140px))",
  gap: "7px",
};

const fiveColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(5, minmax(120px, 160px))",
  gap: "7px",
};

const feesGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(120px, 160px))",
  gap: "7px",
};

const otherEffectsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(120px, 160px))",
  gap: "7px",
};

const sectionEyebrowStyle: CSSProperties =
  {
    margin: "6px 0 3px",
  };

type NumberFieldProps = {
  label: string;
  value: string;
  suffix?: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

function NumberField({
  label,
  value,
  suffix,
  disabled,
  onChange,
}: NumberFieldProps) {
  return (
    <label style={fieldLabelStyle}>
      <span>
        {label}
        {suffix
          ? ` (${suffix})`
          : ""}
      </span>

      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        style={fieldInputStyle}
      />
    </label>
  );
}

type PricingCalculatorFormProps = {
  form: PricingFormState;
  isSaving: boolean;
  onFieldChange: (
    field: keyof PricingFormState,
    value: string | boolean,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
};

function PricingCalculatorForm({
  form,
  isSaving,
  onFieldChange,
  onSave,
  onCancel,
}: PricingCalculatorFormProps) {
  return (
    <div className="repository-pricing-form">
      <div className="repository-pricing-form-scroll">
      <p
        className="eyebrow"
        style={sectionEyebrowStyle}
      >
        General
      </p>

      <div
        className="repository-pricing-grid repository-pricing-grid--general"
        style={generalGridStyle}
      >
        <label style={fieldLabelStyle}>
          <span>Currency</span>

          <input
            value={form.currency}
            disabled={isSaving}
            onChange={(event) =>
              onFieldChange(
                "currency",
                event.target.value.toUpperCase(),
              )
            }
            maxLength={3}
            placeholder="EUR"
            style={fieldInputStyle}
          />
        </label>

        <NumberField
          label="VAT Rate"
          suffix="%"
          value={form.vatRate}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "vatRate",
              value,
            )
          }
        />
      </div>

      <p
        className="eyebrow"
        style={sectionEyebrowStyle}
      >
        Stand Types
      </p>

      <div
        className="repository-pricing-grid repository-pricing-grid--five"
        style={fiveColumnGridStyle}
      >
        <NumberField
          label="Space Only"
          value={form.spaceOnlyPrice}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "spaceOnlyPrice",
              value,
            )
          }
        />

        <NumberField
          label="Shell Scheme"
          value={form.shellSchemePrice}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "shellSchemePrice",
              value,
            )
          }
        />

        <NumberField
          label="Premium Shell"
          value={form.premiumShellPrice}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "premiumShellPrice",
              value,
            )
          }
        />

        <NumberField
          label="Custom Stand"
          value={form.customStandPrice}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "customStandPrice",
              value,
            )
          }
        />

        <NumberField
          label="Outdoor"
          value={form.outdoorPrice}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "outdoorPrice",
              value,
            )
          }
        />
      </div>

      <p
        className="eyebrow"
        style={sectionEyebrowStyle}
      >
        Location Surcharges
      </p>

      <div
        className="repository-pricing-grid repository-pricing-grid--five"
        style={fiveColumnGridStyle}
      >
        <NumberField
          label="Normal"
          suffix="%"
          value={
            form.locationNormalRate
          }
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "locationNormalRate",
              value,
            )
          }
        />

        <NumberField
          label="Corner"
          suffix="%"
          value={
            form.locationCornerRate
          }
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "locationCornerRate",
              value,
            )
          }
        />

        <NumberField
          label="3 Front"
          suffix="%"
          value={
            form.locationTwoFrontsRate
          }
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "locationTwoFrontsRate",
              value,
            )
          }
        />

        <NumberField
          label="Island"
          suffix="%"
          value={
            form.locationIslandRate
          }
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "locationIslandRate",
              value,
            )
          }
        />

        <NumberField
          label="Double Deck"
          suffix="%"
          value={
            form.locationDoubleDeckRate
          }
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "locationDoubleDeckRate",
              value,
            )
          }
        />
      </div>

      <p
        className="eyebrow"
        style={sectionEyebrowStyle}
      >
        Fixed Fees
      </p>

      <div
        className="repository-pricing-grid repository-pricing-grid--fees"
        style={feesGridStyle}
      >
        <NumberField
          label="Registration Fee"
          value={form.registrationFee}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "registrationFee",
              value,
            )
          }
        />

        <label style={fieldLabelStyle}>
          <span>Service Fee Type</span>

          <select
            value={form.serviceFeeType}
            disabled={isSaving}
            onChange={(event) =>
              onFieldChange(
                "serviceFeeType",
                event.target
                  .value as PricingServiceFeeType,
              )
            }
            style={fieldInputStyle}
          >
            <option value="per-sqm">
              Per m²
            </option>
            <option value="fixed">
              Fixed Amount
            </option>
          </select>
        </label>

        <NumberField
          label="Service Fee Value"
          value={form.serviceFeeValue}
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "serviceFeeValue",
              value,
            )
          }
        />

        <NumberField
          label="Additional Services Fee"
          value={
            form.additionalServicesFee
          }
          disabled={isSaving}
          onChange={(value) =>
            onFieldChange(
              "additionalServicesFee",
              value,
            )
          }
        />
      </div>

      <p
        className="eyebrow"
        style={sectionEyebrowStyle}
      >
        Other Price Effects
      </p>

      <div
        className="repository-pricing-grid repository-pricing-grid--other"
        style={otherEffectsGridStyle}
      >
        <label style={fieldLabelStyle}>
          <span>Discount</span>

          <span className="repository-pricing-checkbox">
            <input
              type="checkbox"
              checked={form.discountEnabled}
              disabled={isSaving}
              onChange={(event) =>
                onFieldChange(
                  "discountEnabled",
                  event.target.checked,
                )
              }
            />
            Enabled
          </span>
        </label>

        <NumberField
          label="Maximum Discount"
          suffix="%"
          value={form.discountMaxPercent}
          disabled={
            isSaving ||
            !form.discountEnabled
          }
          onChange={(value) =>
            onFieldChange(
              "discountMaxPercent",
              value,
            )
          }
        />
      </div>
      </div>

      <div
        className="repository-pricing-actions"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          marginTop: "6px",
          paddingTop: "6px",
          borderTop:
            "1px solid #e2e8f0",
        }}
      >
        <Button
          type="button"
          variant="secondary"
          disabled={isSaving}
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          type="button"
          variant="primary"
          disabled={isSaving}
          onClick={onSave}
        >
          {isSaving
            ? "Kaydediliyor..."
            : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function ExhibitionRepositoryPage() {
  const { id } = useParams<{
    id: string;
  }>();

  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] =
    useState<RepositoryTabId>(
      ENABLED_TAB_ID,
    );

  const [
    exhibition,
    setExhibition,
  ] = useState<Exhibition | null>(
    null,
  );

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [
    savedRecord,
    setSavedRecord,
  ] =
    useState<ExhibitionPricingRecord | null>(
      null,
    );

  const [form, setForm] =
    useState<PricingFormState | null>(
      null,
    );

  const [isSaving, setIsSaving] =
    useState(false);

  useEffect(() => {
    if (!id) {
      setLoadError(
        "Fuar bulunamadı.",
      );
      setLoading(false);

      return;
    }

    let isActive = true;

    async function loadRepository() {
      setLoading(true);
      setLoadError(null);

      try {
        const [
          exhibitionResult,
          pricingResult,
        ] = await Promise.all([
          getExhibition(id as string),
          getExhibitionPricingConfig(
            id as string,
          ),
        ]);

        if (!isActive) {
          return;
        }

        if (!exhibitionResult) {
          setLoadError(
            "Fuar bulunamadı.",
          );

          return;
        }

        setExhibition(
          exhibitionResult,
        );
        setSavedRecord(pricingResult);
        setForm(
          toFormState(pricingResult),
        );
      } catch (loadingError) {
        console.error(
          "Exhibition repository load error:",
          loadingError,
        );

        if (isActive) {
          setLoadError(
            "Fuar repository verisi yüklenemedi.",
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadRepository();

    return () => {
      isActive = false;
    };
  }, [id]);

  function handleFieldChange(
    field: keyof PricingFormState,
    value:
      | string
      | boolean
      | PricingServiceFeeType,
  ): void {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  function handleCancel(): void {
    setForm(
      toFormState(
        savedRecord ??
          createDefaultPricingRecord(
            id ?? "",
          ),
      ),
    );
  }

  async function handleSave(): Promise<void> {
    if (!id || !form || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const record = fromFormState(
        id,
        form,
      );

      const saved =
        await saveExhibitionPricingConfig(
          record,
        );

      setSavedRecord(saved);
      setForm(toFormState(saved));

      showToast(
        "Fiyat hesaplayıcı ayarları kaydedildi.",
        "success",
      );
    } catch (saveError) {
      console.error(
        "Exhibition pricing save error:",
        saveError,
      );

      showToast(
        "Fiyat hesaplayıcı ayarları kaydedilemedi.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <Panel>
          <p className="eyebrow">
            Fuar Repository
          </p>

          <h2>Yükleniyor...</h2>
        </Panel>
      </main>
    );
  }

  if (loadError || !exhibition) {
    return (
      <main className="page">
        <Panel>
          <p className="eyebrow">
            Fuar Repository
          </p>

          <h2>
            {loadError ??
              "Fuar bulunamadı."}
          </h2>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              navigate(
                "/reference-data",
              )
            }
          >
            Referans Verilere Dön
          </button>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page exhibition-repository-page">
      <PageHeader
        eyebrow="Fuar Repository"
        title={exhibition.name}
        subtitle="Fuar yönetim modülü — bu sprintte yalnızca Fiyat Hesaplayıcı aktif, diğer sekmeler yakında."
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate(`/exhibitions/${exhibition.id}/organizer-report`)}
        >
          Organizer Report
        </Button>
      </div>

      <Panel className="exhibition-repository-panel">
        <div
          className="exhibition-repository-tabs"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {REPOSITORY_TABS.map(
            (tab) => {
              const isActiveTab =
                tab.id === activeTab;

              const isEnabled =
                tab.id ===
                ENABLED_TAB_ID;

              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={
                    !isEnabled
                  }
                  onClick={() => {
                    if (isEnabled) {
                      setActiveTab(
                        tab.id,
                      );
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "6px",
                    padding:
                      "6px 10px",
                    borderRadius:
                      "8px",
                    border: isActiveTab
                      ? "1px solid var(--viawa-primary)"
                      : "1px solid #e2e8f0",
                    background:
                      isActiveTab
                        ? "var(--viawa-primary-soft)"
                        : "#ffffff",
                    color: isActiveTab
                      ? "var(--viawa-primary)"
                      : isEnabled
                        ? "#334155"
                        : "#94a3b8",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: isEnabled
                      ? "pointer"
                      : "not-allowed",
                  }}
                >
                  <span>
                    {tab.icon}
                  </span>

                  <span>
                    {tab.label}
                  </span>

                  {!isEnabled ? (
                    <span
                      style={{
                        fontSize:
                          "10px",
                        fontWeight: 800,
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.04em",
                        color:
                          "#94a3b8",
                      }}
                    >
                      Yakında
                    </span>
                  ) : null}
                </button>
              );
            },
          )}
        </div>

        {activeTab === "pricing" &&
        form ? (
          <PricingCalculatorForm
            form={form}
            isSaving={isSaving}
            onFieldChange={
              handleFieldChange
            }
            onSave={() =>
              void handleSave()
            }
            onCancel={handleCancel}
          />
        ) : null}
      </Panel>
    </main>
  );
}
