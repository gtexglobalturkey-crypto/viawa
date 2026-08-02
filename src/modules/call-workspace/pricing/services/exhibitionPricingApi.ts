import { getExhibitions } from "../../../../services/supabase/exhibitionService";
import { exhibitionNamesMatch } from "../../../exhibitions/utils/exhibitionNameMatch";
import { toExhibitionPricingConfig } from "../../../exhibition-repository/models/ExhibitionPricingRecord";
import { findExhibitionPricingRecord } from "../../../exhibition-repository/services/exhibitionPricingRepositoryService";
import type { ExhibitionPricingConfig } from "../models/ExhibitionPricingConfig";

export type ExhibitionPricingConfigResult =
  // No real Supabase exhibition matches the sidebar's selected fuar at
  // all — there is no exhibition id to send the user to a Repository
  // page for.
  | { status: "not-found" }
  // The exhibition itself exists in Supabase, but has no
  // exhibition_pricing_configs row yet — matchedExhibitionId is carried
  // so the caller can offer a direct link to that exhibition's
  // Repository "Fiyat Hesaplayıcı" tab (Sprint 22.4).
  | {
      status: "config-missing";
      matchedExhibitionId: string;
    }
  | { status: "invalid"; error: string }
  | {
      status: "found";
      matchedExhibitionId: string;
      config: ExhibitionPricingConfig;
    };

/**
 * Fetches the pricing config for the sidebar-selected exhibition from
 * the Fuar Repository (Supabase exhibition_pricing_configs — see
 * src/modules/exhibition-repository/, Sprint 22.1). Sprint 22.2 replaced
 * the old dev-only JSON-file source (vite-plugins/exhibitionPricingPlugin.ts,
 * now removed) with this — the Repository is the only pricing data
 * source now.
 *
 * The sidebar's selected exhibition (src/modules/exhibitions/, a
 * separate localStorage-only concept — still not unified with the real
 * `exhibitions` table) is matched to a real Supabase exhibition by name,
 * using the same fuzzy exhibitionNamesMatch already used elsewhere in
 * this module to double-check identity. Never falls back to a different
 * exhibition's config — an unresolvable name or missing repository row
 * always maps to "not-found", never silently to some other fuar's
 * numbers.
 */
export async function fetchExhibitionPricingConfig(
  exhibitionName: string,
  exhibitionShortName?: string | null,
): Promise<ExhibitionPricingConfigResult> {
  let exhibitions;

  try {
    exhibitions = await getExhibitions();
  } catch {
    return {
      status: "invalid",
      error:
        "Fuar fiyat yapılandırması alınamadı.",
    };
  }

  const matchedExhibition =
    exhibitions.find(
      (candidate) =>
        exhibitionNamesMatch(
          candidate.name,
          exhibitionName,
        ) ||
        exhibitionNamesMatch(
          candidate.name,
          exhibitionShortName,
        ),
    );

  if (!matchedExhibition) {
    return { status: "not-found" };
  }

  let record;

  try {
    record =
      await findExhibitionPricingRecord(
        matchedExhibition.id,
      );
  } catch {
    return {
      status: "invalid",
      error:
        "Fuar fiyat yapılandırması alınamadı.",
    };
  }

  if (!record) {
    return {
      status: "config-missing",
      matchedExhibitionId:
        matchedExhibition.id,
    };
  }

  return {
    status: "found",
    matchedExhibitionId:
      matchedExhibition.id,
    config: toExhibitionPricingConfig(
      record,
      matchedExhibition.name,
    ),
  };
}
