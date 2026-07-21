import {
  CalendarDays,
  CheckCircle2,
  FileSignature,
  Mail,
  Map,
  Save,
} from "lucide-react";
import {
  type ChangeEvent,
  useState,
} from "react";

import { Panel } from "../../../components/ui/Panel";

const NEXT_ACTION_LABELS: Record<
  string,
  string
> = {
  "Call Tomorrow": "Yarın Ara",
  "Prepare Offer": "Teklif Hazırla",
  "Prepare Contract": "Sözleşme Hazırla",
  "Waiting Customer": "Müşteri Bekleniyor",
  "Participation Confirmed":
    "Katılım Onaylandı",
};

function getNextActionLabel(
  value: string,
): string {
  return (
    NEXT_ACTION_LABELS[value] ?? value
  );
}

type Props = {
  workspace: {
    opportunity: {
      nextAction: string;
    };
  };
  saving?: boolean;
  onSaveNote: (
    note: string,
    nextAction: string,
  ) => Promise<void>;
  onCompleteSession: (
    note: string,
    nextAction: string,
  ) => Promise<void>;
  onQuickAction: (
    templateId: string,
  ) => void;
  onCreateFollowUpReminder: () => void;
  followUpSaving?: boolean;
};

export function LiveInteraction({
  workspace,
  saving = false,
  onSaveNote,
  onCompleteSession,
  onQuickAction,
  onCreateFollowUpReminder,
  followUpSaving = false,
}: Props) {
  const [nextAction, setNextAction] = useState(
    workspace.opportunity.nextAction,
  );

  const [draftNote, setDraftNote] =
    useState("");

  function handleNoteChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    setDraftNote(event.target.value);
  }

  async function handleSaveNote() {
    const trimmedNote =
      draftNote.trim();

    if (!trimmedNote || saving) {
      return;
    }

    await onSaveNote(
      trimmedNote,
      nextAction,
    );

    setDraftNote("");
  }

  async function handleCompleteSession() {
    const trimmedNote =
      draftNote.trim();

    if (saving) {
      return;
    }

    await onCompleteSession(
      trimmedNote,
      nextAction,
    );
  }

  return (
    <Panel className="live-panel sw-live-panel">
      <div className="panel-head sw-live-panel-head">
        <div className="sw-live-title-group">
          <p className="eyebrow">
            Canlı Çalışma Alanı
          </p>

          <h2>
            Mevcut Müşteri Görüşmesi
          </h2>
        </div>

        <span className="status">
          Aktif
        </span>
      </div>

      <textarea
        className="notes sw-live-notes"
        placeholder={`• Müşteri talepleri
• İtirazlar
• Sözler
• Rakipler
• Notlar...`}
        value={draftNote}
        onChange={handleNoteChange}
      />

      <div className="live-controls-row">
        <div className="action-grid sw-live-actions">
          <button
            type="button"
            onClick={() =>
              onQuickAction("Quotation")
            }
          >
            <Mail size={16} />
            Teklif Gönder
          </button>

          <button
            type="button"
            onClick={() =>
              onQuickAction("Contract")
            }
          >
            <FileSignature size={16} />
            Sözleşme
          </button>

          <button
            type="button"
            onClick={() =>
              onQuickAction(
                "Information Package",
              )
            }
          >
            <Map size={16} />
            Kroki
          </button>

          <button
            type="button"
            onClick={
              onCreateFollowUpReminder
            }
            disabled={followUpSaving}
          >
            <CalendarDays size={16} />

            {followUpSaving
              ? "Oluşturuluyor..."
              : "Takip Et"}
          </button>

          <button
            type="button"
            onClick={() =>
              void handleSaveNote()
            }
            disabled={
              saving
            }
          >
            <Save size={16} />

            {saving
              ? "Kaydediliyor..."
              : "Not Kaydet"}
          </button>
        </div>

        <div className="live-next-row sw-live-next-row">
          <div className="next-action">
            <h3>
              Sonraki Planlanan Aktivite
            </h3>

            <select
              value={nextAction}
              onChange={(event) =>
                setNextAction(
                  event.target.value,
                )
              }
            >
              <option
                value={
                  workspace.opportunity
                    .nextAction
                }
              >
                {getNextActionLabel(
                  workspace.opportunity
                    .nextAction,
                )}
              </option>

              <option value="Call Tomorrow">
                {getNextActionLabel(
                  "Call Tomorrow",
                )}
              </option>

              <option value="Prepare Offer">
                {getNextActionLabel(
                  "Prepare Offer",
                )}
              </option>

              <option value="Prepare Contract">
                {getNextActionLabel(
                  "Prepare Contract",
                )}
              </option>

              <option value="Waiting Customer">
                {getNextActionLabel(
                  "Waiting Customer",
                )}
              </option>

              <option value="Participation Confirmed">
                {getNextActionLabel(
                  "Participation Confirmed",
                )}
              </option>
            </select>
          </div>

          <button
            type="button"
            className="finish-session-button"
            onClick={() =>
              void handleCompleteSession()
            }
            disabled={
              saving ||
              draftNote.trim().length === 0
            }
          >
            <CheckCircle2 size={16} />
            Görüşmeyi Tamamla
          </button>
        </div>
      </div>
    </Panel>
  );
}
