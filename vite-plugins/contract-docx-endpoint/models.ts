export type AuthenticatedContractUser = {
  id: string;
  email?: string;
};

export type ContractEndpointAuthorizationResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 404;
      code:
        | "APPLICATION_ACCESS_DENIED"
        | "COMPANY_NOT_FOUND"
        | "OPPORTUNITY_NOT_FOUND"
        | "COMPANY_ACCESS_DENIED"
        | "OPPORTUNITY_ACCESS_DENIED"
        | "COMPANY_OPPORTUNITY_MISMATCH";
      message: string;
    };
