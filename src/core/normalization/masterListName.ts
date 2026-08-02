/**
 * Shared normalization for master-list entry names (sectors, product
 * groups): trim, collapse repeated whitespace, and lowercase with the
 * Turkish locale specifically — plain `.toLowerCase()` is NOT
 * Turkish-aware ("İ".toLowerCase() → "i̇" with a combining dot, not
 * "i"; "I".toLowerCase() → "i", not the Turkish dotless "ı"), so
 * "Gıda" / "GIDA" / "gıda" would NOT collapse to the same value
 * without `toLocaleLowerCase("tr")` specifically.
 *
 * This intentionally mirrors, but is separate from, the plain
 * `.toLowerCase()` normalizers in
 * src/core/validation/companyDuplicateCheck.ts — those exist for a
 * different purpose (company/contact field de-duplication) and
 * changing their casing behavior is out of scope here.
 */
export function normalizeMasterListName(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr");
}
