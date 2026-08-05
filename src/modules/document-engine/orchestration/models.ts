import type { ApprovedPriceSnapshot } from "../../call-workspace/pricing/models/ApprovedPriceSnapshot";
import type {
  Company,
  Contact,
  Exhibition,
} from "../../../types/database";
import type {
  DocumentMergeOpportunity,
  DocumentMergeSettings,
  TemplateMergeResult,
} from "../merge/models";

export type ContractGenerationValidationCode =
  | "COMPANY_NOT_FOUND"
  | "OPPORTUNITY_NOT_FOUND"
  | "OPPORTUNITY_COMPANY_MISMATCH"
  | "EXHIBITION_NOT_FOUND"
  | "PRIMARY_CONTACT_NOT_FOUND"
  | "SIGNATORY_CONTACT_NOT_FOUND"
  | "APPROVED_PRICE_NOT_FOUND"
  | "PAYMENT_PLAN_TOTAL_MISMATCH"
  | "SETTINGS_NOT_FOUND"
  | "REQUIRED_TEMPLATE_FIELD_MISSING";

export type ContractGenerationValidationError = {
  code: ContractGenerationValidationCode;
  message: string;
  fieldTags?: readonly string[];
};

export type ContractGenerationDataSource = {
  loadCompany: (companyId: string) => Promise<Company | null>;
  loadOpportunity: (
    opportunityId: string,
  ) => Promise<DocumentMergeOpportunity | null>;
  loadExhibition: (
    exhibitionId: string,
  ) => Promise<Exhibition | null>;
  loadContacts: (
    companyId: string,
  ) => Promise<readonly Contact[]>;
  loadPriceSnapshot: (input: {
    companyId: string;
    opportunityId: string;
    exhibitionId: string;
  }) => Promise<ApprovedPriceSnapshot | null>;
  loadSettings: () => Promise<DocumentMergeSettings | null>;
  resolveContractNumber: (input: {
    companyId: string;
    opportunityId: string;
    exhibition: Exhibition;
    generatedAt: Date;
  }) => Promise<string>;
};

export type ContractDocxGenerationPort = {
  generate: (input: {
    mergeResult: TemplateMergeResult;
    preferredFileName: string;
  }) => Promise<{
    outputFileName: string;
    outputPath: string;
    warnings: readonly string[];
  }>;
};

export type GenerateParticipationContractInput = {
  companyId: string;
  opportunityId: string;
};

export type GenerateParticipationContractResult =
  | {
      success: true;
      outputFileName: string;
      outputPath: string;
      generatedAt: string;
      companyId: string;
      opportunityId: string;
      exhibitionId: string;
      warnings: readonly string[];
      validationErrors: readonly [];
    }
  | {
      success: false;
      outputFileName: null;
      outputPath: null;
      generatedAt: string;
      companyId: string;
      opportunityId: string;
      exhibitionId: string | null;
      warnings: readonly string[];
      validationErrors: readonly ContractGenerationValidationError[];
    };

export type ContractGenerationOrchestratorDependencies = {
  dataSource: ContractGenerationDataSource;
  docxGenerator: ContractDocxGenerationPort;
  now?: () => Date;
  logCheckpoint?: (stage: string, context?: Record<string, unknown>) => void;
};
