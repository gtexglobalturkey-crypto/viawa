import { BusinessEventType } from "./types";

export interface BusinessEvent {
  type: BusinessEventType;
  payload?: unknown;
}

type EventListener = (
  event: BusinessEvent,
) => void | Promise<void>;

const listeners: EventListener[] = [];

export function subscribe(
  listener: EventListener,
) {
  listeners.push(listener);

  return () => {
    const index =
      listeners.indexOf(listener);

    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
}

export async function publish(
  event: BusinessEvent,
): Promise<void> {
  await Promise.all(
    listeners.map((listener) =>
      Promise.resolve(listener(event)),
    ),
  );
}