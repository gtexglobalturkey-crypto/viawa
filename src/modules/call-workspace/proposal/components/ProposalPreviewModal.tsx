import { useEffect } from "react";

import type { ContractDraftData } from "../models/ContractDraftData";
import type {
  ProposalPaymentInstallment,
  ProposalPaymentStatus,
  ProposalResult,
  ProposalStatus,
} from "../models/ProposalResult";

type ProposalPreviewModalProps = {
  open: boolean;
  proposal: ProposalResult | null;
  contractDraft?: ContractDraftData | null;
  onClose: () => void;
  onSendViaCommunication?: () => void;
};

const STAND_TYPE_LABELS: Record<string, string> = {
  "space-only": "Space Only",
  "shell-scheme": "Shell Scheme",
  custom: "Custom Stand",
  outdoor: "Outdoor",
};

function getStandTypeLabel(
  standType: string | undefined,
): string {
  if (!standType) {
    return "—";
  }

  return STAND_TYPE_LABELS[standType] ?? standType;
}

const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  "signed-by-erexpo": "Signed by EREXPO",
  sent: "Sent",
  viewed: "Viewed",
  "signed-by-customer": "Signed by Customer",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_STATUS_LABELS: Record<ProposalPaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim() !== "";
}

const DISPLAY_VALUE_PREFIX_PATTERN =
  /^(name|company_name|organizer|representative_name):\s*/i;

function cleanDisplayValue(
  value: string | undefined | null,
): string {
  if (!hasText(value)) {
    return "—";
  }

  const withoutPrefix = value
    .trim()
    .replace(DISPLAY_VALUE_PREFIX_PATTERN, "")
    .trim();

  return withoutPrefix ? withoutPrefix : "—";
}

function formatMoney(
  value: number | undefined,
  currency: string | undefined,
): string {
  const safeValue = isFiniteNumber(value) ? value : 0;
  const safeCurrency = hasText(currency) ? currency.trim() : "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  } catch {
    return `${safeValue.toFixed(2)} ${safeCurrency}`;
  }
}

