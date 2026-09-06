import { MATERIAL_KEYS, MATERIAL_LABELS, QUANTITY_MATERIAL_KEYS } from "../merge/participationContractMapping";
import type { GoogleContractPlaceholderMap } from "./googleContractPlaceholders";

// The locked Google template has literal checkbox lines, not material tokens.
// Match complete labelled lines from the generated copy, preserving its spacing.
export function googleStandMaterialReplacements(text: string, values: GoogleContractPlaceholderMap) {
  const replacements: { replaceAllText: { containsText: { text: string; matchCase: boolean }; replaceText: string } }[] = [];
  for (const key of MATERIAL_KEYS) {
    const selected = values[`StandMaterials.${key}.Selected`];
    if (!selected) continue; // Older callers without material mapping.
    const labels = key === "DigitalPrints" ? ["Dijital Baskı", "Dijital Baskılar"] : [MATERIAL_LABELS[key]];
    const escaped = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const hasQuantity = (QUANTITY_MATERIAL_KEYS as readonly string[]).includes(key);
    const pattern = new RegExp(`[☐☑☒][ \\t]+(?:${escaped})${hasQuantity ? "[ \\t]+(?:_{2,}|[0-9]+)" : ""}(?=[ \\t]*(?:\\r?\\n|$))`, "g");
    const matches = [...text.matchAll(pattern)];
    if (selected === "☑" && matches.length !== 1) throw new Error(`GOOGLE_MATERIAL_FIELD_MISSING_OR_AMBIGUOUS:${key}`);
    for (const match of matches) {
      const original = match[0];
      let replacement = selected + original.slice(1);
      if (hasQuantity) replacement = replacement.replace(/(?:_{2,}|[0-9]+)$/, values[`StandMaterials.${key}.Quantity`] ?? "___");
      replacements.push({ replaceAllText: { containsText: { text: original, matchCase: true }, replaceText: replacement } });
    }
  }
  return replacements;
}
