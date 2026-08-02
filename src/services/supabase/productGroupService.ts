import { normalizeMasterListName } from "../../core/normalization/masterListName";
import type { ProductGroup } from "../../types/database";

import { supabase } from "./client";

export type { ProductGroup } from "../../types/database";

export type CompanyProductGroupEntry = {
  id: string;
  name: string;
  position: number;
};

export type CompanyProductGroupRelation = {
  companyId: string;
  productGroupId: string;
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

export async function listProductGroups(): Promise<
  ProductGroup[]
> {
  const { data, error } = await supabase
    .from("product_groups")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;

  return data ?? [];
}

export async function searchProductGroups(
  query: string,
  limit = 8,
): Promise<ProductGroup[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabase
    .from("product_groups")
    .select("*")
    .eq("is_active", true)
    .ilike("name", `%${trimmed}%`)
    .order("name")
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}

/**
 * Finds the product group matching `name` (by normalized name) or
 * creates it. Safe against a race with another user creating the same
 * product group at nearly the same time — mirrors findOrCreateSector
 * in sectorService.ts exactly.
 */
export async function findOrCreateProductGroup(
  name: string,
): Promise<ProductGroup> {
  const trimmedName = name.trim();
  const normalizedName =
    normalizeMasterListName(trimmedName);

  const { data: existing, error: findError } =
    await supabase
      .from("product_groups")
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
      .from("product_groups")
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
      .from("product_groups")
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

export async function getCompanyProductGroups(
  companyId: string,
): Promise<CompanyProductGroupEntry[]> {
  const { data, error } = await supabase
    .from("company_product_groups")
    .select(
      "position, product_groups(id, name)",
    )
    .eq("company_id", companyId)
    .order("position");

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const productGroup = Array.isArray(
        row.product_groups,
      )
        ? row.product_groups[0]
        : row.product_groups;

      if (!productGroup) {
        return null;
      }

      return {
        id: productGroup.id,
        name: productGroup.name,
        position: row.position,
      };
    })
    .filter(
      (
        entry,
      ): entry is CompanyProductGroupEntry =>
        entry !== null,
    );
}

export async function listCompanyProductGroupRelations(): Promise<
  CompanyProductGroupRelation[]
> {
  const { data, error } = await supabase
    .from("company_product_groups")
    .select(
      "company_id, product_group_id, position, product_groups(id, name)",
    )
    .order("company_id")
    .order("position");

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const productGroup = Array.isArray(
        row.product_groups,
      )
        ? row.product_groups[0]
        : row.product_groups;

      if (!productGroup) {
        return null;
      }

      return {
        companyId: row.company_id,
        productGroupId: row.product_group_id,
        name: productGroup.name,
        position: row.position,
      };
    })
    .filter(
      (
        relation,
      ): relation is CompanyProductGroupRelation =>
        relation !== null,
    );
}

/**
 * Replaces a company's entire ordered product-group set in one atomic
 * call (see the replace_company_product_groups Postgres function in
 * supabase/migrations/20260728_add_sectors_and_product_groups.sql) —
 * never a separate delete + insert from the browser.
 */
export async function replaceCompanyProductGroups(
  companyId: string,
  productGroupIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc(
    "replace_company_product_groups",
    {
      p_company_id: companyId,
      p_product_group_ids:
        productGroupIds.slice(0, 4),
    },
  );

  if (error) throw error;
}
