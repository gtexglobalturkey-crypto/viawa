const TR_LOCALE = "tr-TR";

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

// Turkish casing is not ASCII case-insensitive (I/İ, ı/i), so word
// lookups are matched on an ASCII-folded key rather than via regex /i.
function foldToAsciiKey(value: string): string {
  let result = "";

  for (const char of value.replace(/\./g, "")) {
    switch (char) {
      case "ı":
      case "İ":
      case "i":
      case "I":
        result += "I";
        break;
      case "ş":
      case "Ş":
        result += "S";
        break;
      case "ğ":
      case "Ğ":
        result += "G";
        break;
      case "ü":
      case "Ü":
        result += "U";
        break;
      case "ö":
      case "Ö":
        result += "O";
        break;
      case "ç":
      case "Ç":
        result += "C";
        break;
      default:
        result += char.toUpperCase();
    }
  }

  return result;
}

function toTitleCaseWord(word: string): string {
  if (!word) {
    return word;
  }

  const lower = word.toLocaleLowerCase(TR_LOCALE);

  return (
    lower.charAt(0).toLocaleUpperCase(TR_LOCALE) +
    lower.slice(1)
  );
}

function formatTitleCasePhrase(
  value: string,
): string {
  const collapsed = collapseWhitespace(value);

  if (!collapsed) {
    return collapsed;
  }

  return collapsed
    .split(" ")
    .map(toTitleCaseWord)
    .join(" ");
}

type AbbreviationEntry = {
  /** Variants exactly as a user might type them (any case, with or without diacritics/periods). */
  variants: string[];
  /** Canonical output, e.g. "San." */
  output: string;
};

/**
 * Corporate abbreviation dictionary. Add new entries here to extend
 * formatCompanyName's vocabulary — no code changes required elsewhere.
 */
export const COMPANY_ABBREVIATION_DICTIONARY: AbbreviationEntry[] = [
  { variants: ["SAN", "SAN.", "SANAYİ", "SANAYI"], output: "San." },
  { variants: ["TİC", "TIC", "TİC.", "TİCARET", "TICARET"], output: "Tic." },
  { variants: ["VE"], output: "ve" },
  { variants: ["LTD", "LTD.", "LİMİTED", "LIMITED"], output: "Ltd." },
  {
    variants: [
      "ŞTİ",
      "STI",
      "ŞTI",
      "ŞTİ.",
      "ŞİRKETİ",
      "SIRKETI",
      "SİRKETİ",
    ],
    output: "Şti.",
  },
  { variants: ["AŞ", "A.Ş", "A.Ş.", "ANONİM", "ANONIM"], output: "A.Ş." },
  { variants: ["KOOP", "KOOPERATİF", "KOOPERATIF"], output: "Koop." },
  { variants: ["PAZ"], output: "Paz." },
  { variants: ["İNŞ", "INS", "İNŞAAT", "INSAAT"], output: "İnş." },
  { variants: ["MAD", "MADENCİLİK", "MADENCILIK"], output: "Mad." },
  { variants: ["MAK", "MAKİNA", "MAKINA", "MAKİNE", "MAKINE"], output: "Mak." },
  { variants: ["OTOM", "OTOMOTİV", "OTOMOTIV"], output: "Otom." },
  { variants: ["ELEK", "ELEKTRİK", "ELEKTRIK"], output: "Elek." },
  { variants: ["LOJ", "LOJİSTİK", "LOJISTIK"], output: "Loj." },
  { variants: ["TEKSTİL", "TEKSTIL"], output: "Tekstil" },
  { variants: ["GIDA", "GİDA"], output: "Gıda" },
];

function buildAbbreviationLookup(
  dictionary: AbbreviationEntry[],
): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const entry of dictionary) {
    for (const variant of entry.variants) {
      lookup.set(foldToAsciiKey(variant), entry.output);
    }
  }

  return lookup;
}

const abbreviationLookup = buildAbbreviationLookup(
  COMPANY_ABBREVIATION_DICTIONARY,
);

function formatCompanyWord(word: string): string {
  const directMatch = abbreviationLookup.get(
    foldToAsciiKey(word),
  );

  if (directMatch) {
    return directMatch;
  }

  // Users sometimes glue abbreviations together with periods and no
  // spaces (e.g. "san.tic.ltd"). If the whole word isn't a known
  // token, try splitting on "." and matching each part on its own.
  if (word.includes(".")) {
    const parts = word
      .split(".")
      .filter((part) => part.length > 0);

    if (parts.length > 1) {
      const partMatches = parts.map((part) =>
        abbreviationLookup.get(
          foldToAsciiKey(part),
        ),
      );

      if (
        partMatches.every(
          (match) => match !== undefined,
        )
      ) {
        return partMatches.join(" ");
      }
    }
  }

  return toTitleCaseWord(word);
}

/**
 * Normalizes a company/organization name into VIAWA's corporate
 * standard: collapsed whitespace, Turkish-aware title case per word,
 * with known corporate abbreviations (San., Tic., Ltd., Şti., A.Ş. …)
 * standardized regardless of how the user typed them.
 */
export function formatCompanyName(
  value: string,
): string {
  const collapsed = collapseWhitespace(value);

  if (!collapsed) {
    return collapsed;
  }

  return collapsed
    .split(" ")
    .map(formatCompanyWord)
    .join(" ");
}

/** "mehmet ali yılmaz" -> "Mehmet Ali Yılmaz" */
export function formatPersonName(
  value: string,
): string {
  return formatTitleCasePhrase(value);
}

/** "istanbul" -> "İstanbul" */
export function formatCity(
  value: string,
): string {
  return formatTitleCasePhrase(value);
}

/** "türkiye" -> "Türkiye" */
export function formatCountry(
  value: string,
): string {
  return formatTitleCasePhrase(value);
}

/** "büyük mükellefler" -> "Büyük Mükellefler" */
export function formatTaxOffice(
  value: string,
): string {
  return formatTitleCasePhrase(value);
}

// Email/website are ASCII technical identifiers, not Turkish words —
// a locale-aware lowercase would turn "I" into "ı" and corrupt them,
// so these intentionally use the plain (non-tr-TR) case conversion.

/** "INFO@DORUK.COM" -> "info@doruk.com" */
export function formatEmail(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** "WWW.DORUK.COM.TR" -> "www.doruk.com.tr" */
export function formatWebsite(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Notes are never reformatted — casing, line breaks and list
 * structure are preserved exactly as the user wrote them.
 */
export function formatNote(
  value: string,
): string {
  return value;
}

/**
 * The `contacts` table stores first/last name separately, but every
 * source of a person's name in this app (the company form, the Excel
 * import template) only collects a single "Ad Soyad" field. Splitting on
 * the first space is a standard, non-destructive convention — not
 * fabricated data.
 */
export function splitPersonName(
  fullName: string,
): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = fullName.trim();

  if (!trimmed) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  const [firstName, ...rest] =
    trimmed.split(/\s+/);

  const lastName = rest.join(" ");

  return {
    firstName: firstName || null,
    lastName: lastName || null,
  };
}
