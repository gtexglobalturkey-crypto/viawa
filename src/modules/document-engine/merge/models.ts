import type { ApprovedPriceSnapshot } from "../../call-workspace/pricing/models/ApprovedPriceSnapshot";
import type {
  Company,
  Contact,
  Exhibition,
  Opportunity,
} from "../../../types/database";

export type TemplateFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type TemplateDataSource =
  | "company"
  | "contact.primary"
  | "contact.signatory"
  | "opportunity"
  | "exhibition"
  | "price-snapshot"
  | "settings"
  | "document";

// Sprint 25.8 — stand_materials/extra_information/payment_plan now live
// directly on the base Opportunity type (see src/types/database.ts);
// re-exported here under their established document-engine names so
// existing imports keep working unchanged.
export type { OpportunityStandMaterial as DocumentStandMaterial } from "../../../types/database";
export type { OpportunityPaymentPlanItem as DocumentPaymentPlanItem } from "../../../types/database";

export type DocumentMergeOpportunity = Opportunity & {
  hall?: string | null;
  stand_number?: string | null;
  stand_shape?: string | null;
};

export type DocumentMergeSettings = {
  issuer: {
    address?: string | null;
    mersisNumber?: string | null;
    tradeRegistryNumber?: string | null;
    taxOffice?: string | null;
    taxNumber?: string | null;
    website?: string | null;
    representativeNameTitle?: string | null;
  };
  bank: {
    bankName?: string | null;
    branchAddress?: string | null;
    ibanEur?: string | null;
    ibanUsd?: string | null;
  };
};

export type DocumentMergeMetadata = {
  contractNumber?: string | null;
  issueDate?: string | null;
  qrCodeValue?: string | null;
  participantSignatureDate?: string | null;
  issuerSignatureDate?: string | null;
};

export type DocumentMergeContext = {
  company: Company;
  contacts: readonly Contact[];
  opportunity: DocumentMergeOpportunity;
  exhibition: Exhibition | null;
  priceSnapshot: ApprovedPriceSnapshot | null;
  settings: DocumentMergeSettings;
  document: DocumentMergeMetadata;
};

export type TemplateFieldMapping<
  Context,
  Tag extends string = string,
> = {
  tag: Tag;
  title: string;
  source: TemplateDataSource;
  required?: boolean;
  resolve: (context: Context) => TemplateFieldValue;
};

export type TemplateMappingDefinition<
  Context,
  Tag extends string = string,
> = {
  documentType: string;
  templateFileName: string;
  fields: readonly TemplateFieldMapping<Context, Tag>[];
};

export type TemplateMergeResult = {
  documentType: string;
  templateFileName: string;
  values: Readonly<Record<string, TemplateFieldValue>>;
  missingRequiredTags: readonly string[];
};
