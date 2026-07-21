import { BusinessEventType } from "./types";

export interface TimelineEvent {
  title: string;
  text: string;
  eventType: BusinessEventType;
  createdAt: string;
}

export function buildTimelineEvent(
  title: string,
  text: string,
  eventType: BusinessEventType
): TimelineEvent {
  return {
    title,
    text,
    eventType,
    createdAt: new Date().toISOString(),
  };
}