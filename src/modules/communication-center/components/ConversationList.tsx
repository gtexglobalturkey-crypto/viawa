import type { Conversation } from "../models/Conversation";

type ConversationListProps = {
  conversations: readonly Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
};

// Sprint 25.6 — "Liste tek tek mail göstermeyecek. Conversation
// gösterecek." One row per counterpart, showing only its last message.
export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <p
        className="muted"
        style={{ padding: 16, fontSize: 12 }}
      >
        Bu klasörde yazışma yok.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {conversations.map((conversation) => {
        const isSelected =
          conversation.id === selectedConversationId;

        return (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() =>
                onSelectConversation(conversation)
              }
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: 0,
                borderBottom:
                  "1px solid var(--viawa-border)",
                background: isSelected
                  ? "var(--viawa-soft)"
                  : "transparent",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <strong
                  style={{
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {conversation.counterpartName}
                </strong>

                {conversation.unreadCount > 0 ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: "var(--viawa-primary)",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </div>

              <p
                className="muted"
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conversation.lastMessage.subject}
              </p>

              <p
                className="muted"
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conversation.lastMessage.bodyPreview ||
                  "—"}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
