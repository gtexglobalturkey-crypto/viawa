export { ContractPreviewModal } from "./components/ContractPreviewModal";

export type {
  ContractDocumentData,
  ContractDocumentStatus,
} from "./models/ContractDocumentData";

export type {
  GeneratedDocumentRecord,
  GeneratedDocumentStatus,
} from "./models/GeneratedDocumentRecord";

export { buildContractDocumentData } from "./engine/buildContractDocumentData";
export { resolveTemplateMerge } from "./merge/mergeEngine";
export { participationContractMapping } from "./merge/participationContractMapping";
export { generateParticipationContract } from "./orchestration/generateParticipationContract";
export { createContractDocxFileName } from "./orchestration/contractDocxFileName";
export { createViawaContractDataSource } from "./orchestration/viawaContractDataSource";
export type {
  DocumentMergeContext,
  DocumentMergeMetadata,
  DocumentMergeOpportunity,
  DocumentMergeSettings,
  DocumentPaymentPlanItem,
  DocumentStandMaterial,
  TemplateDataSource,
  TemplateFieldMapping,
  TemplateFieldValue,
  TemplateMappingDefinition,
  TemplateMergeResult,
} from "./merge/models";
export type {
  ContractDocxGenerationPort,
  ContractGenerationDataSource,
  ContractGenerationOrchestratorDependencies,
  ContractGenerationValidationCode,
  ContractGenerationValidationError,
  GenerateParticipationContractInput,
  GenerateParticipationContractResult,
} from "./orchestration/models";

export { getOrCreateContractNumber } from "./engine/generateContractNumber";

export {
  generateDocumentFileName,
  getNextDocumentVersion,
} from "./engine/generateDocumentFileName";

export {
  loadGeneratedDocuments,
  saveGeneratedDocuments,
} from "./services/generatedDocumentStorage";
