import { createClient } from "@supabase/supabase-js";

import type {
  AuthenticatedContractUser,
  ContractEndpointAuthorizationResult,
} from "./models";

type AuthorizationInput = {
  user: AuthenticatedContractUser;
  accessToken: string;
  companyId: string;
  opportunityId: string;
};

export function createSupabaseContractAuthorizer(input: {
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  return async ({
    user,
    accessToken,
    companyId,
    opportunityId,
  }: AuthorizationInput): Promise<ContractEndpointAuthorizationResult> => {
    const client = createClient(input.supabaseUrl, input.supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: company, error: companyError } = await client
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) throw companyError;

    if (!company) {
      return {
        allowed: false,
        status: 404,
        code: "COMPANY_NOT_FOUND",
        message: "Company could not be found.",
      };
    }

    const { data: opportunity, error: opportunityError } = await client
      .from("opportunities")
      .select("id,company_id,owner")
      .eq("id", opportunityId)
      .maybeSingle();

    if (opportunityError) throw opportunityError;

    if (!opportunity) {
      return {
        allowed: false,
        status: 404,
        code: "OPPORTUNITY_NOT_FOUND",
        message: "Opportunity could not be found.",
      };
    }

    if (opportunity.company_id !== companyId) {
      return {
        allowed: false,
        status: 403,
        code: "COMPANY_OPPORTUNITY_MISMATCH",
        message: "Opportunity does not belong to the requested company.",
      };
    }

    const normalizedOwner = opportunity.owner?.trim().toLocaleLowerCase();
    const ownerMatches =
      normalizedOwner === user.id.toLocaleLowerCase() ||
      (!!user.email &&
        normalizedOwner === user.email.trim().toLocaleLowerCase());

    if (!ownerMatches) {
      return {
        allowed: false,
        status: 403,
        code: "OPPORTUNITY_ACCESS_DENIED",
        message: "Opportunity access is denied.",
      };
    }

    return { allowed: true };
  };
}
