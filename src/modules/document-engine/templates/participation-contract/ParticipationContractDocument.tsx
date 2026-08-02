import type { ContractDocumentData } from "../../models/ContractDocumentData";
import { CONTRACT_CLAUSES } from "./contractClauses";

const COLORS = {
  bordo: "#7A0F23",
  lacivert: "#1B2A4A",
  antrasit: "#2D2D2D",
  acikGri: "#F3F3F3",
  beyaz: "#FFFFFF",
};

function hasText(
  value: string | undefined | null,
): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function displayValue(
  value: string | undefined | null,
): string {
  return hasText(value) ? value : "—";
}

function formatMoney(
  value: number,
  currency: string,
): string {
  if (!Number.isFinite(value)) {
    return `0,00 ${currency}`;
  }

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDate(
  value: string | undefined,
): string {
  if (!hasText(value)) {
    return "—";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function formatDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
): string {
  if (!hasText(startDate) && !hasText(endDate)) {
    return "—";
  }

  if (hasText(startDate) && hasText(endDate)) {
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  }

  return formatDate(startDate ?? endDate);
}

type FieldRowProps = {
  label: string;
  value: string;
};

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="pcd-field-row">
      <span className="pcd-field-label">{label}</span>
      <span className="pcd-field-value">{value}</span>
    </div>
  );
}

type ParticipationContractDocumentProps = {
  data: ContractDocumentData;
};

