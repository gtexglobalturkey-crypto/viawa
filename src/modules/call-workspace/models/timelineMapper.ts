import type {
  TimelineEvent,
} from "../../../types/database";

import type {
  WorkspaceTimelineItem,
} from "./workspaceViewModel";

import {
  formatWorkspaceDate,
  getWorkspaceActivityIcon,
} from "./workspaceFormatters";

export function mapTimelineEvent(
  event: TimelineEvent,
): WorkspaceTimelineItem {
  return {
    id: event.id,
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

export function mapTimelineEvents(
  timelineEvents: TimelineEvent[],
): WorkspaceTimelineItem[] {
  return [...timelineEvents]
    .sort(
      (firstEvent, secondEvent) =>
        new Date(
          secondEvent.created_at,
        ).getTime() -
        new Date(
          firstEvent.created_at,
        ).getTime(),
    )
    .map(mapTimelineEvent);
}