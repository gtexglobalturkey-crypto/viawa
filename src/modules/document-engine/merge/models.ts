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

export type DocumentPaymentPlanItem = {
  dueDate?: string | null;
  amount?: number | null;
  payee?: string | null;
};

export type DocumentStandMaterial = {
  selected: boolean;
  quantity?: number | null;
};

export type DocumentMergeOpportunity = Opportunity & {
  hall?: string | null;
  stand_number?: string | null;
  stand_shape?: string | null;
  payment_plan?: readonly DocumentPaymentPlanItem[] | null;
  stand_materials?: Readonly<
    Record<string, DocumentStandMaterial>
  > | null;
  extra_information?: readonly string[] | null;
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
