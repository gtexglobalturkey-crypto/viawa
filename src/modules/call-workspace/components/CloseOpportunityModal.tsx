import { X } from "lucide-react";
import { useState } from "react";

import {
  LOST_REASON_OPTIONS,
} from "../../../types/opportunityClosure";
import type { LostReasonId } from "../../../types/opportunityClosure";

type Step = "result" | "lost-reason";

type CloseOpportunityModalProps = {
  onClose: () => void;
  /** "Görüşme Devam Ediyor" — today's unchanged "Görüşmeyi Tamamla" outcome. */
  onContinue: () => void;
  onConfirmWon: () => void;
  onConfirmLost: (
    reasonId: LostReasonId,
    note: string | null,
  ) => void;
  submitting: boolean;
  /**
   * Kritik Akış Düzeltmesi 3 — Firma Sayfası's "❌ İptal" opens straight
   * to the reason picker (there is no call/"Görüşme Sonucu" context to
   * ask about outside the Workspace). Defaults to "result", matching
   * every existing "Görüşmeyi Tamamla" caller unchanged. The modal
   * itself is not otherwise touched — this only changes which step is
   * shown first.
   */
  initialStep?: Step;
};

/**
 * BUG-S26-003 — "Görüşme Sonucu": the modal "Görüşmeyi Tamamla" now opens
 * before anything is committed. Three outcomes:
 *   - Görüşme Devam Ediyor: today's unchanged commit behavior.
 *   - Kazanıldı: today's unchanged Won write, now reached from here
 *     instead of a separate "Fırsatı Kapat" button (removed).
 *   - Katılmadı: same locked 10-reason list + "Diğer" free text as
 *     before, unchanged.
 * Purely a UI/orchestration layer — every actual write (commit engine,
 * stage/closed_at/closure_reason/closure_note, timeline) happens in
 * CustomerWorkspace, not here; this file's only job is collecting the
 * choice.
 */
export function CloseOpportunityModal({
  onClose,
  onContinue,
  onConfirmWon,
  onConfirmLost,
  submitting,
  initialStep = "result",
}: CloseOpportunityModalProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [selectedReasonId, setSelectedReasonId] =
    useState<LostReasonId | null>(null);
  const [note, setNote] = useState("");

  const isOtherSelected = selectedReasonId === "other";
  const canConfirmLost =
    selectedReasonId !== null &&
    (!isOtherSelected || note.trim().length > 0);

  function handleConfirmLost(): void {
    if (!selectedReasonId || !canConfirmLost) {
      return;
    }

    onConfirmLost(
      selectedReasonId,
      isOtherSelected ? note.trim() : null,
    );
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Görüşme Sonucu"
        style={{
          width: "min(360px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          background: "var(--atlas-surface, #fff)",
          borderRadius: 12,
          boxShadow: "0 20px 48px rgba(15, 23, 42, 0.24)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p className="eyebrow" style={{ margin: 0 }}>
            Görüşme Sonucu
          </p>

          <button
            type="button"
            aria-label="Kapat"
            disabled={submitting}
            onClick={onClose}
            style={{
              border: 0,
              background: "transparent",
              cursor: submitting
                ? "not-allowed"
                : "pointer",
              opacity: submitting ? 0.5 : 1,
              padding: 4,
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {step === "result" ? (
          <div
            role="radiogroup"
            aria-label="Görüşme sonucu"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={onContinue}
              style={{ justifyContent: "center" }}
            >
              Görüşme Devam Ediyor
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting}
              onClick={onConfirmWon}
              style={{ justifyContent: "center" }}
            >
              ✅ Kazanıldı
            </button>

            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={() => setStep("lost-reason")}
              style={{ justifyContent: "center" }}
            >
              ❌ Katılmadı
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Katılmama nedenini seçin
            </p>

            <div
              role="radiogroup"
              aria-label="Katılmama nedeni"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {LOST_REASON_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedReasonId === option.id}
                  className={
                    selectedReasonId === option.id
                      ? "btn btn-primary"
                      : "btn"
                  }
                  disabled={submitting}
                  onClick={() => setSelectedReasonId(option.id)}
                  style={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    fontSize: 12,
                  }}
                >
                  {`${option.emoji} ${option.label}`}
                </button>
              ))}
            </div>

            {isOtherSelected ? (
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Nedeni açıklayın..."
                aria-label="Diğer neden açıklaması"
                disabled={submitting}
                style={{
                  minHeight: 72,
                  padding: 8,
                  fontSize: 12,
                  border: "1px solid var(--atlas-border)",
                  borderRadius: 6,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            ) : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => setStep("result")}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Geri
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || !canConfirmLost}
                onClick={handleConfirmLost}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Kaydet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
