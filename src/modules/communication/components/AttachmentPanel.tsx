import type { CommunicationAttachment } from "../models/CommunicationAttachment";

type Props = {
  attachments: CommunicationAttachment[];
};

function getFileTypeLabel(
  fileName: string,
): string | null {
  const separatorIndex =
    fileName.lastIndexOf(".");

  if (separatorIndex === -1) {
    return null;
  }

  return fileName
    .slice(separatorIndex + 1)
    .toUpperCase();
}

export function AttachmentPanel({ attachments }: Props) {
  return (
    <div className="data-list" style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
      {attachments.map((attachment) => {
        const fileType = getFileTypeLabel(
          attachment.fileName,
        );

        const showDisplayName =
          attachment.displayName &&
          attachment.displayName !==
            attachment.fileName;

        return (
          <div
            key={attachment.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              minWidth: 0,
              padding: "6px 8px",
              borderRadius: "8px",
              background: "var(--atlas-soft)",
            }}
          >
            <span style={{ flex: "0 0 auto", fontSize: "12px" }}>📎</span>
            <span style={{ minWidth: 0, fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>
              {showDisplayName
                ? `${attachment.displayName} — ${attachment.fileName}`
                : attachment.fileName}
              {fileType && (
                <span style={{ marginLeft: "6px", color: "#94a3b8", fontWeight: 700 }}>
                  {fileType}
                </span>
              )}
              {attachment.source === "exhibition-workspace" && (
                <span style={{ marginLeft: "6px", color: "#94a3b8", fontWeight: 700 }}>
                  Fuar Belgesi
                </span>
              )}
              {attachment.source === "document-basket" && (
                <span style={{ marginLeft: "6px", color: "#94a3b8", fontWeight: 700 }}>
                  Belge Sepeti
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}