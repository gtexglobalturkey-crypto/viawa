import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContractGenerationDataSource } from "../orchestration/models";

const CONTRACT_NUMBER_PATTERN = /^EXP-[0-9]{4}-[0-9]{6}$/;

export function createPersistentContractNumberProvider(
  client: SupabaseClient,
): ContractGenerationDataSource["resolveContractNumber"] {
  return async ({ companyId, opportunityId, exhibition }) => {
    const { data, error } = await client.rpc(
      "get_or_create_contract_number",
      {
        p_company_id: companyId,
        p_opportunity_id: opportunityId,
        p_exhibition_id: exhibition.id,
      },
    );

    if (
      error ||
      typeof data !== "string" ||
      !CONTRACT_NUMBER_PATTERN.test(data)
    ) {
      throw new Error("Contract number could not be resolved.");
    }

    return data;
  };
}
