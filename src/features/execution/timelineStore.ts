import { TimelineEvent } from "./timelineBuilder";

const timeline: TimelineEvent[] = [];

export function addTimelineEvent(event: TimelineEvent) {
  const exists = timeline.some(
    (item) =>
      item.title === event.title &&
      item.text === event.text &&
      item.eventType === event.eventType
  );

  if (exists) {
    return;
  }

  timeline.unshift(event);
}

export function getTimeline() {
  return [...timeline];
}

export function clearTimeline() {
  timeline.length = 0;
}