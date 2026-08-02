import { useMemo, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import { translateSystemGeneratedText } from "../../../features/execution/atlasTextTranslations";
import { TEMPLATE_DISPLAY_NAMES } from "../../communication/services/templateService";

import type { CallWorkspaceViewModel } from "../models/workspaceViewModel";

import { AiCopilot } from "./AiCopilot";

// Timeline entries created from a Communication template send store the
// raw English template id (e.g. "Quotation") as their title — the same
// ids already have a Turkish label wherever the template picker shows
// them, reused here instead of inventing a second mapping.
function translateTimelineTitle(
  title: string,
): string {
  return (
    TEMPLATE_DISPLAY_NAMES[title] ?? title
  );
}

const LEGACY_TIMELINE_RECOMMENDATIONS = [
  "A follow-up should be completed after the customer has reviewed the documents.",
  "The opportunity should be reviewed again after the customer evaluates the new terms.",
  "A follow-up should be scheduled to discuss the offer and answer any questions.",
  "The next action is to follow up on approval, requested changes or signature.",
  "The opportunity should remain active until receipt is confirmed.",
  "The conversation outcome and next action should guide the opportunity forward.",
  "Preparation and follow-up activities should be completed around the meeting date.",
] as const;

function suppressLegacyTimelineRecommendations(
  text: string,
): string {
  return LEGACY_TIMELINE_RECOMMENDATIONS.reduce(
    (factualText, recommendation) =>
      factualText.replace(recommendation, ""),
    text,
  )
    .replace(/\s+/g, " ")
    .trim();
}

type Props = {
  conversation:
    CallWorkspaceViewModel["conversationHistory"];
  workspace: CallWorkspaceViewModel;
};

type ConversationHistoryTab =
  | "history"
  | "ai";

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
  "contract-generated",
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
  workspace,
}: Props) {
  const [activeTab, setActiveTab] =
    useState<ConversationHistoryTab>(
      "history",
    );

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
      <div className="conversation-history-tabs">
        <button
          type="button"
          className={`conversation-history-tab${
            activeTab === "history"
              ? " active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("history")
          }
        >
          📝 Görüşme Merkezi
        </button>

        <button
          type="button"
          className={`conversation-history-tab${
            activeTab === "ai"
              ? " active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("ai")
          }
        >
          🤖 VIAWA AI
        </button>
      </div>

      {activeTab === "history" ? (
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

                <strong>
                  {translateTimelineTitle(
                    item.title,
                  )}
                </strong>

                <time dateTime={item.createdAt}>
                  {item.dateLabel}
                </time>
              </div>

              <p>
                {translateSystemGeneratedText(
                  item.source === "timeline"
                    ? suppressLegacyTimelineRecommendations(
                        item.text,
                      )
                    : item.text,
                )}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <AiCopilot workspace={workspace} />
      )}
    </Panel>
  );
}
