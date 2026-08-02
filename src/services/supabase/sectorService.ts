import { normalizeMasterListName } from "../../core/normalization/masterListName";
import type { Sector } from "../../types/database";

import { supabase } from "./client";

export type { Sector } from "../../types/database";

export type CompanySectorEntry = {
  id: string;
  name: string;
  position: number;
};

export type CompanySectorRelation = {
  companyId: string;
  sectorId: string;
  name: string;
  position: number;
};

function isUniqueViolation(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code ===
      "23505"
  );
}

export async function listSectors(): Promise<
  Sector[]
> {
  const { data, error } = await supabase
    .from("sectors")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;

  return data ?? [];
}

export async function searchSectors(
  query: string,
  limit = 8,
): Promise<Sector[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabase
    .from("sectors")
    .select("*")
    .eq("is_active", true)
    .ilike("name", `%${trimmed}%`)
    .order("name")
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}

/**
 * Finds the sector matching `name` (by normalized name) or creates it.
 * Safe against a race with another user creating the same sector at
 * nearly the same time — a unique-violation on insert falls back to
 * re-fetching the row the other request just created.
 */
export async function findOrCreateSector(
  name: string,
): Promise<Sector> {
  const trimmedName = name.trim();
  const normalizedName =
    normalizeMasterListName(trimmedName);

  const { data: existing, error: findError } =
    await supabase
      .from("sectors")
      .select("*")
      .eq(
        "normalized_name",
        normalizedName,
      )
      .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } =
    await supabase
      .from("sectors")
      .insert({
        name: trimmedName,
        normalized_name: normalizedName,
      })
      .select()
      .single();

  if (!createError) {
    return created;
  }

  if (isUniqueViolation(createError)) {
    const {
      data: raceWinner,
      error: refetchError,
    } = await supabase
      .from("sectors")
      .select("*")
      .eq(
        "normalized_name",
        normalizedName,
      )
      .maybeSingle();

    if (refetchError) throw refetchError;

    if (raceWinner) {
      return raceWinner;
    }
  }

  throw createError;
}

export async function getCompanySectors(
  companyId: string,
): Promise<CompanySectorEntry[]> {
  const { data, error } = await supabase
    .from("company_sectors")
    .select("position, sectors(id, name)")
    .eq("company_id", companyId)
    .order("position");

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const sector = Array.isArray(
        row.sectors,
      )
        ? row.sectors[0]
        : row.sectors;

      if (!sector) {
        return null;
      }

      return {
        id: sector.id,
        name: sector.name,
        position: row.position,
      };
    })
    .filter(
      (
        entry,
      ): entry is CompanySectorEntry =>
        entry !== null,
    );
}

export async function listCompanySectorRelations(): Promise<
  CompanySectorRelation[]
> {
  const { data, error } = await supabase
    .from("company_sectors")
    .select(
      "company_id, sector_id, position, sectors(id, name)",
    )
    .order("company_id")
    .order("position");

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const sector = Array.isArray(
        row.sectors,
      )
        ? row.sectors[0]
        : row.sectors;

      if (!sector) {
        return null;
      }

      return {
        companyId: row.company_id,
        sectorId: row.sector_id,
        name: sector.name,
        position: row.position,
      };
    })
    .filter(
      (
        relation,
      ): relation is CompanySectorRelation =>
        relation !== null,
    );
}

/**
 * Replaces a company's entire ordered sector set in one atomic call
 * (see the replace_company_sectors Postgres function in
 * supabase/migrations/20260728_add_sectors_and_product_groups.sql) —
 * never a separate delete + insert from the browser, so a company can
 * never end up with a half-updated sector list. Also keeps
 * companies.industry synchronized with position 1 (or clears it to
 * null when `sectorIds` is empty), as that function's own last step.
 */
export async function replaceCompanySectors(
  companyId: string,
  sectorIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc(
    "replace_company_sectors",
    {
      p_company_id: companyId,
      p_sector_ids: sectorIds.slice(0, 4),
    },
  );

  if (error) throw error;
}
