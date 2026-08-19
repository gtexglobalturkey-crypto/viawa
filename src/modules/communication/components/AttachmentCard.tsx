import { Panel } from "../../../components/ui/Panel";

import type { CommunicationAttachment } from "../models/CommunicationAttachment";

import { AttachmentPanel } from "./AttachmentPanel";

type Props = {
  attachments: CommunicationAttachment[];
};

export function AttachmentCard({
  attachments,
}: Props) {
  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          Satış Kiti ({attachments.length})
        </p>

        <AttachmentPanel
          attachments={attachments}
        />

        {attachments.length === 0 && (
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--viawa-soft)", border: "1px solid var(--viawa-border)" }}>
            <p className="muted" style={{ margin: 0, fontSize: "10px", lineHeight: 1.3 }}>
              Bu şablon için ek gerekmiyor.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}