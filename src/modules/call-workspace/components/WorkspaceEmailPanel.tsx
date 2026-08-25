import { ChevronDown, Download, ExternalLink, FileText, X } from "lucide-react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useState } from "react";

import { useToast } from "../../../components/feedback/toastContext";
import type { Company, Contact } from "../../../types/database";

import type { RecipientOption } from "../../communication/components/EmailComposer";
import { resolveOpenableAttachmentUrl } from "../../communication/models/CommunicationAttachment";
import { TEMPLATE_DISPLAY_NAMES } from "../../communication/services/templateService";
import type { GeneratedDocumentRecord } from "../../document-engine/models/GeneratedDocumentRecord";
import type { SelectedExhibitionDocument } from "../../exhibitions/models/SelectedExhibitionDocument";

import { useWorkspaceEmailDraft } from "../hooks/useWorkspaceEmailDraft";
import {
  buildContractMailtoUrl,
  normalizeWorkspaceEmail,
  WORKSPACE_EMAIL_PATTERN,
} from "../models/exhibitionSessionMail";
import type {
  QuotationPriceSource,
  WorkspaceEmailDraft,
  WorkspaceEmailEvent,
} from "../models/exhibitionSessionMail";
import type { PriceCalculatedMeta } from "../pricing/components/PriceCalculatorModal";
import type { PriceResult } from "../pricing/models/PriceResult";

type WorkspaceEmailPanelProps = {
  open: boolean;
  onClose: () => void;
  company: Company;
  contacts: Contact[];
  resolvedContact: Contact | null;
  /** The fuar this panel was opened for — locked for its whole lifetime, see Section E. */
  panelSessionExhibitionId: string;
  panelSessionExhibitionName: string;
  /** True while the sidebar's live fuar differs from panelSessionExhibitionId. */
  isSidebarExhibitionMismatched: boolean;
  draft: WorkspaceEmailDraft;
  onDraftChange: (patch: Partial<WorkspaceEmailDraft>) => void;
  onEmailEvent: (event: WorkspaceEmailEvent) => void;
  repositoryDocuments: readonly SelectedExhibitionDocument[];
  draftPriceResult: {
    result: PriceResult;
    meta: PriceCalculatedMeta;
  } | null;
  approvedOpportunityPrice: QuotationPriceSource | null;
  /** Applied once when the panel opens — see Section A. */
  requestedTemplateId: string | null;
  /** BUG-S26-002 — source for the "Sözleşme" template's auto-attachment. */
  generatedDocuments: readonly GeneratedDocumentRecord[];
  /** The opportunity this panel's fuar resolves to right now, or null. */
  opportunityId: string | null;
};

const RESOLVED_CONTACT_NO_EMAIL_MESSAGE =
  "Seçili kişinin kayıtlı e-posta adresi bulunmuyor. Başka bir kişi seçin veya adresi manuel ekleyin.";

// Sprint 25.4C — same template catalog as
// communication/components/EmailTemplateList.tsx, duplicated as a plain
// list (not imported) so this panel's tab strip can be laid out and
// styled completely independently from Communication Center's own
// vertical list — the shared communication/ components are intentionally
// left untouched this sprint (see Kısıtlar).
const WORKSPACE_EMAIL_TEMPLATE_IDS = [
  "Information Package",
  "Exhibition Presentation",
  "Quotation",
  "Revised Quotation",
  "Contract",
  "Visa Invitation",
  "Visitor Invitation",
  "Thank You",
];

const bannerStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.4,
};

const errorBannerStyle: CSSProperties = {
  ...bannerStyle,
  background: "#fff4f4",
  color: "#b42318",
  border: "1px solid #f5c2c2",
};

// Sprint 25.2 / Adım 1 — same pattern CommunicationAttachment.ts's
// resolveOpenableAttachmentUrl already uses to recognize a PDF data URL,
// duplicated locally (not imported) since it's only needed here to
// decide whether "PDF İndir" applies — never used to derive/validate the
// URL itself, that's still entirely resolveOpenableAttachmentUrl's job.
const PDF_DATA_URL_PATTERN =
  /^data:application\/pdf[;,]/i;

