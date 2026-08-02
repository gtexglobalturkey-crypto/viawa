import type { OpportunityStage } from "./salesAction";

/**
 * Canonical id for an operational follow-up action a representative can pick
 * at the end of a call. This is intentionally separate from Business Status
 * (opportunity.stage) and from AI Recommendation (workspaceMapper ai.*):
 * it only represents what the rep does/plans next, not the commercial state
 * of the opportunity.
 */
export type WorkspaceFollowUpActionId =
  | "call-tomorrow"
  | "prepare-offer"
  | "prepare-contract"
  | "waiting-customer"
  | "participation-confirmed";

export type WorkspaceFollowUpAction = {
  id: WorkspaceFollowUpActionId;

  label: string;

  legacyValues: string[];

  executionActionId: string;

  resultingStage: OpportunityStage | null;

  persistedNextAction: string;
};

const NO_FOLLOW_UP_ACTION_LABEL =
  "Planlanmış aksiyon yok";

const UNKNOWN_FOLLOW_UP_ACTION_LABEL =
  "Takip aksiyonu güncellenmedi";

const DEFAULT_EXECUTION_ACTION_ID =
  "follow-up";

export const WORKSPACE_FOLLOW_UP_ACTIONS: WorkspaceFollowUpAction[] =
  [
    {
      id: "call-tomorrow",
      label: "Yarın Ara",
      legacyValues: [
        "Call Tomorrow",
        "Review call outcome and complete next action",
      ],
      executionActionId: "call",
      resultingStage: null,
      persistedNextAction:
        "Yarın müşteriyi arayın.",
    },
    {
      id: "prepare-offer",
      label: "Teklif Hazırla",
      legacyValues: [
        "Prepare Offer",
        "Wait for quotation feedback",
      ],
      executionActionId: "quotation",
      resultingStage: "quotation-sent",
      persistedNextAction:
        "Teklif hazırlanıp müşteriye gönderilecek.",
    },
    {
      id: "prepare-contract",
      label: "Sözleşme Hazırla",
      legacyValues: [
        "Prepare Contract",
        "Track signed contract",
      ],
      executionActionId: "contract",
      resultingStage: "contract",
      persistedNextAction:
        "Sözleşme hazırlanıp müşteriye gönderilecek.",
    },
    {
      id: "waiting-customer",
      label: "Müşteri Bekleniyor",
      legacyValues: [
        "Waiting Customer",
      ],
      executionActionId:
        DEFAULT_EXECUTION_ACTION_ID,
      resultingStage: null,
      persistedNextAction:
        "Müşteriden yanıt bekleniyor.",
    },
    {
      id: "participation-confirmed",
      label: "Katılım Onaylandı",
      legacyValues: [
        "Participation Confirmed",
      ],
      executionActionId:
        DEFAULT_EXECUTION_ACTION_ID,
      resultingStage: null,
      persistedNextAction:
        "Katılım onaylandı.",
    },
  ];

function normalize(
  value: string,
): string {
  return value.trim().toLowerCase();
}

export function findWorkspaceFollowUpAction(
  rawValue: string | null | undefined,
): WorkspaceFollowUpAction | null {
  if (!rawValue || !rawValue.trim()) {
    return null;
  }

  const normalizedValue =
    normalize(rawValue);

  return (
    WORKSPACE_FOLLOW_UP_ACTIONS.find(
      (action) =>
        normalize(action.id) ===
          normalizedValue ||
        normalize(action.label) ===
          normalizedValue ||
        action.legacyValues.some(
          (legacyValue) =>
            normalize(legacyValue) ===
            normalizedValue,
        ),
    ) ?? null
  );
}

export function findWorkspaceFollowUpActionByExecutionId(
  executionActionId: string,
): WorkspaceFollowUpAction | null {
  return (
    WORKSPACE_FOLLOW_UP_ACTIONS.find(
      (action) =>
        action.executionActionId ===
        executionActionId,
    ) ?? null
  );
}

export function resolveWorkspaceFollowUpExecutionActionId(
  rawValue: string | null | undefined,
): string {
  return (
    findWorkspaceFollowUpAction(rawValue)
      ?.executionActionId ??
    DEFAULT_EXECUTION_ACTION_ID
  );
}

/**
 * Normalizes any raw opportunity.next_action value (current dropdown ids,
 * legacy dropdown labels, or legacy execution-generated sentences) into a
 * safe, user-facing Turkish label. Unknown/unrecognized values never leak
 * raw technical strings into the UI.
 */
export function getWorkspaceFollowUpActionLabel(
  rawValue: string | null | undefined,
): string {
  if (!rawValue || !rawValue.trim()) {
    return NO_FOLLOW_UP_ACTION_LABEL;
  }

  return (
    findWorkspaceFollowUpAction(rawValue)
      ?.label ??
    UNKNOWN_FOLLOW_UP_ACTION_LABEL
  );
}
