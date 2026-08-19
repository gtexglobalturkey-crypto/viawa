import { Archive, ExternalLink, Forward, Reply } from "lucide-react";

import type { Conversation } from "../models/Conversation";

function formatMessageDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MailPreviewPaneProps = {
  conversation: Conversation | null;
  onReply: () => void;
  onForward: () => void;
  onArchive: (conversationId: string) => void;
  onOpenInWorkspace: (conversation: Conversation) => void;
};

// Sprint 25.6 — "Mail okunur. Normal mail programı mantığında çalışır."
// Only the 4 allowed actions (Oku [= selecting the conversation, handled
// by the parent], Yanıtla, İlet, Arşivle) plus the placeholder
// "Workspace'te Aç" — nothing commercial (no price/quotation/contract).
export function MailPreviewPane({
  conversation,
  onReply,
  onForward,
  onArchive,
  onOpenInWorkspace,
}: MailPreviewPaneProps) {
  if (!conversation) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 24,
        }}
      >
        <p className="muted" style={{ fontSize: 12 }}>
          Görüntülemek için bir yazışma seçin.
        </p>
      </div>
    );
  }

  const isArchived = conversation.folder === "archive";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <header
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--viawa-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 15 }}>
            {conversation.lastMessage.subject}
          </h2>
          <p
            className="muted"
            style={{ margin: "2px 0 0", fontSize: 12 }}
          >
            {conversation.counterpartName}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onReply}
          >
            <Reply size={13} />
            Yanıtla
          </button>

          <button
            type="button"
            className="btn"
            onClick={onForward}
          >
            <Forward size={13} />
            İlet
          </button>

          <button
            type="button"
            className="btn"
            disabled={isArchived}
            onClick={() => onArchive(conversation.id)}
          >
            <Archive size={13} />
            {isArchived ? "Arşivde" : "Arşivle"}
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => onOpenInWorkspace(conversation)}
          >
            <ExternalLink size={13} />
            Workspace'te Aç
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {conversation.messages.map((message) => (
          <article
            key={message.id}
            style={{
              border: "1px solid var(--viawa-border)",
              borderRadius: 8,
              padding: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 11,
              }}
            >
              <strong>{message.from}</strong>
              <span className="muted">
                {formatMessageDate(message.receivedAt)}
              </span>
            </div>

            <p
              className="muted"
              style={{
                fontSize: 11,
                margin: "2px 0 8px",
              }}
            >
              {`Kime: ${message.to.join(", ") || "—"}`}
              {message.cc.length > 0
                ? ` · Bilgi: ${message.cc.join(", ")}`
                : ""}
            </p>

            <p
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {message.bodyPreview || "—"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
