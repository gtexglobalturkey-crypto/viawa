import { getContactsForDuplicateCheck } from "../../services/supabase/contactService";

export type ContactDuplicateField =
  | "email"
  | "phone";

export type ContactDuplicateCheckPerson = {
  email?: string | null;
  phone?: string | null;
  /** The existing contact row this person corresponds to, if editing. */
  excludeContactId?: string | null;
};

const CONTACT_DUPLICATE_FIELD_MESSAGES: Record<
  ContactDuplicateField,
  string
> = {
  email:
    "Bu e-posta adresi başka bir kişiye ait.",
  phone:
    "Bu telefon numarası başka bir kişiye ait.",
};

export function getContactDuplicateFieldMessage(
  field: ContactDuplicateField,
): string {
  return CONTACT_DUPLICATE_FIELD_MESSAGES[
    field
  ];
}

/**
 * Email: trim + lowercase.
 */
export function normalizeContactEmailForDuplicateCheck(
  value: string | null | undefined,
): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase();

  return normalized || null;
}

/**
 * Phone: strip spaces, +, -, (, ) and any other non-digit characters —
 * compare digits only.
 */
export function normalizeContactPhoneForDuplicateCheck(
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

const FIELD_CHECK_ORDER: ContactDuplicateField[] =
  ["email", "phone"];

type NormalizedPerson = {
  email: string | null;
  phone: string | null;
  excludeContactId: string | null;
};

/**
 * Finds the first field (email checked before phone) that collides —
 * either between two people in the same submission, or against any
 * existing contact system-wide (across every company). A person editing
 * their own existing contact row is excluded via `excludeContactId`.
 * Returns null when there is no collision.
 *
 * This is an application-layer guard — see
 * supabase/migrations/20260724_add_contacts_duplicate_unique_constraints.sql
 * for the accompanying (not-yet-applied) database-level constraint.
 */
export async function findDuplicateContactField(
  people: ContactDuplicateCheckPerson[],
): Promise<ContactDuplicateField | null> {
  const normalizedPeople: NormalizedPerson[] =
    people.map((person) => ({
      email: normalizeContactEmailForDuplicateCheck(
        person.email,
      ),
      phone: normalizeContactPhoneForDuplicateCheck(
        person.phone,
      ),
      excludeContactId:
        person.excludeContactId ?? null,
    }));

  const hasAnyValueToCheck =
    normalizedPeople.some(
      (person) =>
        person.email !== null ||
        person.phone !== null,
    );

  if (!hasAnyValueToCheck) {
    return null;
  }

  const existingContacts =
    await getContactsForDuplicateCheck();

  const normalizedExisting =
    existingContacts.map((row) => ({
      id: row.id,
      email: normalizeContactEmailForDuplicateCheck(
        row.email,
      ),
      phone: normalizeContactPhoneForDuplicateCheck(
        row.phone,
      ),
    }));

  for (const field of FIELD_CHECK_ORDER) {
    const seenWithinSubmission =
      new Set<string>();

    for (const person of normalizedPeople) {
      const value = person[field];

      if (!value) {
        continue;
      }

      if (
        seenWithinSubmission.has(value)
      ) {
        return field;
      }

      seenWithinSubmission.add(value);
    }

    for (const person of normalizedPeople) {
      const value = person[field];

      if (!value) {
        continue;
      }

      const isDuplicate =
        normalizedExisting.some(
          (existing) =>
            existing.id !==
              person.excludeContactId &&
            existing[field] === value,
        );

      if (isDuplicate) {
        return field;
      }
    }
  }

  return null;
}

/**
 * Translates a Postgres 23505 (unique violation) error from the
 * contacts table's normalized-column indexes into the matching
 * user-facing message. Returns null for anything else, so callers can
 * fall back to a generic error message for unrecognized failures.
 */
export function getContactConstraintErrorMessage(
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

  if (
    pgError.message?.includes(
      "contacts_email_normalized_unique",
    )
  ) {
    return getContactDuplicateFieldMessage(
      "email",
    );
  }

  if (
    pgError.message?.includes(
      "contacts_phone_normalized_unique",
    )
  ) {
    return getContactDuplicateFieldMessage(
      "phone",
    );
  }

  return null;
}
