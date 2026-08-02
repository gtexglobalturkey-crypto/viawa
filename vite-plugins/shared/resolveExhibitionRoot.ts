import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { normalizeFolderName } from "./normalizeFolderName";

// Real per-exhibition folders live under here, one subfolder per
// exhibition (e.g. "01_mining_show_2025", "02_wampex_2026"). Shared by
// every dev-middleware plugin that needs to resolve "which real folder
// does this sidebar-selected fuar correspond to" — the document basket
// and the pricing config both reuse this single resolver rather than
// each growing their own independent folder-matching system.
export const EXHIBITIONS_ROOT = path.resolve(
  process.cwd(),
  "resources/templates/test-data/exhibitions",
);

// Only used when the caller doesn't specify an exhibition at all (the
// original Document Basket tool never did) — preserves that exact old
// behavior untouched.
const DEFAULT_EXHIBITION_ROOT = path.join(
  EXHIBITIONS_ROOT,
  "01_mining_show_2025",
);

function stripNumericPrefix(
  folderName: string,
): string {
  return folderName.replace(/^\d+[_-]?/, "");
}

// Folder templates are reused year over year (the same "wampex" pack
// backs "WAMPEX 2026", "WAMPEX 2027", etc.), so a trailing year is not
// part of the identity used for matching — only the trailing digits are
// stripped, so a real numeric distinction earlier in the name (e.g. a
// hall number) is left alone.
function stripTrailingYear(
  normalizedName: string,
): string {
  return normalizedName.replace(/\d+$/, "");
}

function findFolderMatchingName(
  entries: import("node:fs").Dirent[],
  candidateName: string,
): import("node:fs").Dirent | null {
  const normalizedTarget = stripTrailingYear(
    normalizeFolderName(candidateName),
  );

  if (!normalizedTarget) {
    return null;
  }

  const matchedEntry = entries.find((entry) => {
    const normalizedFolder = stripTrailingYear(
      normalizeFolderName(
        stripNumericPrefix(entry.name),
      ),
    );

    return (
      normalizedFolder.length > 0 &&
      (normalizedFolder.includes(
        normalizedTarget,
      ) ||
        normalizedTarget.includes(
          normalizedFolder,
        ))
    );
  });

  return matchedEntry ?? null;
}

export type ResolvedExhibitionRoot = {
  absolutePath: string;
  folderName: string;
};

// Exhibition records (sidebar "Fuarlar") have no folder/slug field, so the
// folder is resolved by fuzzy name matching instead. Two candidate names
// are tried in order — the exhibition's full free-text "Fuar Adı" first,
// then its "Kısa Adı" (e.g. "WAMPEX") — because the full name field has no
// naming convention at all (a user can type anything, e.g. a venue's full
// official name that shares no substring with the on-disk folder), while
// the short name is much more likely to match how template folders are
// actually named on disk (e.g. "02_wampex_2026"). Each candidate is
// normalized and stripped of its trailing year before either side's
// substring is checked against the other (e.g. "WAMPEX 2027" against
// "02_wampex_2026" → cores "wampex" / "wampex" → match).
export function resolveExhibitionRoot(
  exhibitionName: string | null,
  exhibitionShortName: string | null,
): ResolvedExhibitionRoot | null {
  if (exhibitionName === null) {
    if (!existsSync(DEFAULT_EXHIBITION_ROOT)) {
      return null;
    }

    return {
      absolutePath: DEFAULT_EXHIBITION_ROOT,
      folderName: "01_mining_show_2025",
    };
  }

  if (!existsSync(EXHIBITIONS_ROOT)) {
    return null;
  }

  const entries = readdirSync(
    EXHIBITIONS_ROOT,
    { withFileTypes: true },
  ).filter((entry) => entry.isDirectory());

  const matchedEntry =
    findFolderMatchingName(
      entries,
      exhibitionName,
    ) ??
    (exhibitionShortName
      ? findFolderMatchingName(
          entries,
          exhibitionShortName,
        )
      : null);

  if (!matchedEntry) {
    return null;
  }

  return {
    absolutePath: path.join(
      EXHIBITIONS_ROOT,
      matchedEntry.name,
    ),
    folderName: matchedEntry.name,
  };
}
