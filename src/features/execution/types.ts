export type BusinessEventType =
  | "EMAIL_SENT"
  | "CALL_COMPLETED"
  | "FOLLOWUP_CREATED"
  | "QUOTE_CREATED"
  | "CONTRACT_SENT"
  | "CONTRACT_SIGNED"
  | "PAYMENT_RECEIVED"
  | "NOTE_CREATED"
  | "UNKNOWN";

export interface ExecutionResult {
  success: boolean;

  title: string;
  description: string;

  eventType: BusinessEventType;

  refreshWorkspace?: boolean;
  addTimeline?: boolean;
  remember?: boolean;

  nextActionId?: string;
}