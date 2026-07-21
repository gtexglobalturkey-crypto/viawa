import { BusinessEventType } from "./types";

export function mapActionToEvent(actionId: string): BusinessEventType {
  switch (actionId) {
    case "information-package":
      return "EMAIL_SENT";

    case "quotation":
      return "QUOTE_CREATED";

    case "revised-quotation":
      return "QUOTE_CREATED";

    case "contract":
      return "CONTRACT_SENT";

    case "thank-you":
      return "NOTE_CREATED";

    default:
      return "UNKNOWN";
  }
}