import {
  BadgeEuro,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Ruler,
  Save,
  UserRound,
} from "lucide-react";
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Panel } from "../../../components/ui/Panel";

import {
  SALES_TOOLS,
  type SalesToolId,
} from "../models/salesTools";
import {
  PriceCalculatorModal,
  type PriceCalculatedMeta,
  type PriceCalculatorExhibitionContext,
} from "../pricing/components/PriceCalculatorModal";
import type { PriceResult } from "../pricing/models/PriceResult";

export type ManualFollowUpSelection = {
  title: string;
  dueDate: string;
};

type ManualFollowUp = {
  title: string;
  dueDate: string | null;
};

type Props = {
  workspace: {
    customer: {
      fullName: string;
    };
    exhibition: {
      name: string;
      standSizeLabel: string;
    };
    opportunity: {
      nextAction: string;
      formattedEstimatedValue: string;
    };
  };
  saving?: boolean;
  /**
   * Sprint 25.3 — the note is now controlled by the parent's Exhibition
   * Session draft (see models/exhibitionSessionDraft.ts) so it switches
   * automatically when the sidebar fuar changes and survives that switch
   * for every fuar independently. Typing never touches Supabase — only
   * "Görüşmeyi Tamamla" does.
   */
  draftNote: string;
  onDraftNoteChange: (note: string) => void;
  /**
   * Sprint 25.3 — "Not Kaydet" no longer writes anything to Supabase (the
   * text is already held in draftNote as the user types). This is purely
   * a local confirmation action — see Commit Engine section 1: the only
   * operation allowed to create a permanent record is "Görüşmeyi Tamamla".
   */
  onSaveNote: () => void;
  onCompleteSession: (
    note: string,
    nextAction: string,
  ) => Promise<void>;
  onQuickAction: (
    templateId: string,
  ) => void;
  manualFollowUp: ManualFollowUp | null;
  onSaveManualFollowUp: (
    selection: ManualFollowUpSelection,
  ) => Promise<void>;
  followUpSaving?: boolean;
  onPriceCalculated?: (
    result: PriceResult,
    meta: PriceCalculatedMeta,
  ) => void;
  onSalesToolSelect?: (
    toolId: SalesToolId,
  ) => void;
  enabledToolIds?: readonly SalesToolId[];
  /**
   * Bumped by the parent to force-open the Price Calculator from outside
   * (e.g. "Sözleşme Hazırla" pressed with no approved price yet). Only
   * changes after mount are honored — the value carried in on first
   * render is not treated as an open request.
   */
  priceCalculatorOpenRequestId?: number;
  /** The sidebar-selected fuar — the single active context for pricing. */
  priceCalculatorExhibition: PriceCalculatorExhibitionContext | null;
  /**
   * Sprint 25.2 — when set, "Sözleşme Hazırla" is disabled and its
   * tooltip shows this message instead of the tool's static title (e.g.
   * no real opportunity exists yet for the current fuar, so there can be
   * no Approved Price Snapshot to build a contract from).
   */
  quotationDisabledReason?: string | null;
  /**
   * Sprint 25.2.1 — when set (no fuar selected in the sidebar at all),
   * every fuar-dependent tool (fiyat hesaplama, sözleşme, kroki/fuar
   * takvimi) is disabled with this message as its tooltip. Note-taking
   * and "Görüşmeyi Tamamla" stay usable regardless — only these are
   * gated. Takes priority over quotationDisabledReason.
   */
  fuarRequiredDisabledReason?: string | null;
  /**
   * Sprint 25.5 — set once the selected opportunity's stage is "won" or
   * "lost". Takes priority over every other disabled-reason: the whole
   * session becomes read-only (note, follow-up, price/quotation/email
   * tools, "Görüşmeyi Tamamla" all disabled) and a banner explains why.
   * Past information (the note field's own content, the summary strip,
   * the last follow-up) stays visible — only the ability to change
   * anything is removed.
   */
  closedOpportunityReason?: string | null;
};