export function ParticipationContractDocument({
  data,
}: ParticipationContractDocumentProps) {
  const feeRows: Array<{ label: string; value: number }> = [
    { label: "Stand Bedeli", value: data.pricing.sqmAmount },
    { label: "Konum Farkı", value: data.pricing.locationSurcharge },
    { label: "Ek Ücretler", value: data.pricing.additionalFees },
    { label: "İndirim", value: -data.pricing.discountAmount },
    { label: "Vergi", value: data.pricing.taxAmount },
  ];

  const paymentRows = data.paymentPlan.slice(0, 3);
  const blankPaymentRowCount = Math.max(
    0,
    3 - paymentRows.length,
  );

  return (
    <div className="pcd-page">
      <style>{`
        .pcd-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 10mm 12mm;
          box-sizing: border-box;
          background: ${COLORS.beyaz};
          color: ${COLORS.antrasit};
          font-family: Arial, "Segoe UI", sans-serif;
          font-size: 8px;
          line-height: 1.35;
        }

        .pcd-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid ${COLORS.bordo};
          padding-bottom: 6px;
          margin-bottom: 8px;
        }

        .pcd-logo {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: ${COLORS.bordo};
        }

        .pcd-title {
          margin: 2px 0 0;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: ${COLORS.lacivert};
        }

        .pcd-header-meta {
          text-align: right;
          font-size: 8px;
          color: ${COLORS.antrasit};
        }

        .pcd-header-meta strong {
          color: ${COLORS.lacivert};
        }

        .pcd-qr-box {
          width: 20mm;
          height: 20mm;
          margin-left: auto;
          margin-top: 4px;
          border: 1px solid ${COLORS.antrasit};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 6px;
          color: #94a3b8;
          text-align: center;
        }

        .pcd-section {
          margin-bottom: 7px;
        }

        .pcd-section-title {
          margin: 0 0 3px;
          padding: 2px 6px;
          background: ${COLORS.lacivert};
          color: ${COLORS.beyaz};
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .pcd-summary-line {
          font-size: 8.5px;
          font-weight: 700;
          color: ${COLORS.bordo};
          margin: 0 0 3px;
        }

        .pcd-area-line {
          font-size: 7.5px;
          color: ${COLORS.antrasit};
          margin: 0;
        }

        .pcd-field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px 14px;
          background: ${COLORS.acikGri};
          padding: 5px 8px;
        }

        .pcd-field-row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          border-bottom: 1px solid #e2e2e2;
          padding: 1.5px 0;
        }

        .pcd-field-label {
          color: #555;
          font-weight: 700;
          flex: 0 0 auto;
        }

        .pcd-field-value {
          text-align: right;
          overflow-wrap: anywhere;
        }

        .pcd-fee-table {
          width: 100%;
          border-collapse: collapse;
        }

        .pcd-fee-table td {
          padding: 2px 6px;
          border-bottom: 1px solid #e2e2e2;
        }

        .pcd-fee-table td:last-child {
          text-align: right;
        }

        .pcd-fee-total td {
          border-top: 1.5px solid ${COLORS.bordo};
          border-bottom: none;
          font-weight: 800;
          font-size: 9px;
          color: ${COLORS.bordo};
          padding-top: 3px;
        }

        .pcd-materials-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 3px 6px;
        }

        .pcd-material-item {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 7px;
        }

        .pcd-payment-table,
        .pcd-bank-table {
          width: 100%;
          border-collapse: collapse;
        }

        .pcd-payment-table td,
        .pcd-bank-table td {
          padding: 2px 6px;
          border-bottom: 1px solid #e2e2e2;
        }

        .pcd-notes-box {
          border: 1px dashed #b0b0b0;
          min-height: 10mm;
          padding: 4px 6px;
          white-space: pre-wrap;
        }

        .pcd-clause {
          margin-bottom: 4px;
          break-inside: avoid;
        }

        .pcd-clause-title {
          margin: 0 0 1px;
          font-size: 7.5px;
          font-weight: 800;
          color: ${COLORS.lacivert};
        }

        .pcd-clause-body p {
          margin: 0 0 1px;
          font-size: 6.8px;
          text-align: justify;
        }

        .pcd-signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 8px;
        }

        .pcd-signature-box {
          border: 1px solid ${COLORS.antrasit};
          padding: 6px 8px;
          break-inside: avoid;
        }

        .pcd-signature-box h4 {
          margin: 0 0 4px;
          font-size: 8px;
          font-weight: 800;
          color: ${COLORS.bordo};
        }

        .pcd-signature-line {
          margin: 3px 0;
          font-size: 7.5px;
        }

        .pcd-footer {
          margin-top: 6px;
          text-align: center;
          font-size: 6.5px;
          color: #94a3b8;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          html, body {
            background: ${COLORS.beyaz};
          }

          .pcd-page {
            margin: 0;
            box-shadow: none;
          }
        }
      `}</style>

      <header className="pcd-header">
        <div>
          <div className="pcd-logo">EXPOVIA</div>
          <p className="pcd-title">KATILIM SÖZLEŞMESİ</p>
        </div>

        <div className="pcd-header-meta">
          <div>
            Sözleşme No: <strong>{data.document.contractNumber}</strong>
          </div>
          <div>
            Düzenleme Tarihi: <strong>{formatDate(data.document.createdAt)}</strong>
          </div>
          <div className="pcd-qr-box">QR</div>
        </div>
      </header>

      <section className="pcd-section">
        <p className="pcd-section-title">Fuar Bilgileri</p>

        <p className="pcd-summary-line">
          {displayValue(data.exhibition.exhibitionName)}
          {" · "}
          {formatDateRange(
            data.exhibition.startDate,
            data.exhibition.endDate,
          )}
          {" · "}
          {displayValue(data.exhibition.city)}
          {" · "}
          {displayValue(data.exhibition.country)}
        </p>

        <p className="pcd-area-line">
          {displayValue(data.exhibition.venue)}
          {" · "}
          {displayValue(data.exhibition.hall)}
          {" · "}
          {displayValue(data.exhibition.standNumber)}
          {" · "}
          {data.participation.standTypeLabel}
        </p>
      </section>

      <section className="pcd-section">
        <p className="pcd-section-title">Katılımcı Firma</p>

        <div className="pcd-field-grid">
          <FieldRow label="Ünvan" value={data.company.companyName} />
          <FieldRow label="Adres" value={displayValue(data.company.address)} />
          <FieldRow
            label="Vergi Dairesi"
            value={displayValue(data.company.taxOffice)}
          />
          <FieldRow
            label="Vergi No"
            value={displayValue(data.company.taxNumber)}
          />
          <FieldRow label="Telefon" value={displayValue(data.company.phone)} />
          <FieldRow label="E-posta" value={displayValue(data.company.email)} />
          <FieldRow
            label="Fuar Yetkilisi"
            value={displayValue(data.company.exhibitionContactName)}
          />
          <FieldRow
            label="İmza Yetkilisi"
            value={displayValue(data.company.signatoryName)}
          />
          <FieldRow
            label="Web Sitesi"
            value={displayValue(data.company.website)}
          />
        </div>
      </section>

      <section className="pcd-section">
        <p className="pcd-section-title">Ücret ve Fiyat Bilgileri</p>

        <table className="pcd-fee-table">
          <tbody>
            {feeRows
              .filter((row) => row.value !== 0)
              .map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>
                    {formatMoney(
                      row.value,
                      data.pricing.currency,
                    )}
                  </td>
                </tr>
              ))}

            <tr className="pcd-fee-total">
              <td>Genel Toplam</td>
              <td>
                {formatMoney(
                  data.pricing.grandTotal,
                  data.pricing.currency,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="pcd-section">
        <p className="pcd-section-title">Stand Malzemeleri</p>

        <div className="pcd-materials-grid">
          {data.standMaterials.map((material) => (
            <span className="pcd-material-item" key={material.label}>
              {material.included ? "☑" : "☐"} {material.label}
            </span>
          ))}
        </div>
      </section>

      <section className="pcd-section">
        <p className="pcd-section-title">Ödeme Planı</p>

        <table className="pcd-payment-table">
          <tbody>
            {paymentRows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td>{row.label}</td>
                <td>{formatDate(row.dueDate)}</td>
                <td>
                  {row.amount !== undefined
                    ? formatMoney(
                        row.amount,
                        data.pricing.currency,
                      )
                    : "—"}
                </td>
              </tr>
            ))}

            {Array.from({
              length: blankPaymentRowCount,
            }).map((_, index) => (
              <tr key={`blank-${index}`}>
                <td>_______________________</td>
                <td>____ / ____ / ____</td>
                <td>_______________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pcd-section">
        <p className="pcd-section-title">Banka Bilgileri</p>

        {data.bankAccounts.length > 0 ? (
          <table className="pcd-bank-table">
            <tbody>
              {data.bankAccounts.map((account, index) => (
                <tr key={`${account.currency}-${index}`}>
                  <td>{account.currency}</td>
                  <td>{account.bankName ?? "—"}</td>
                  <td>{account.iban}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="pcd-area-line">
            IBAN (EUR): _______________________ &nbsp;&nbsp; IBAN (USD): _______________________
          </p>
        )}
      </section>

      <section className="pcd-section">
        <p className="pcd-section-title">Ekstra Malzeme ve Açıklamalar</p>

        <div className="pcd-notes-box">
          {data.extraMaterialsAndNotes ?? ""}
        </div>
      </section>

      <section className="pcd-section">
        <p className="pcd-section-title">Sözleşme Şartları</p>

        {CONTRACT_CLAUSES.map((clause) => (
          <div className="pcd-clause" key={clause.number}>
            <p className="pcd-clause-title">
              {clause.number}. {clause.title}
            </p>

            <div className="pcd-clause-body">
              {clause.body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="pcd-signatures">
        <div className="pcd-signature-box">
          <h4>KATILIMCI</h4>
          <p className="pcd-signature-line">
            İmza Yetkilisi: {displayValue(data.company.signatoryName)}
          </p>
          <p className="pcd-signature-line">
            Ünvan: {displayValue(data.company.signatoryTitle)}
          </p>
          <p className="pcd-signature-line">E-İmza: _______________________</p>
          <p className="pcd-signature-line">Tarih: ____ / ____ / ____</p>
        </div>

        <div className="pcd-signature-box">
          <h4>EXPOVIA</h4>
          <p className="pcd-signature-line">Kaşe: _______________________</p>
          <p className="pcd-signature-line">
            Dijital İmza: _______________________
          </p>
          <p className="pcd-signature-line">Tarih: ____ / ____ / ____</p>
        </div>
      </section>

      {/* Real printed page count is never verified by the app (plain
          HTML/CSS print has no reliable page-count API), so no "1/1" or
          any other page-count claim is shown here — only what's actually
          known: which contract and which version this is. */}
      <footer className="pcd-footer">
        {data.document.contractNumber} · v
        {data.document.version}
      </footer>
    </div>
  );
}
