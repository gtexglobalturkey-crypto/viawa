import type {
  CallNote,
  TimelineEvent,
} from "../../../types/database";

import type {
  WorkspaceConversationItem,
} from "./workspaceViewModel";

import {
  formatWorkspaceDate,
  getWorkspaceActivityIcon,
} from "./workspaceFormatters";

function mapTimelineEvent(
  event: TimelineEvent,
): WorkspaceConversationItem {
  return {
    id: event.id,
    source: "timeline",
    icon: getWorkspaceActivityIcon(
      event.type,
    ),
    type: event.type ?? "activity",
    title: event.title,
    text:
      event.description ??
      "No description recorded.",
    createdAt: event.created_at,
    dateLabel: formatWorkspaceDate(
      event.created_at,
    ),
  };
}

function mapCallNote(
  note: CallNote,
): WorkspaceConversationItem {
  return {
    id: note.id,
    source: "call-note",
    icon: "📝",
    type: "note",
    title: "Conversation Note",
    text: note.note,
    createdAt: note.updated_at,
    dateLabel: formatWorkspaceDate(
      note.updated_at,
    ),
  };
}

export function createConversationHistory(
  timelineEvents: TimelineEvent[],
  callNotes: CallNote[],
): WorkspaceConversationItem[] {
  return [
    ...timelineEvents.map(
      mapTimelineEvent,
    ),
    ...callNotes.map(mapCallNote),
  ].sort(
    (firstItem, secondItem) =>
      new Date(
        secondItem.createdAt,
      ).getTime() -
      new Date(
        firstItem.createdAt,
      ).getTime(),
  );
}