export function LiveInteraction({
  workspace,
  saving = false,
  draftNote,
  onDraftNoteChange,
  onSaveNote,
  onCompleteSession,
  onQuickAction,
  manualFollowUp,
  onSaveManualFollowUp,
  followUpSaving = false,
  onPriceCalculated,
  onSalesToolSelect,
  enabledToolIds,
  priceCalculatorOpenRequestId,
  priceCalculatorExhibition,
  quotationDisabledReason,
  fuarRequiredDisabledReason,
  closedOpportunityReason,
}: Props) {
  const [followUpPopoverOpen, setFollowUpPopoverOpen] =
    useState(false);
  const [customFollowUpDate, setCustomFollowUpDate] =
    useState("");

  const [
    isPriceCalculatorOpen,
    setIsPriceCalculatorOpen,
  ] = useState(false);

  const isFirstOpenRequestRender =
    useRef(true);

  useEffect(() => {
    if (
      isFirstOpenRequestRender.current
    ) {
      isFirstOpenRequestRender.current =
        false;

      return;
    }

    if (priceCalculatorOpenRequestId) {
      setIsPriceCalculatorOpen(true);
    }
  }, [priceCalculatorOpenRequestId]);

  function handleNoteChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    onDraftNoteChange(event.target.value);
  }

  function handleSaveNote() {
    if (!draftNote.trim() || saving || closedOpportunityReason) {
      return;
    }

    // Sprint 25.3 — local confirmation only; the text is already staged
    // in the Exhibition Session draft via handleNoteChange above. Nothing
    // is written to Supabase, and the textarea is intentionally left
    // as-is (there is no "persisted" state to clear it into anymore).
    onSaveNote();
  }

  async function handleCompleteSession() {
    const trimmedNote =
      draftNote.trim();

    if (saving || closedOpportunityReason) {
      return;
    }

    await onCompleteSession(
      trimmedNote,
      manualFollowUp?.title ??
        workspace.opportunity.nextAction,
    );
  }

  function createFollowUpDate(
    days: number,
    months = 0,
  ): string {
    const dueDate = new Date();

    if (months > 0) {
      dueDate.setMonth(dueDate.getMonth() + months);
    } else {
      dueDate.setDate(dueDate.getDate() + days);
    }

    dueDate.setHours(10, 0, 0, 0);
    return dueDate.toISOString();
  }

  async function saveFollowUp(
    selection: ManualFollowUpSelection,
  ) {
    if (closedOpportunityReason) {
      return;
    }

    await onSaveManualFollowUp(selection);
    setFollowUpPopoverOpen(false);
    setCustomFollowUpDate("");
  }

  function formatFollowUpDate(
    value: string | null | undefined,
  ): string {
    if (!value) {
      return "Tarih seçilmedi";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Tarih seçilmedi"
      : date.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  }

  function isSalesToolEnabled(
    toolId: SalesToolId,
  ): boolean {
    // Sprint 25.5 — a closed (won/lost) opportunity is fully read-only;
    // this outranks every other disabled-reason below.
    if (closedOpportunityReason) {
      return false;
    }

    // Sprint 25.2.1 — with no fuar selected at all, nothing
    // fuar-dependent works — not just quotation.
    if (fuarRequiredDisabledReason) {
      return false;
    }

    if (
      toolId === "quotation" &&
      quotationDisabledReason
    ) {
      return false;
    }

    if (
      toolId === "floor-plan" ||
      toolId === "price-calculator"
    ) {
      return true;
    }

    return (
      Boolean(onSalesToolSelect) &&
      (enabledToolIds === undefined ||
        enabledToolIds.includes(
          toolId,
        ))
    );
  }

  function handleSalesToolClick(
    toolId: SalesToolId,
  ) {
    if (!isSalesToolEnabled(toolId)) {
      return;
    }

    if (toolId === "floor-plan") {
      onQuickAction(
        "Information Package",
      );

      return;
    }

    if (toolId === "price-calculator") {
      setIsPriceCalculatorOpen(true);

      return;
    }

    onSalesToolSelect?.(toolId);
  }

  const priceCalculatorTool =
    SALES_TOOLS.find(
      (tool) =>
        tool.id === "price-calculator",
    )!;

  const quotationTool = SALES_TOOLS.find(
    (tool) => tool.id === "quotation",
  )!;

  const emailTool = SALES_TOOLS.find(
    (tool) => tool.id === "email",
  )!;

  return (
    <>
      <Panel className="live-panel sw-live-panel">
        <div className="panel-head sw-live-panel-head">
          <div className="sw-live-title-group">
            <p className="eyebrow">
              Canlı Çalışma Alanı
            </p>
          </div>

          {closedOpportunityReason ? (
            <span className="status">Kapatıldı</span>
          ) : (
            <span className="status status-active">
              Aktif
            </span>
          )}
        </div>

        {closedOpportunityReason ? (
          <p
            role="status"
            className="muted"
            style={{
              margin: "0 0 8px",
              padding: "6px 10px",
              borderRadius: 8,
              background: "var(--atlas-soft)",
              border: "1px solid var(--atlas-border)",
              fontSize: 12,
            }}
          >
            {closedOpportunityReason}
          </p>
        ) : null}

        <div className="live-controls-row">
          <div className="live-next-row sw-live-next-row">
            <div className="sw-live-main-column">
              <textarea
                className="notes sw-live-notes"
                placeholder={`• Müşteri talepleri
• İtirazlar
• Sözler
• Rakipler
• Notlar...`}
                value={draftNote}
                onChange={handleNoteChange}
                readOnly={Boolean(closedOpportunityReason)}
              />

              <div className="sw-live-summary-strip">
                <div className="sw-live-summary-row">
                  <span>
                    <UserRound size={12} />
                    {
                      workspace.customer
                        .fullName
                    }
                  </span>

                  <span>
                    <Building2 size={12} />
                    {
                      workspace.exhibition
                        .name
                    }
                  </span>
                </div>

                <div className="sw-live-summary-row">
                  <span>
                    <Ruler size={12} />
                    {
                      workspace.exhibition
                        .standSizeLabel
                    }
                  </span>

                  <span>
                    <BadgeEuro size={12} />
                    {
                      workspace.opportunity
                        .formattedEstimatedValue
                    }
                  </span>
                </div>
              </div>

              <div className="next-action" style={{ position: "relative" }}>
                <h3>
                  Sonraki Planlanan Aktivite
                </h3>

                <button
                  type="button"
                  aria-expanded={followUpPopoverOpen}
                  disabled={Boolean(closedOpportunityReason)}
                  onClick={() =>
                    setFollowUpPopoverOpen((current) => !current)
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 8px",
                    border: "1px solid var(--atlas-border)",
                    borderRadius: 8,
                    color: "var(--atlas-text)",
                    background: "white",
                    textAlign: "left",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 11 }}>
                      {manualFollowUp?.title ?? "Planlanmış aktivite yok"}
                    </strong>
                    <small className="muted">
                      {formatFollowUpDate(manualFollowUp?.dueDate)}
                    </small>
                  </span>
                  <ChevronDown size={14} />
                </button>

                {followUpPopoverOpen ? (
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "calc(100% + 4px)",
                      zIndex: 40,
                      display: "grid",
                      gap: 4,
                      padding: 6,
                      border: "1px solid var(--atlas-border)",
                      borderRadius: 9,
                      background: "white",
                      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.16)",
                    }}
                  >
                    {[
                      ["Yarın Ara", 1, 0],
                      ["3 Gün Sonra Ara", 3, 0],
                      ["Haftaya Ara", 7, 0],
                      ["1 Ay Sonra Ara", 0, 1],
                    ].map(([title, days, months]) => (
                      <button
                        key={String(title)}
                        type="button"
                        role="menuitem"
                        disabled={followUpSaving}
                        onClick={() =>
                          void saveFollowUp({
                            title: String(title),
                            dueDate: createFollowUpDate(
                              Number(days),
                              Number(months),
                            ),
                          })
                        }
                      >
                        {title}
                      </button>
                    ))}

                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        type="date"
                        aria-label="Takip tarihi seç"
                        value={customFollowUpDate}
                        onChange={(event) =>
                          setCustomFollowUpDate(event.target.value)
                        }
                        style={{ minWidth: 0, flex: 1 }}
                      />
                      <button
                        type="button"
                        disabled={!customFollowUpDate || followUpSaving}
                        onClick={() => {
                          const dueDate = new Date(
                            `${customFollowUpDate}T10:00:00`,
                          );
                          void saveFollowUp({
                            title: "Takip Araması",
                            dueDate: dueDate.toISOString(),
                          });
                        }}
                      >
                        Tarih Seç
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="session-actions-stack">
              <button
                type="button"
                title={
                  closedOpportunityReason ??
                  fuarRequiredDisabledReason ??
                  priceCalculatorTool.title
                }
                disabled={
                  !isSalesToolEnabled(
                    priceCalculatorTool.id,
                  )
                }
                onClick={() =>
                  handleSalesToolClick(
                    priceCalculatorTool.id,
                  )
                }
              >
                <priceCalculatorTool.icon
                  size={13}
                />
                Fiyat Hesapla
              </button>

              <button
                type="button"
                title={
                  closedOpportunityReason ??
                  fuarRequiredDisabledReason ??
                  quotationDisabledReason ??
                  quotationTool.title
                }
                disabled={
                  !isSalesToolEnabled(
                    quotationTool.id,
                  )
                }
                onClick={() =>
                  handleSalesToolClick(
                    quotationTool.id,
                  )
                }
              >
                <quotationTool.icon
                  size={13}
                />
                {quotationTool.title}
              </button>

              <button
                type="button"
                title={
                  closedOpportunityReason ??
                  fuarRequiredDisabledReason ??
                  emailTool.title
                }
                disabled={
                  !isSalesToolEnabled(
                    emailTool.id,
                  )
                }
                onClick={() =>
                  handleSalesToolClick(
                    emailTool.id,
                  )
                }
              >
                <emailTool.icon
                  size={13}
                />
                {emailTool.title}
              </button>

              <button
                type="button"
                onClick={handleSaveNote}
                disabled={saving || Boolean(closedOpportunityReason)}
              >
                <Save size={13} />

                {saving
                  ? "Kaydediliyor..."
                  : "Not Kaydet"}
              </button>

              <button
                type="button"
                onClick={() => setFollowUpPopoverOpen(true)}
                disabled={followUpSaving || Boolean(closedOpportunityReason)}
              >
                <CalendarDays size={13} />

                {followUpSaving
                  ? "Oluşturuluyor..."
                  : "Takip Et"}
              </button>

              <button
                type="button"
                className="finish-session-button"
                onClick={() =>
                  void handleCompleteSession()
                }
                disabled={
                  saving ||
                  Boolean(closedOpportunityReason) ||
                  draftNote.trim()
                    .length === 0
                }
              >
                <CheckCircle2 size={13} />
                Görüşmeyi Tamamla
              </button>
            </div>
          </div>
        </div>
      </Panel>

      <PriceCalculatorModal
        isOpen={isPriceCalculatorOpen}
        exhibition={
          priceCalculatorExhibition
        }
        onClose={() =>
          setIsPriceCalculatorOpen(false)
        }
        onCalculated={onPriceCalculated}
      />
    </>
  );
}
