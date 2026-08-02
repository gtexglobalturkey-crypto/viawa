import { resolveTemplateMerge } from "../merge/mergeEngine";
import { participationContractMapping } from "../merge/participationContractMapping";
import type { DocumentMergeContext } from "../merge/models";
import { createContractDocxFileName } from "./contractDocxFileName";
import type {
  ContractGenerationOrchestratorDependencies,
  ContractGenerationValidationError,
  GenerateParticipationContractInput,
  GenerateParticipationContractResult,
} from "./models";

function failedResult(input: {
  request: GenerateParticipationContractInput;
  generatedAt: Date;
  exhibitionId: string | null;
  errors: readonly ContractGenerationValidationError[];
}): GenerateParticipationContractResult {
  return {
    success: false,
    outputFileName: null,
    outputPath: null,
    generatedAt: input.generatedAt.toISOString(),
    companyId: input.request.companyId,
    opportunityId: input.request.opportunityId,
    exhibitionId: input.exhibitionId,
    warnings: [],
    validationErrors: input.errors,
  };
}

export async function generateParticipationContract(
  request: GenerateParticipationContractInput,
  dependencies: ContractGenerationOrchestratorDependencies,
): Promise<GenerateParticipationContractResult> {
  const generatedAt = dependencies.now?.() ?? new Date();
  const { dataSource } = dependencies;

  const company = await dataSource.loadCompany(request.companyId);

  if (!company) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: null,
      errors: [
        {
          code: "COMPANY_NOT_FOUND",
          message: "Company could not be found.",
        },
      ],
    });
  }

  const opportunity = await dataSource.loadOpportunity(
    request.opportunityId,
  );

  if (!opportunity) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: null,
      errors: [
        {
          code: "OPPORTUNITY_NOT_FOUND",
          message: "Opportunity could not be found.",
        },
      ],
    });
  }

  if (opportunity.company_id !== company.id) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: opportunity.exhibition_id,
      errors: [
        {
          code: "OPPORTUNITY_COMPANY_MISMATCH",
          message: "Opportunity does not belong to the requested company.",
        },
      ],
    });
  }

  if (!opportunity.exhibition_id) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: null,
      errors: [
        {
          code: "EXHIBITION_NOT_FOUND",
          message: "Opportunity has no exhibition association.",
        },
      ],
    });
  }

  const exhibition = await dataSource.loadExhibition(
    opportunity.exhibition_id,
  );

  if (!exhibition) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: opportunity.exhibition_id,
      errors: [
        {
          code: "EXHIBITION_NOT_FOUND",
          message: "Exhibition could not be found.",
        },
      ],
    });
  }

  const contacts = await dataSource.loadContacts(company.id);
  const contactErrors: ContractGenerationValidationError[] = [];

  if (!contacts.some((contact) => contact.is_primary)) {
    contactErrors.push({
      code: "PRIMARY_CONTACT_NOT_FOUND",
      message: "A primary company contact is required for the contract.",
    });
  }

  if (!contacts.some((contact) => contact.is_signatory)) {
    contactErrors.push({
      code: "SIGNATORY_CONTACT_NOT_FOUND",
      message: "An authorized signatory contact is required for the contract.",
    });
  }

  if (contactErrors.length > 0) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: exhibition.id,
      errors: contactErrors,
    });
  }

  const priceSnapshot = await dataSource.loadPriceSnapshot({
    companyId: company.id,
    opportunityId: opportunity.id,
    exhibitionId: exhibition.id,
  });

  if (!priceSnapshot) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: exhibition.id,
      errors: [
        {
          code: "APPROVED_PRICE_NOT_FOUND",
          message: "An approved price snapshot is required for the contract.",
        },
      ],
    });
  }

  const settings = await dataSource.loadSettings();

  if (!settings) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: exhibition.id,
      errors: [
        {
          code: "SETTINGS_NOT_FOUND",
          message: "Document settings could not be loaded.",
        },
      ],
    });
  }

  const contractNumber = await dataSource.resolveContractNumber({
    companyId: company.id,
    opportunityId: opportunity.id,
    exhibition,
    generatedAt,
  });
  const context: DocumentMergeContext = {
    company,
    contacts,
    opportunity,
    exhibition,
    priceSnapshot,
    settings,
    document: {
      contractNumber,
      issueDate: generatedAt.toISOString(),
    },
  };
  const mergeResult = resolveTemplateMerge(
    participationContractMapping,
    context,
  );

  if (mergeResult.missingRequiredTags.length > 0) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: exhibition.id,
      errors: [
        {
          code: "REQUIRED_TEMPLATE_FIELD_MISSING",
          message: "Required contract template fields are missing.",
          fieldTags: mergeResult.missingRequiredTags,
        },
      ],
    });
  }

  const generatedDocument = await dependencies.docxGenerator.generate({
    mergeResult,
    preferredFileName: createContractDocxFileName({
      companyName: company.company_name,
      exhibitionName: exhibition.name,
      generatedAt,
    }),
  });

  return {
    success: true,
    outputFileName: generatedDocument.outputFileName,
    outputPath: generatedDocument.outputPath,
    generatedAt: generatedAt.toISOString(),
    companyId: company.id,
    opportunityId: opportunity.id,
    exhibitionId: exhibition.id,
    warnings: generatedDocument.warnings,
    validationErrors: [],
  };
}
