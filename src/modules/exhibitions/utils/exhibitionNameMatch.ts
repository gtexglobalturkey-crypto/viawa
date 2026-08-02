// Client-side mirror of the fuzzy folder-name matching used server-side
// in vite-plugins/documentBasketPlugin.ts (resolveExhibitionRoot) — the
// two can't share a module since vite-plugins/** and src/** are separate
// TypeScript projects. Kept in sync manually: normalize (lowercase,
// strip Turkish diacritics, drop non-alphanumerics), strip a trailing
// year (the same template/config is reused year over year — "WAMPEX
// 2027" must still match a "WAMPEX 2026"-labeled config), then accept a
// match if either side's core name contains the other's.
function normalizeExhibitionName(
  value: string,
): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]/g, "");
}

function stripTrailingYear(
  normalizedName: string,
): string {
  return normalizedName.replace(/\d+$/, "");
}

function toMatchCore(value: string): string {
  return stripTrailingYear(
    normalizeExhibitionName(value),
  );
}

/**
 * True when two exhibition name strings (full name, short name, or a
 * configured rule's label) reasonably refer to the same exhibition,
 * ignoring case, Turkish diacritics, punctuation and a trailing year.
 */
export function exhibitionNamesMatch(
  first: string | null | undefined,
  second: string | null | undefined,
): boolean {
  if (!first || !second) {
    return false;
  }

  const firstCore = toMatchCore(first);
  const secondCore = toMatchCore(second);

  if (!firstCore || !secondCore) {
    return false;
  }

  return (
    firstCore.includes(secondCore) ||
    secondCore.includes(firstCore)
  );
}