function formatDate(value: string | undefined): string {
  if (!hasText(value)) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toSortableTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function getPayeeLabel(
  installment: ProposalPaymentInstallment,
  organizerName: string | undefined,
): string {
  if (installment.category === "organizer") {
    const cleanedOrganizerName =
      cleanDisplayValue(organizerName);

    return cleanedOrganizerName === "—"
      ? "Organizer"
      : cleanedOrganizerName;
  }

  if (installment.category === "service") {
    return "EREXPO";
  }

  return "—";
}

function getPaymentStatusLabel(
  status: ProposalPaymentStatus,
): string {
  return PAYMENT_STATUS_LABELS[status] ?? String(status);
}

export function ProposalPreviewModal({
  open,
  proposal,
  contractDraft,
  onClose,
  onSendViaCommunication,
}: ProposalPreviewModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const organizerItems =
    proposal?.items.filter(
      (item) => item.id !== "representative-service-fee",
    ) ?? [];

  const erexpoItems =
    proposal?.items.filter(
      (item) => item.id === "representative-service-fee",
    ) ?? [];

  const scheduleItems = proposal?.paymentSchedule
    ? [...proposal.paymentSchedule].sort(
        (a, b) => toSortableTime(a.dueDate) - toSortableTime(b.dueDate),
      )
    : [];

  const serviceFeeIsWaived =
    proposal?.serviceFeeApplied === false ||
    !isFiniteNumber(proposal?.serviceFee) ||
    (proposal?.serviceFee ?? 0) <= 0;

  const hasNotesSection =
    hasText(proposal?.paymentTerms) || hasText(proposal?.notes);

  return (
    <div
      className="proposal-preview-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
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
        background: "rgba(15, 23, 42, 0.58)",
        backdropFilter: "blur(4px)",
      }}
    >
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          html,
          body {
            background: #ffffff;
            overflow: visible;
            width: auto;
            height: auto;
          }

          .proposal-preview-modal-backdrop {
            position: static;
            display: block;
            inset: auto;
            padding: 0;
            background: #ffffff;
            overflow: visible;
          }

          .proposal-preview-modal {
            position: static;
            width: 100%;
            max-width: none;
            max-height: none;
            margin: 0;
            padding: 0;
            overflow: visible;
            border: 0;
            border-radius: 0;
            box-shadow: none;
            background: #ffffff;
          }

          .proposal-preview-modal > header,
          .proposal-preview-modal > footer {
            display: none !important;
          }

          .proposal-preview-modal-body {
            display: block;
            width: 100%;
            max-width: none;
            min-height: auto;
            padding: 0;
            margin: 0;
            overflow: visible;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .proposal-preview-payment-table-wrap {
            overflow: visible;
            width: 100%;
            max-width: none;
          }

          .proposal-preview-payment-table-wrap table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
          }

          .proposal-preview-payment-table-wrap table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .proposal-preview-avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-button {
            display: none !important;
          }
        }
      `}</style>

      <section
        className="proposal-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proposal-preview-modal-title"
        style={{
          width: "min(860px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: "18px",
          background: "#ffffff",
          boxShadow: "0 24px 64px rgba(15, 23, 42, 0.24)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "20px",
            padding: "22px 24px",
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
              EREXPO · International Exhibition Representation
            </p>

            <h2
              id="proposal-preview-modal-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "20px",
                lineHeight: 1.3,
              }}
            >
              Katılım Sözleşmesi
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close proposal preview"
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
          className="proposal-preview-modal-body"
          style={{
            display: "grid",
            gap: "24px",
            padding: "24px",
          }}
        >
          {!proposal ? (
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Contract data is not available.
            </p>
          ) : (
            <>
              {/* 1. HEADER DETAILS */}
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "13px",
                }}
              >
                <div>
                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    Agreement Number
                  </div>
                  <div style={{ color: "#0f172a" }}>
                    {proposal.proposalNumber}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    Issue Date
                  </div>
                  <div style={{ color: "#0f172a" }}>
                    {formatDate(proposal.createdAt)}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    Valid Until
                  </div>
                  <div style={{ color: "#0f172a" }}>
                    {formatDate(proposal.validUntil)}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    Status
                  </div>
                  <div style={{ color: "#0f172a" }}>
                    {proposal.status
                      ? STATUS_LABELS[proposal.status]
                      : "—"}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    Exhibition
                  </div>
                  <div style={{ color: "#0f172a" }}>
                    {cleanDisplayValue(proposal.exhibitionName)}
                  </div>
                </div>
              </section>

              {/* 1b. PROPOSAL-UNTIL-SIGNED CLAUSE */}
              <section
                className="proposal-preview-avoid-break"
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  fontSize: "13px",
                  color: "#78350f",
                  lineHeight: 1.5,
                }}
              >
                İşbu sözleşme, tarafların imzalarının tamamlanmasına kadar
                teklif niteliğindedir. Tarafların imzalarının
                tamamlanmasıyla yürürlüğe girer.
              </section>

              {/* 2. PARTIES */}
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#334155",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Representative
                  </h3>

                  <div style={{ fontSize: "13px", color: "#0f172a", display: "grid", gap: "4px" }}>
                    <div>EREXPO</div>
                    <div>
                      {cleanDisplayValue(
                        proposal.representativeName,
                      )}
                    </div>
                    {hasText(proposal.erexpoSignature?.signerTitle) && (
                      <div style={{ color: "#64748b" }}>
                        {proposal.erexpoSignature?.signerTitle}
                      </div>
                    )}
                    {hasText(proposal.erexpoSignature?.signerEmail) && (
                      <div style={{ color: "#64748b" }}>
                        {proposal.erexpoSignature?.signerEmail}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#334155",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Participating Company
                  </h3>

                  <div style={{ fontSize: "13px", color: "#0f172a", display: "grid", gap: "4px" }}>
                    <div>
                      {cleanDisplayValue(
                        proposal.companyName,
                      )}
                    </div>
                    <div style={{ color: "#64748b" }}>
                      {hasText(proposal.customerSignature?.signerName)
                        ? proposal.customerSignature?.signerName
                        : "—"}
                    </div>
                    {hasText(proposal.customerSignature?.signerEmail) && (
                      <div style={{ color: "#64748b" }}>
                        {proposal.customerSignature?.signerEmail}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 2b. STAND & CONTRACT CONTACTS — data-check summary ahead
                  of any future Word/PDF generation. */}
              {contractDraft && (
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>
                      Stand Area
                    </div>
                    <div style={{ color: "#0f172a" }}>
                      {contractDraft.price.priceInput.standAreaSqm} m²
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>
                      Stand Type
                    </div>
                    <div style={{ color: "#0f172a" }}>
                      {getStandTypeLabel(
                        contractDraft.exhibition.standType,
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>
                      Fuar Yetkilisi
                    </div>
                    <div style={{ color: "#0f172a" }}>
                      {cleanDisplayValue(
                        contractDraft.contacts.exhibitionContact
                          ?.fullName,
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>
                      İmza Yetkilisi
                    </div>
                    <div style={{ color: "#0f172a" }}>
                      {cleanDisplayValue(
                        contractDraft.contacts.signatoryContact
                          ?.fullName,
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* 3. EXHIBITION INFORMATION */}
              <section>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Exhibition Information
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "8px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b" }}>Exhibition: </span>
                    <span style={{ color: "#0f172a" }}>
                      {cleanDisplayValue(proposal.exhibitionName)}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "#64748b" }}>Organizer: </span>
                    <span style={{ color: "#0f172a" }}>
                      {cleanDisplayValue(proposal.organizerName)}
                    </span>
                  </div>
                </div>
              </section>

              {/* 4. FINANCIAL SUMMARY */}
              <section>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Financial Summary
                </h3>

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      <span>Organizer Participation Total</span>
                      <span>
                        {formatMoney(
                          proposal.organizerParticipationFee,
                          proposal.currency,
                        )}
                      </span>
                    </div>

                    {organizerItems.length > 0 && (
                      <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
                        {organizerItems.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "12px",
                              color: "#64748b",
                            }}
                          >
                            <span>{item.title}</span>
                            <span>
                              {formatMoney(item.totalPrice, proposal.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      <span>EREXPO Service Fee</span>
                      <span>
                        {formatMoney(proposal.serviceFee, proposal.currency)}
                      </span>
                    </div>

                    {erexpoItems.length > 0 && (
                      <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
                        {erexpoItems.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "12px",
                              color: "#64748b",
                            }}
                          >
                            <span>{item.title}</span>
                            <span>
                              {formatMoney(item.totalPrice, proposal.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 5. ZERO SERVICE FEE */}
                    {serviceFeeIsWaived && (
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: "12px",
                          color: "#64748b",
                          fontStyle: "italic",
                        }}
                      >
                        {hasText(proposal.serviceFeeWaiverReason)
                          ? proposal.serviceFeeWaiverReason
                          : "No additional EREXPO service fee is charged for this participation."}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      background: "#0f172a",
                      color: "#ffffff",
                      fontSize: "16px",
                      fontWeight: 800,
                    }}
                  >
                    <span>Grand Total</span>
                    <span>
                      {formatMoney(proposal.grandTotal, proposal.currency)}
                    </span>
                  </div>
                </div>
              </section>

              {/* 6. PAYMENT SCHEDULE */}
              <section>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Payment Schedule
                </h3>

                {scheduleItems.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#64748b" }}>
                    Payment schedule will be defined before signature.
                  </p>
                ) : (
                  <div
                    className="proposal-preview-payment-table-wrap"
                    style={{ overflowX: "auto" }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                      }}
                    >
                      <thead>
                        <tr>
                          {[
                            "Installment",
                            "Due Date",
                            "Description",
                            "Payee / Category",
                            "Amount",
                            "Status",
                          ].map((heading) => (
                            <th
                              key={heading}
                              style={{
                                textAlign: "left",
                                padding: "8px",
                                borderBottom: "1px solid #e2e8f0",
                                color: "#64748b",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {scheduleItems.map((installment, index) => (
                          <tr key={installment.id}>
                            <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                              {index + 1}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                              {formatDate(installment.dueDate)}
                            </td>
                            <td
                              style={{
                                padding: "8px",
                                borderBottom: "1px solid #f1f5f9",
                                maxWidth: "220px",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {hasText(installment.description)
                                ? installment.description
                                : "—"}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                              {getPayeeLabel(installment, proposal.organizerName)}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                              {formatMoney(installment.amount, installment.currency)}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                              {getPaymentStatusLabel(installment.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* 7. PAYMENT PRINCIPLES */}
              <section className="proposal-preview-avoid-break">
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Payment Principles
                </h3>

                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    display: "grid",
                    gap: "4px",
                    fontSize: "12px",
                    color: "#334155",
                  }}
                >
                  <li>
                    Organizer payments and EREXPO service payments are separate
                    obligations.
                  </li>
                  <li>
                    Payments must follow the recipient and due date stated in
                    the schedule.
                  </li>
                  <li>Organizer bank details are not included in this agreement.</li>
                  <li>
                    Authorized payment account information will be communicated
                    separately.
                  </li>
                </ul>
              </section>

              {/* 8. NOTES */}
              {hasNotesSection && (
                <section className="proposal-preview-avoid-break">
                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#334155",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Agreement Notes
                  </h3>

                  <div style={{ fontSize: "13px", color: "#334155", display: "grid", gap: "6px" }}>
                    {hasText(proposal.paymentTerms) && (
                      <div>
                        <span style={{ color: "#64748b" }}>Payment Terms: </span>
                        {proposal.paymentTerms}
                      </div>
                    )}

                    {hasText(proposal.notes) && (
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        <span style={{ color: "#64748b" }}>Notes: </span>
                        {proposal.notes}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 9. SIGNATURES */}
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "16px",
                }}
              >
                <div
                  className="proposal-preview-avoid-break"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    fontSize: "12px",
                    color: "#334155",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 800 }}>
                    EREXPO / Representative
                  </h4>

                  <div style={{ display: "grid", gap: "6px" }}>
                    <div>
                      Name:{" "}
                      {cleanDisplayValue(
                        proposal.erexpoSignature?.signerName ??
                          proposal.representativeName,
                      )}
                    </div>
                    {hasText(proposal.erexpoSignature?.signerTitle) && (
                      <div>Title: {proposal.erexpoSignature?.signerTitle}</div>
                    )}
                    <div>
                      Signature:{" "}
                      {proposal.erexpoSignature ? "Signed" : "________________________"}
                    </div>
                    <div>
                      Date:{" "}
                      {proposal.erexpoSignature
                        ? formatDate(proposal.erexpoSignature.signedAt)
                        : "________________________"}
                    </div>
                  </div>
                </div>

                <div
                  className="proposal-preview-avoid-break"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    fontSize: "12px",
                    color: "#334155",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 800 }}>
                    Participating Company
                  </h4>

                  <div style={{ display: "grid", gap: "6px" }}>
                    <div>
                      Company:{" "}
                      {cleanDisplayValue(
                        proposal.companyName,
                      )}
                    </div>
                    <div>
                      Authorized Person:{" "}
                      {hasText(proposal.customerSignature?.signerName)
                        ? proposal.customerSignature?.signerName
                        : "________________________"}
                    </div>
                    <div>
                      Signature:{" "}
                      {proposal.customerSignature ? "Signed" : "________________________"}
                    </div>
                    <div>
                      Date:{" "}
                      {proposal.customerSignature
                        ? formatDate(proposal.customerSignature.signedAt)
                        : "________________________"}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            className="print-button"
            onClick={() => window.print()}
            style={{
              padding: "10px 18px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Print / Save as PDF
          </button>

          {onSendViaCommunication && (
            <button
              type="button"
              className="print-button"
              onClick={onSendViaCommunication}
              style={{
                padding: "10px 18px",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Send Contract
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
