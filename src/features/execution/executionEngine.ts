import { ExecutionResult } from "./types";
import { mapActionToEvent } from "./eventMapper";

export function buildExecutionResult(
  actionId: string,
  title: string
): ExecutionResult {
  return {
    success: true,
    title,
    description: `${title} completed successfully.`,
    eventType: mapActionToEvent(actionId),
    refreshWorkspace: true,
    addTimeline: true,
    remember: true,
  };
}