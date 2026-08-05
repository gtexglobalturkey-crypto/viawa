import type { OpportunityStandMaterial } from "../../../types/database";
import {
  MATERIAL_KEYS,
  type MaterialKey,
} from "../merge/participationContractMapping";

export type StandMaterialsFormState = Record<
  MaterialKey,
  OpportunityStandMaterial
>;

export function createEmptyStandMaterialsFormState(): StandMaterialsFormState {
  const state = {} as StandMaterialsFormState;
  for (const key of MATERIAL_KEYS) {
    state[key] = { selected: false, quantity: null };
  }
  return state;
}

export function standMaterialsFormStateFromRecord(
  record:
    | Readonly<Record<string, OpportunityStandMaterial>>
    | null
    | undefined,
): StandMaterialsFormState {
  const state = createEmptyStandMaterialsFormState();
  for (const key of MATERIAL_KEYS) {
    const existing = record?.[key];
    if (existing) {
      state[key] = {
        selected: Boolean(existing.selected),
        quantity: existing.quantity ?? null,
      };
    }
  }
  return state;
}

/**
 * Toggling a material's checkbox. A first-time selection defaults its
 * quantity to 1; unselecting preserves whatever quantity was already
 * entered rather than clearing it, so re-checking the box later restores
 * it.
 */
export function toggleStandMaterialSelection(
  current: StandMaterialsFormState,
  key: MaterialKey,
): StandMaterialsFormState {
  const currentEntry = current[key];
  const nextSelected = !currentEntry.selected;

  return {
    ...current,
    [key]: {
      selected: nextSelected,
      quantity: nextSelected
        ? currentEntry.quantity ?? 1
        : currentEntry.quantity,
    },
  };
}

/**
 * Applies a raw quantity input value. Only a positive integer is ever
 * committed; an empty string clears the quantity; anything else invalid
 * (zero, negative, non-numeric, decimal) is ignored, leaving the
 * previous value in place.
 */
export function updateStandMaterialQuantity(
  current: StandMaterialsFormState,
  key: MaterialKey,
  rawValue: string,
): StandMaterialsFormState {
  const currentEntry = current[key];

  if (rawValue.trim() === "") {
    return {
      ...current,
      [key]: { ...currentEntry, quantity: null },
    };
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return current;
  }

  return {
    ...current,
    [key]: { ...currentEntry, quantity: parsed },
  };
}

/**
 * The free-text "Ekstra Malzeme / Açıklamalar" textarea is stored as up
 * to 3 lines (matching ExtraInformation.Line1-3 in the master template),
 * trimmed and with blank lines dropped so an empty/whitespace-only note
 * never produces a placeholder-looking line in the generated PDF.
 */
export function parseExtraInformationLines(
  text: string,
): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}
