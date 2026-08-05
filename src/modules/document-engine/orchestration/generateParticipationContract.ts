import { formatContractDate } from "../engine/formatContractDate";
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
import type { OpportunityPaymentPlanItem } from "../../../types/database";

function maskId(value: string): string {
  return value.length <= 8 ? value : `${value.slice(0, 8)}…`;
}

// RC-02 — v1 güvenlik kuralı: ödeme planı vadeleri toplamı, onaylı
// fiyatın genel toplamıyla (kuruş/cent farkları hariç) birebir eşit
// olmalıdır. Boş satırlar 0 kabul edilir, dolayısıyla genel toplam
// pozitifken boş bir ödeme planı da bu kontrolden geçemez — ayrı bir
// "boş plan" özel durumu yok, tek bir eşitlik kontrolü hepsini kapsar.
const PAYMENT_PLAN_AMOUNT_TOLERANCE = 0.01;

function isCloseEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= PAYMENT_PLAN_AMOUNT_TOLERANCE;
}

function sumPaymentPlanAmounts(
  paymentPlan:
    | readonly OpportunityPaymentPlanItem[]
    | null
    | undefined,
): number {
  return (paymentPlan ?? []).reduce((total, row) => {
    const amount = row?.amount;
    return Number.isFinite(amount)
      ? total + (amount as number)
      : total;
  }, 0);
}

function formatMoneyForMessage(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function buildPaymentPlanMismatchMessage(
  paymentPlanTotal: number,
  grandTotal: number,
  currency: string,
): string {
  const difference = paymentPlanTotal - grandTotal;
  const detail =
    difference < 0
      ? `Ödeme planı toplamı genel toplamdan ${formatMoneyForMessage(-difference, currency)} eksiktir.`
      : `Ödeme planı toplamı genel toplamdan ${formatMoneyForMessage(difference, currency)} fazladır.`;

  return `Ödeme planı toplamı, genel toplam ile eşleşmelidir. ${detail}`;
}

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

  dependencies.logCheckpoint?.("approved_price_snapshot_loaded", {
    companyId: maskId(company.id),
    opportunityId: maskId(opportunity.id),
  });

  const paymentPlanTotal = sumPaymentPlanAmounts(
    opportunity.payment_plan,
  );
  const grandTotal = priceSnapshot.priceResult.grandTotal;

  if (!isCloseEnough(paymentPlanTotal, grandTotal)) {
    return failedResult({
      request,
      generatedAt,
      exhibitionId: exhibition.id,
      errors: [
        {
          code: "PAYMENT_PLAN_TOTAL_MISMATCH",
          message: buildPaymentPlanMismatchMessage(
            paymentPlanTotal,
            grandTotal,
            priceSnapshot.priceResult.currency,
          ),
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

  dependencies.logCheckpoint?.("document_settings_loaded", {
    companyId: maskId(company.id),
    opportunityId: maskId(opportunity.id),
  });

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
      // Sprint 25.3 — the raw ISO datetime (with time/ms/Z) was wrapping
      // onto a second line in the header's narrow "Düzenleme Tarihi"
      // cell. formatContractDate is the same dd.MM.yyyy formatter the
      // live preview (ParticipationContractDocument.tsx) already uses
      // for this exact field.
      issueDate: formatContractDate(
        generatedAt.toISOString(),
      ),
    },
  };
  dependencies.logCheckpoint?.("contract_mapping_started", {
    companyId: maskId(company.id),
    opportunityId: maskId(opportunity.id),
  });

  const mergeResult = resolveTemplateMerge(
    participationContractMapping,
    context,
  );

  dependencies.logCheckpoint?.("contract_mapping_completed", {
    companyId: maskId(company.id),
    opportunityId: maskId(opportunity.id),
  });

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
