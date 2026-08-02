import {
  getCompaniesForDuplicateCheck,
  type CompanyDuplicateCheckRow,
} from "../../services/supabase/companyService";

export type DuplicateCheckField =
  | "companyName"
  | "phone"
  | "email"
  | "taxNumber"
  | "website"
  | "address";

export type CompanyDuplicateCheckInput = {
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  website?: string | null;
  address?: string | null;
};

const DUPLICATE_FIELD_MESSAGES: Record<
  DuplicateCheckField,
  string
> = {
  companyName:
    "Bu firma adıyla kayıtlı başka bir firma var.",
  phone:
    "Bu telefon numarası başka bir firmaya ait.",
  email:
    "Bu e-posta adresi başka bir firmaya ait.",
  taxNumber:
    "Bu vergi numarası başka bir firmaya ait.",
  website:
    "Bu web sitesi başka bir firmaya ait.",
  address:
    "Bu adres başka bir firmaya ait.",
};

export function getDuplicateFieldMessage(
  field: DuplicateCheckField,
): string {
  return DUPLICATE_FIELD_MESSAGES[field];
}

/**
 * Company name: trim, collapse repeated whitespace, lowercase.
 */
export function normalizeCompanyNameForDuplicateCheck(
  value: string | null | undefined,
): string | null {
  const normalized = value
    ?.trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return normalized || null;
}

/**
 * Phone: strip spaces, -, (, ), + — compare digits only.
 */
export function normalizePhoneForDuplicateCheck(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const digitsOnly = trimmed.replace(
    /[^0-9]/g,
    "",
  );

  return digitsOnly || null;
}

/**
 * Email: trim + lowercase.
 */
export function normalizeEmailForDuplicateCheck(
  value: string | null | undefined,
): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase();

  return normalized || null;
}

/**
 * Website: trim, lowercase, strip http://, https://, www., trailing slash.
 */
export function normalizeWebsiteForDuplicateCheck(
  value: string | null | undefined,
): string | null {
  const trimmed = value
    ?.trim()
    .toLowerCase();

  if (!trimmed) {
    return null;
  }

  const withoutProtocol = trimmed.replace(
    /^https?:\/\//,
    "",
  );

  const withoutWww = withoutProtocol.replace(
    /^www\./,
    "",
  );

  const withoutTrailingSlash =
    withoutWww.replace(/\/+$/, "");

  return withoutTrailingSlash || null;
}

/**
 * Tax number: trim + strip all whitespace.
 */
export function normalizeTaxNumberForDuplicateCheck(
  value: string | null | undefined,
): string | null {
  const normalized = value
    ?.trim()
    .replace(/\s+/g, "");

  return normalized || null;
}

/**
 * Address: trim, collapse repeated whitespace, lowercase.
 */
export function normalizeAddressForDuplicateCheck(
  value: string | null | undefined,
): string | null {
  const normalized = value
    ?.trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return normalized || null;
}

function normalizeInput(
  input: CompanyDuplicateCheckInput,
): Record<
  DuplicateCheckField,
  string | null
> {
  return {
    companyName:
      normalizeCompanyNameForDuplicateCheck(
        input.companyName,
      ),
    phone: normalizePhoneForDuplicateCheck(
      input.phone,
    ),
    email: normalizeEmailForDuplicateCheck(
      input.email,
    ),
    taxNumber:
      normalizeTaxNumberForDuplicateCheck(
        input.taxNumber,
      ),
    website:
      normalizeWebsiteForDuplicateCheck(
        input.website,
      ),
    address:
      normalizeAddressForDuplicateCheck(
        input.address,
      ),
  };
}

function normalizeExistingRow(
  row: CompanyDuplicateCheckRow,
): Record<
  DuplicateCheckField,
  string | null
> {
  return {
    companyName:
      normalizeCompanyNameForDuplicateCheck(
        row.company_name,
      ),
    phone: normalizePhoneForDuplicateCheck(
      row.phone,
    ),
    email: normalizeEmailForDuplicateCheck(
      row.email,
    ),
    taxNumber:
      normalizeTaxNumberForDuplicateCheck(
        row.tax_number,
      ),
    website:
      normalizeWebsiteForDuplicateCheck(
        row.website,
      ),
    address:
      normalizeAddressForDuplicateCheck(
        row.address,
      ),
  };
}

// Checked in this exact order — the first field that collides with another
// company stops the save (empty/null values never count as a match).
const FIELD_CHECK_ORDER: DuplicateCheckField[] =
  [
    "companyName",
    "phone",
    "email",
    "taxNumber",
    "website",
    "address",
  ];

/**
 * Finds the first field in `input` that collides (after normalization)
 * with an existing company other than `excludeCompanyId`. Returns null
 * when there is no collision. This is an application-layer guard — see
 * supabase/migrations/20260724_add_company_duplicate_unique_constraints.sql
 * for the accompanying (not-yet-applied) database-level constraint.
 */
const COMPANY_CONSTRAINT_FIELD_BY_INDEX_NAME: Record<
  string,
  DuplicateCheckField
> = {
  companies_company_name_normalized_unique:
    "companyName",
  companies_phone_normalized_unique: "phone",
  companies_email_normalized_unique: "email",
  companies_tax_number_normalized_unique:
    "taxNumber",
  companies_website_normalized_unique:
    "website",
  companies_address_normalized_unique:
    "address",
};

/**
 * Translates a Postgres 23505 (unique violation) error from the
 * companies table's normalized-column indexes (see
 * supabase/migrations/20260724_add_company_duplicate_unique_constraints.sql)
 * into the matching user-facing message. Returns null for anything else,
 * so callers can fall back to a generic error message for unrecognized
 * failures — mirrors getContactConstraintErrorMessage in
 * contactDuplicateCheck.ts. This is a defense-in-depth backstop for races
 * the application-layer findDuplicateCompanyField check above can miss
 * (e.g. two imports/users creating the same company at nearly the same
 * moment).
 */
export function getCompanyConstraintErrorMessage(
  error: unknown,
): string | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return null;
  }

  const pgError = error as {
    code?: string;
    message?: string;
  };

  if (pgError.code !== "23505") {
    return null;
  }

  for (const [
    indexName,
    field,
  ] of Object.entries(
    COMPANY_CONSTRAINT_FIELD_BY_INDEX_NAME,
  )) {
    if (pgError.message?.includes(indexName)) {
      return getDuplicateFieldMessage(field);
    }
  }

  return null;
}

export async function findDuplicateCompanyField(
  input: CompanyDuplicateCheckInput,
  excludeCompanyId?: string,
): Promise<DuplicateCheckField | null> {
  const normalizedInput =
    normalizeInput(input);

  const hasAnyValueToCheck =
    FIELD_CHECK_ORDER.some(
      (field) =>
        normalizedInput[field] !== null,
    );

  if (!hasAnyValueToCheck) {
    return null;
  }

  const existingCompanies =
    await getCompaniesForDuplicateCheck(
      excludeCompanyId,
    );

  const normalizedExisting =
    existingCompanies.map(
      normalizeExistingRow,
    );

  for (const field of FIELD_CHECK_ORDER) {
    const value = normalizedInput[field];

    if (!value) {
      continue;
    }

    const isDuplicate =
      normalizedExisting.some(
        (existing) =>
          existing[field] === value,
      );

    if (isDuplicate) {
      return field;
    }
  }

  return null;
}
