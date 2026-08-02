import type { GenerateParticipationContractResult } from "../../src/modules/document-engine/orchestration/models";

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
        | "COMPANY_NOT_FOUND"
        | "OPPORTUNITY_NOT_FOUND"
        | "COMPANY_ACCESS_DENIED"
        | "OPPORTUNITY_ACCESS_DENIED"
        | "COMPANY_OPPORTUNITY_MISMATCH";
      message: string;
    };

export type ContractDocxEndpointDependencies = {
  authenticate: (
    accessToken: string,
  ) => Promise<AuthenticatedContractUser | null>;
  authorize: (input: {
    user: AuthenticatedContractUser;
    accessToken: string;
    companyId: string;
    opportunityId: string;
  }) => Promise<ContractEndpointAuthorizationResult>;
  generate: (input: {
    user: AuthenticatedContractUser;
    accessToken: string;
    companyId: string;
    opportunityId: string;
  }) => Promise<{
    result: GenerateParticipationContractResult;
    docxBuffer?: Buffer;
    cleanup?: () => Promise<void>;
  }>;
  logError?: (message: string, error: unknown) => void;
};

export type ContractDocxHttpRequest = {
  method?: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: AsyncIterable<Uint8Array>;
  maxBodyBytes?: number;
};

export type ContractDocxHttpResponse = {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Buffer;
};