const FALLBACK_CONTRACT_FILE_NAME =
  "sozlesme.pdf";

// Sprint 25.2 / Adım 1 — the download attribute's suggested file name.
// Never touches attachment.fileName itself (still shown as-is in the
// list) — only ensures the browser's save dialog gets a non-empty name
// ending in .pdf.
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

export function WorkspaceEmailPanel({
  open,
  onClose,
  company,
  contacts,
  resolvedContact,
  panelSessionExhibitionId,
  panelSessionExhibitionName,
  isSidebarExhibitionMismatched,
  draft,
  onDraftChange,
  onEmailEvent,
  repositoryDocuments,
  draftPriceResult,
  approvedOpportunityPrice,
  requestedTemplateId,
  generatedDocuments,
  opportunityId,
}: WorkspaceEmailPanelProps) {
  const { showToast } = useToast();

  const [templateError, setTemplateError] = useState<string | null>(
    null,
  );

  const [isCcBccExpanded, setIsCcBccExpanded] = useState(
    () => draft.cc.length > 0 || draft.bcc.length > 0,
  );

  const [isSalesKitOpen, setIsSalesKitOpen] = useState(false);

  const {
    recipientOptions,
    resolvedContactHasEmail,
    attachments,
    sending,
    sendError,
    sendSuccess,
    setToRecipients,
    setCcRecipients,
    setBccRecipients,
    handleTemplateSelect,
    handleSend,
  } = useWorkspaceEmailDraft({
    company,
    contacts,
    resolvedContact,
    panelSessionExhibitionId,
    exhibitionName: panelSessionExhibitionName,
    draft,
    onDraftChange,
    onEmailEvent,
    repositoryDocuments,
    draftPriceResult,
    approvedOpportunityPrice,
    requestedTemplateId,
    generatedDocuments,
    opportunityId,
  });

  // Sprint 25.4C Section 6/7 — success closes the panel automatically and
  // hands off to the app's own toast, instead of leaving an inline
  // "sent" banner the user has to notice and dismiss themselves. Nothing
  // about what handleSend/onEmailEvent actually do changes — this only
  // reacts to the same sendSuccess message the hook already produced.
  useEffect(() => {
    if (!sendSuccess) {
      return;
    }

    showToast(sendSuccess, "success");
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendSuccess]);

  if (!open) {
    return null;
  }

  function onSelectTemplate(templateId: string): void {
    const result = handleTemplateSelect(templateId);

    setTemplateError(result.ok ? null : result.reason);
  }

  // BUG-S26-002.1 — opens an attachment's real, already-captured PDF in a
  // new tab. Never touches the draft, never closes this panel, never
  // removes the attachment from the list — purely a read-only side
  // action. `url` is only ever a value resolveOpenableAttachmentUrl has
  // already validated (see the render below), so this never receives an
  // empty string.
  function handleOpenAttachment(url: string): void {
    try {
      const opened = window.open(
        url,
        "_blank",
        "noopener,noreferrer",
      );

      if (!opened) {
        showToast(
          "Dosya önizlemesi açılamadı.",
          "error",
        );
      }
    } catch (openError) {
      console.error(
        "Attachment preview open error:",
        openError,
      );

      showToast(
        "Dosya önizlemesi açılamadı.",
        "error",
      );
    }
  }

  async function onSend(): Promise<void> {
    await handleSend(draft.subject, draft.body);
  }

  return (
    <aside
      className="workspace-email-panel"
      role="complementary"
      aria-label="Workspace E-postası"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(420px, 100vw)",
        background: "var(--viawa-surface, #fff)",
        borderLeft: "1px solid var(--viawa-border)",
        boxShadow: "-12px 0 32px rgba(15, 23, 42, 0.18)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          borderBottom: "1px solid var(--viawa-border)",
        }}
      >
        <p className="eyebrow" style={{ margin: 0 }}>
          Workspace E-postası
        </p>

        <button
          type="button"
          aria-label="E-posta panelini kapat"
          onClick={onClose}
          style={{
            border: 0,
            background: "transparent",
            cursor: "pointer",
            padding: 4,
            display: "flex",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Section 1 — single-row template tab strip, replaces the old
          vertical button list. Selecting a tab still goes through the
          exact same handleTemplateSelect the hook already exposed. */}
      <div
        role="tablist"
        aria-label="E-posta şablonu"
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 10px",
          overflowX: "auto",
          borderBottom: "1px solid var(--viawa-border)",
          flexShrink: 0,
        }}
      >
        {WORKSPACE_EMAIL_TEMPLATE_IDS.map((templateId) => {
          const isSelected = templateId === draft.templateId;

          return (
            <button
              key={templateId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={isSelected ? "btn btn-primary" : "btn"}
              onClick={() => onSelectTemplate(templateId)}
              style={{
                flex: "0 0 auto",
                padding: "4px 10px",
                fontSize: 11,
                whiteSpace: "nowrap",
              }}
            >
              {TEMPLATE_DISPLAY_NAMES[templateId] ?? templateId}
            </button>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {isSidebarExhibitionMismatched ? (
          <div
            role="status"
            style={{
              ...bannerStyle,
              background: "var(--viawa-soft)",
              border: "1px solid var(--viawa-border)",
            }}
          >
            {`E-posta taslağı ${panelSessionExhibitionName} için hazırlanıyor.`}
          </div>
        ) : null}

        {resolvedContact && !resolvedContactHasEmail ? (
          <div role="alert" style={errorBannerStyle}>
            {RESOLVED_CONTACT_NO_EMAIL_MESSAGE}
          </div>
        ) : null}

        {templateError ? (
          <div role="alert" style={errorBannerStyle}>
            {templateError}
          </div>
        ) : null}

        {sendError ? (
          <div role="alert" style={errorBannerStyle}>
            {sendError}
          </div>
        ) : null}

        {/* Section 2/5 — compact recipients. TO is always visible (and
            auto-filled by the hook); CC/BCC stay tucked behind a
            disclosure link unless already in use, so this whole block
            stays small and the message field gets the room. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <CompactRecipientField
            label="Kime"
            values={draft.to}
            blockedValues={[...draft.cc, ...draft.bcc]}
            options={recipientOptions}
            onChange={setToRecipients}
          />

          {isCcBccExpanded ? (
            <>
              <CompactRecipientField
                label="Bilgi (CC)"
                values={draft.cc}
                blockedValues={[...draft.to, ...draft.bcc]}
                options={recipientOptions}
                onChange={setCcRecipients}
              />
              <CompactRecipientField
                label="Gizli (BCC)"
                values={draft.bcc}
                blockedValues={[...draft.to, ...draft.cc]}
                options={recipientOptions}
                onChange={setBccRecipients}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsCcBccExpanded(true)}
              className="muted"
              style={{
                alignSelf: "flex-start",
                border: 0,
                background: "transparent",
                cursor: "pointer",
                fontSize: 11,
                padding: 0,
                textDecoration: "underline",
              }}
            >
              CC/BCC ekle
            </button>
          )}

          <input
            type="text"
            value={draft.subject}
            onChange={(event) =>
              onDraftChange({ subject: event.target.value })
            }
            placeholder="Konu"
            aria-label="Konu"
            style={{
              padding: "6px 8px",
              fontSize: 12,
              border: "1px solid var(--viawa-border)",
              borderRadius: 6,
            }}
          />
        </div>

        {/* Section 2/8 — the message field is the one element allowed to
            actually grow: flex:1 inside a flex-column parent means it
            absorbs whatever vertical space the compact sections above
            and below don't need. */}
        <textarea
          value={draft.body}
          onChange={(event) =>
            onDraftChange({ body: event.target.value })
          }
          placeholder="Mesajınızı yazın..."
          aria-label="Mesaj"
          style={{
            flex: 1,
            minHeight: 160,
            resize: "vertical",
            padding: 8,
            fontSize: 12,
            lineHeight: 1.5,
            border: "1px solid var(--viawa-border)",
            borderRadius: 6,
            fontFamily: "inherit",
          }}
        />

        {/* Section 3/4 — "Satış Kiti" merges the old EKLER list and the
            requested accordion into one: collapsed by default (closed =
            zero footprint), and when opened shows exactly (and only) the
            Exhibition Repository documents explicitly checked off on the
            left — see buildWorkspaceEmailAttachments. Read-only: there is
            no selection to make here, so no checkboxes — the user
            changes this list from the left panel, not from here. */}
        <div
          style={{
            borderTop: "1px solid var(--viawa-border)",
            paddingTop: 6,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setIsSalesKitOpen((current) => !current)}
            aria-expanded={isSalesKitOpen}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              border: 0,
              background: "transparent",
              cursor: "pointer",
              padding: "2px 0",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>{`Satış Kiti (${attachments.length})`}</span>
            <ChevronDown
              size={14}
              style={{
                transform: isSalesKitOpen
                  ? "rotate(180deg)"
                  : undefined,
                transition: "transform 0.15s ease",
              }}
            />
          </button>

          {isSalesKitOpen ? (
            attachments.length === 0 ? (
              <p
                className="muted"
                style={{ fontSize: 11, margin: "4px 0 0" }}
              >
                Henüz belge seçilmedi. Sol panelden belge
                seçebilirsiniz.
              </p>
            ) : (
              <>
                <ul
                  style={{
                    listStyle: "none",
                    margin: "4px 0 0",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {attachments.map((attachment) => {
                    const previewUrl =
                      resolveOpenableAttachmentUrl(
                        attachment,
                      );

                    // Sprint 25.2 / Adım 1 — "PDF İndir" only where the
                    // resolved URL is actually a PDF (mimeType or a
                    // data:application/pdf URL) — this button is
                    // labeled "PDF", so it must never appear next to a
                    // non-PDF openable attachment (e.g. an
                    // exhibition-workspace http(s) link).
                    const isPdfPreviewUrl =
                      previewUrl !== null &&
                      (attachment.mimeType ===
                        "application/pdf" ||
                        PDF_DATA_URL_PATTERN.test(
                          previewUrl,
                        ));

                    return (
                      <li
                        key={attachment.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                        }}
                      >
                        <FileText
                          size={12}
                          style={{
                            flexShrink: 0,
                            color: "#94a3b8",
                          }}
                        />

                        {previewUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenAttachment(
                                previewUrl,
                              )
                            }
                            title="PDF'i aç"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              overflow: "hidden",
                              border: 0,
                              background: "transparent",
                              padding: 0,
                              margin: 0,
                              font: "inherit",
                              color: "#7A0F23",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                textDecoration:
                                  "underline",
                              }}
                            >
                              {attachment.fileName}
                            </span>

                            <ExternalLink
                              size={11}
                              style={{
                                flexShrink: 0,
                              }}
                            />
                          </button>
                        ) : (
                          <span
                            title="Dosya önizlemesi kullanılamıyor."
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "inherit",
                            }}
                          >
                            {attachment.fileName}
                          </span>
                        )}

                        {isPdfPreviewUrl ? (
                          <a
                            href={previewUrl}
                            download={resolveDownloadFileName(
                              attachment.fileName,
                            )}
                            title="PDF İndir"
                            aria-label={`${attachment.fileName} dosyasını indir`}
                            style={{
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent:
                                "center",
                              color: "#7A0F23",
                              padding: 2,
                            }}
                          >
                            <Download
                              size={12}
                            />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p
                  className="muted"
                  style={{ fontSize: 10, margin: "4px 0 0" }}
                >
                  Ekleri değiştirmek için sol paneldeki belge
                  seçimlerini kullanın.
                </p>
              </>
            )
          ) : null}
        </div>
      </div>

      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--viawa-border)",
          flexShrink: 0,
        }}
      >
        {/* Google-first V1: contracts open in the user's mail client with
            the generated Drive/PDF reference; signature initiation is a
            separate manual Google Workspace action. */}
        {draft.templateId === "Contract" ? (
          <a
            href={buildContractMailtoUrl(
              draft,
            )}
            className="btn btn-primary"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            Outlook'ta Aç
          </a>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSend()}
            disabled={sending}
            style={{ width: "100%" }}
          >
            {sending ? "Gönderiliyor..." : "Gönder"}
          </button>
        )}
      </div>
    </aside>
  );
}

type CompactRecipientFieldProps = {
  label: string;
  values: readonly string[];
  blockedValues: readonly string[];
  options: RecipientOption[];
  onChange: (recipients: string[]) => void;
};

// Sprint 25.4C — a compact, single-panel-local restyle of the same
// recipient behavior EmailComposer's RecipientField already provides
// (registered-contact dropdown, manual address entry, chip removal).
// Deliberately not shared with EmailComposer.tsx (Communication Center is
// off-limits this sprint) — but the actual rule enforcement is unchanged:
// this only ever calls the hook's setToRecipients/setCcRecipients/
// setBccRecipients, and the real validation that blocks sending still
// happens in useWorkspaceEmailDraft.handleSend exactly as before.
function CompactRecipientField({
  label,
  values,
  blockedValues,
  options,
  onChange,
}: CompactRecipientFieldProps) {
  const [manualEmail, setManualEmail] = useState("");

  const normalizedValues = new Set(
    values.map(normalizeWorkspaceEmail),
  );
  const blockedEmails = new Set(
    blockedValues.map(normalizeWorkspaceEmail),
  );

  function addRecipient(rawEmail: string): void {
    const email = normalizeWorkspaceEmail(rawEmail);

    if (!WORKSPACE_EMAIL_PATTERN.test(email)) {
      return;
    }

    if (normalizedValues.has(email) || blockedEmails.has(email)) {
      return;
    }

    onChange([...values, email]);
    setManualEmail("");
  }

  function handleManualKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addRecipient(manualEmail);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--viawa-muted, #666)",
          minWidth: 52,
        }}
      >
        {label}
      </span>

      {values.map((email) => (
        <span
          key={email}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "1px 6px",
            borderRadius: 999,
            background: "var(--viawa-soft)",
            border: "1px solid var(--viawa-border)",
            fontSize: 10,
          }}
        >
          {email}
          <button
            type="button"
            aria-label={`${email} alıcısını kaldır`}
            onClick={() =>
              onChange(values.filter((value) => value !== email))
            }
            style={{
              border: 0,
              padding: 0,
              background: "transparent",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}

      <select
        aria-label={`${label} için kayıtlı kişi seç`}
        defaultValue=""
        onChange={(event) => {
          const option = options.find(
            (candidate) => candidate.id === event.target.value,
          );

          if (option) {
            addRecipient(option.email);
          }

          event.target.value = "";
        }}
        style={{
          fontSize: 10,
          padding: "1px 2px",
          border: "1px solid var(--viawa-border)",
          borderRadius: 4,
          maxWidth: 110,
        }}
      >
        <option value="">+ kişi</option>

        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <input
        type="email"
        value={manualEmail}
        placeholder="e-posta ekle"
        aria-label={`${label} manuel e-posta`}
        onChange={(event) => setManualEmail(event.target.value)}
        onKeyDown={handleManualKeyDown}
        onBlur={() => {
          if (manualEmail.trim()) {
            addRecipient(manualEmail);
          }
        }}
        style={{
          fontSize: 10,
          padding: "1px 4px",
          border: "1px solid var(--viawa-border)",
          borderRadius: 4,
          flex: "1 1 90px",
          minWidth: 90,
        }}
      />
    </div>
  );
}
