import { Panel } from "../../../components/ui/Panel";

import { TEMPLATE_DISPLAY_NAMES } from "../services/templateService";
import type { CommunicationContext } from "../../../hooks/useCommunicationWorkspace";

type Props = {
  context: CommunicationContext;
  selectedTemplate: string;
};

const STAND_TYPE_LABELS: Record<string, string> = {
  "space-only": "Boş Alan",
  "shell-scheme": "Standart Stand",
  "premium-shell": "Premium Stand",
  custom: "Özel Stand",
  "custom-stand": "Özel Stand",
  outdoor: "Dış Alan",
};

function displayValue(
  value: string | number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "—";
  }

  return String(value);
}

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px minmax(0, 1fr)",
        gap: "6px",
        fontSize: "11px",
        lineHeight: 1.3,
      }}
    >
      <span className="muted">{label}</span>
      <strong style={{ overflowWrap: "anywhere" }}>
        {value}
      </strong>
    </div>
  );
}

export function QuickActionsCard({
  context,
  selectedTemplate,
}: Props) {
  const location = [
    context.company.city,
    context.company.country,
  ]
    .filter((value) => Boolean(value?.trim()))
    .join(" / ");

  const tax = [
    context.company.taxOffice,
    context.company.taxNumber,
  ]
    .filter((value) => Boolean(value?.trim()))
    .join(" / ");

  const opportunity = context.opportunity;
  const exhibition = context.exhibition;
  const standType = opportunity?.standType
    ? (STAND_TYPE_LABELS[opportunity.standType] ??
      opportunity.standType)
    : "—";
  const grandTotal =
    opportunity?.grandTotal !== null &&
    opportunity?.grandTotal !== undefined
      ? `${new Intl.NumberFormat("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(opportunity.grandTotal)} ${
          opportunity.currency ?? ""
        }`.trim()
      : "—";

  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          İletişim Bağlamı
        </p>

        <div style={{ display: "grid", gap: "4px" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Firma
          </p>
          <ContextRow label="Firma" value={displayValue(context.company.name)} />
          <ContextRow label="Telefon" value={displayValue(context.company.phone)} />
          <ContextRow label="E-posta" value={displayValue(context.company.email)} />
          {context.company.address ? (
            <ContextRow label="Adres" value={context.company.address} />
          ) : null}
          <ContextRow label="Konum" value={displayValue(location)} />
          <ContextRow label="Website" value={displayValue(context.company.website)} />
          <ContextRow label="Vergi" value={displayValue(tax)} />
        </div>

        <div style={{ display: "grid", gap: "4px" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Fırsat
          </p>
          <ContextRow label="Fuar" value={displayValue(exhibition?.name)} />
          <ContextRow label="Aşama" value={displayValue(opportunity?.stage)} />
          <ContextRow label="Stand" value={standType} />
          <ContextRow
            label="Alan"
            value={
              opportunity?.areaSqm !== null &&
              opportunity?.areaSqm !== undefined
                ? `${opportunity.areaSqm} m²`
                : "—"
            }
          />
          <ContextRow label="Toplam" value={grandTotal} />
        </div>

        <div style={{ display: "grid", gap: "4px" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Kişiler
          </p>
          <ContextRow
            label="Ana"
            value={displayValue(
              context.primaryContact
                ? [
                    context.primaryContact.fullName,
                    context.primaryContact.email,
                    context.primaryContact.phone,
                  ].filter(Boolean).join(" · ")
                : null,
            )}
          />
          <ContextRow
            label="İmza"
            value={displayValue(
              context.signatoryContact
                ? [
                    context.signatoryContact.fullName,
                    context.signatoryContact.email,
                    context.signatoryContact.phone,
                  ].filter(Boolean).join(" · ")
                : null,
            )}
          />
        </div>

        <div className="communication-quick-actions">
          <p className="muted">Seçili İletişim</p>
          <strong>
            {TEMPLATE_DISPLAY_NAMES[selectedTemplate] ?? selectedTemplate}
          </strong>
        </div>
      </div>
    </Panel>
  );
}
