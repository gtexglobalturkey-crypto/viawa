import { useMemo } from "react";

import { Panel } from "../../../components/ui/Panel";

import type { CallWorkspaceViewModel } from "../models/workspaceViewModel";

type Props = {
  conversation:
    CallWorkspaceViewModel["conversationHistory"];
};

const COMPLETED_TIMELINE_TYPES = new Set([
  "call",
  "call-completed",
  "email",
  "email-sent",
  "information-sent",
  "followup-created",
  "follow-up-created",
  "reminder-created",
  "quote-created",
  "quotation-created",
  "quotation-sent",
  "contract-sent",
  "contract-signed",
  "payment-received",
  "note",
  "note-created",
]);

function isCompletedHistoryItem(
  item: CallWorkspaceViewModel["conversationHistory"][number],
): boolean {
  const normalizedType = item.type
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (item.source === "call-note") {
    return true;
  }

  if (item.source === "email") {
    return normalizedType === "sent";
  }

  return (
    item.source === "timeline" &&
    COMPLETED_TIMELINE_TYPES.has(
      normalizedType,
    )
  );
}

export function TimelinePanel({
  conversation,
}: Props) {
  const sortedConversation = useMemo(
    () =>
      conversation
        .filter(isCompletedHistoryItem)
        .map((item, originalIndex) => ({
          item,
          originalIndex,
        }))
        .sort((first, second) => {
          const timestampDifference =
            Date.parse(second.item.createdAt) -
            Date.parse(first.item.createdAt);

          return (
            timestampDifference ||
            first.originalIndex -
              second.originalIndex
          );
        })
        .map(({ item }) => item),
    [conversation],
  );

  return (
    <Panel className="conversation-history-panel">
      <p className="eyebrow">
        Görüşme Merkezi
      </p>

      <h2>Görüşme Geçmişi</h2>

      <div className="timeline conversation-history-list">
        {sortedConversation.map((item) => (
          <article
            className="timeline-item conversation-history-item"
            key={item.id}
          >
            <div className="conversation-history-item-header">
              <b className="conversation-history-icon">
                {item.icon}
              </b>

              <strong>{item.title}</strong>

              <time dateTime={item.createdAt}>
                {item.dateLabel}
              </time>
            </div>

            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
