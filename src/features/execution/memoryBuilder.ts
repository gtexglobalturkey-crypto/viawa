import type { BusinessEventType } from "./types";

export interface MemoryEntry {
  title: string;
  description: string;
  summary: string;
  nextStep: string;
  risk: string;
  confidence: number;
  eventType: BusinessEventType;
  createdAt: string;
}

type MemoryContext = {
  summary: string;
  nextStep: string;
  risk: string;
  confidence: number;
};

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function buildMemoryContext(
  title: string,
  description: string,
): MemoryContext {
  const searchableValue =
    `${title} ${description}`.toLowerCase();

  if (
    searchableValue.includes(
      "information package",
    ) ||
    searchableValue.includes(
      "information-package",
    )
  ) {
    return {
      summary:
        "The information package was sent to the customer.",
      nextStep:
        "Follow up after the customer reviews the documents.",
      risk:
        "The opportunity may become inactive if the customer is not contacted again.",
      confidence: 95,
    };
  }

  if (
    searchableValue.includes(
      "revised quotation",
    ) ||
    searchableValue.includes(
      "revised-quotation",
    )
  ) {
    return {
      summary:
        "A revised quotation was sent to the customer.",
      nextStep:
        "Follow up to discuss the revised commercial terms.",
      risk:
        "The customer is waiting to evaluate the revised quotation.",
      confidence: 94,
    };
  }

  if (
    searchableValue.includes("quotation") ||
    searchableValue.includes("quote")
  ) {
    return {
      summary:
        "A quotation was sent to the customer.",
      nextStep:
        "Call the customer to discuss the quotation and answer questions.",
      risk:
        "The opportunity may stall while waiting for customer feedback.",
      confidence: 92,
    };
  }

  if (
    searchableValue.includes("contract")
  ) {
    return {
      summary:
        "A contract was sent to the customer for review.",
      nextStep:
        "Follow up for approval, requested changes or signature.",
      risk:
        "The contract is waiting for customer approval.",
      confidence: 94,
    };
  }

  if (
    searchableValue.includes(
      "additional document",
    ) ||
    searchableValue.includes(
      "additional-document",
    )
  ) {
    return {
      summary:
        "The requested additional documents were sent.",
      nextStep:
        "Confirm that the customer received the documents.",
      risk:
        "The opportunity may be delayed if the documents are not reviewed.",
      confidence: 91,
    };
  }

  if (
    searchableValue.includes(
      "follow-up call",
    ) ||
    searchableValue.includes(
      "follow up call",
    ) ||
    searchableValue.includes(
      "follow-up-call",
    )
  ) {
    return {
      summary:
        "A customer follow-up call was completed.",
      nextStep:
        "Complete the next action agreed during the conversation.",
      risk:
        "The opportunity requires a scheduled next action after the follow-up call.",
      confidence: 90,
    };
  }

  if (
    searchableValue.includes("call") ||
    searchableValue.includes("phone")
  ) {
    return {
      summary:
        "A customer call was completed.",
      nextStep:
        "Record and schedule the next agreed customer action.",
      risk:
        "The opportunity may lose momentum without a scheduled next action.",
      confidence: 90,
    };
  }

  if (
    searchableValue.includes("meeting")
  ) {
    return {
      summary:
        "A customer meeting was scheduled.",
      nextStep:
        "Prepare the necessary customer and opportunity information.",
      risk: "",
      confidence: 88,
    };
  }

  if (
    searchableValue.includes("thank you") ||
    searchableValue.includes("thank-you")
  ) {
    return {
      summary:
        "A thank-you message was sent to the customer.",
      nextStep:
        "Review whether another customer action is required.",
      risk: "",
      confidence: 87,
    };
  }

  if (
    searchableValue.includes("email") ||
    searchableValue.includes("mail")
  ) {
    return {
      summary:
        "A customer email was sent successfully.",
      nextStep:
        "Follow up according to the content of the email.",
      risk:
        "The customer conversation may stall without a follow-up.",
      confidence: 93,
    };
  }

  if (
    searchableValue.includes("reminder")
  ) {
    return {
      summary:
        "A customer follow-up reminder was created.",
      nextStep:
        "Complete the reminder on the scheduled date.",
      risk:
        "The customer action may become overdue if the reminder is missed.",
      confidence: 89,
    };
  }

  return {
    summary:
      normalizeText(description) ||
      `${normalizeText(title)} was completed.`,
    nextStep:
      "Review the opportunity and schedule the next customer action.",
    risk: "",
    confidence: 80,
  };
}

export function buildMemoryEntry(
  title: string,
  description: string,
  eventType: BusinessEventType,
): MemoryEntry {
  const normalizedTitle =
    normalizeText(title);

  const normalizedDescription =
    normalizeText(description);

  const context = buildMemoryContext(
    normalizedTitle,
    normalizedDescription,
  );

  return {
    title: normalizedTitle,
    description: normalizedDescription,
    summary: context.summary,
    nextStep: context.nextStep,
    risk: context.risk,
    confidence: context.confidence,
    eventType,
    createdAt: new Date().toISOString(),
  };
}