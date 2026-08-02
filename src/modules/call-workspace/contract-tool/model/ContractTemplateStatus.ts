export type ContractTemplateSource = "opportunity" | "fallback";

export type ContractTemplateStatus = {
  exists: boolean;
  fileName: string | null;
  source: ContractTemplateSource | null;
};
