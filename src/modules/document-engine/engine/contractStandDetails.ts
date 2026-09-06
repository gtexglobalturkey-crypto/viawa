import { MATERIAL_KEYS } from "../merge/participationContractMapping";
import type { StandMaterialsFormState } from "./standMaterialsFormState";

export type ContractStandDetails = { standMaterials: StandMaterialsFormState; extraInformation: string[] };

// An optional, exact generation snapshot. Older clients keep using persisted data.
export function parseContractStandDetails(value: unknown): ContractStandDetails {
  const invalid = () => { throw new Error("INVALID_STAND_DETAILS"); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "extraInformation,standMaterials") return invalid();
  const materials = record.standMaterials;
  if (!materials || typeof materials !== "object" || Array.isArray(materials)
    || Object.keys(materials).sort().join(",") !== [...MATERIAL_KEYS].sort().join(",")) return invalid();
  const result = {} as StandMaterialsFormState;
  for (const key of MATERIAL_KEYS) {
    const item = (materials as Record<string, unknown>)[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) return invalid();
    const entry = item as Record<string, unknown>;
    if (Object.keys(entry).sort().join(",") !== "quantity,selected" || typeof entry.selected !== "boolean"
      || !(entry.quantity === null || typeof entry.quantity === "number" && Number.isSafeInteger(entry.quantity) && entry.quantity > 0)) return invalid();
    result[key] = { selected: entry.selected, quantity: entry.quantity as number | null };
  }
  if (!Array.isArray(record.extraInformation) || record.extraInformation.length > 3
    || !record.extraInformation.every(line => typeof line === "string" && line.length <= 2000)) return invalid();
  return { standMaterials: result, extraInformation: [...record.extraInformation] };
}
