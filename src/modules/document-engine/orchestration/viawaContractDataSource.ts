import { getContactsByCompany } from "../../../services/supabase/contactService";
import { getCompany } from "../../../services/supabase/companyService";
import {
  getApprovedPriceSnapshot,
  getDocumentSettings,
} from "../../../services/supabase/documentProviderService";
import { getExhibition } from "../../../services/supabase/exhibitionService";
import { getOpportunity } from "../../../services/supabase/opportunityService";
import { getOrCreateContractNumber } from "../engine/generateContractNumber";
import { loadGeneratedDocuments } from "../services/generatedDocumentStorage";
import type { ContractGenerationDataSource } from "./models";

/**
 * Browser-side composition of the persistent repositories. The endpoint
 * uses the same repository contracts with its token-scoped Supabase client.
 */
export function createViawaContractDataSource(): ContractGenerationDataSource {
  return {
    loadCompany: getCompany,
    loadOpportunity: getOpportunity,
    loadExhibition: getExhibition,
    loadContacts: getContactsByCompany,
    loadPriceSnapshot: async ({ opportunityId, exhibitionId }) => {
      return getApprovedPriceSnapshot({ opportunityId, exhibitionId });
    },
    loadSettings: getDocumentSettings,
    resolveContractNumber: async ({
      companyId,
      opportunityId,
      exhibition,
      generatedAt,
    }) => ({
      number: getOrCreateContractNumber(
        loadGeneratedDocuments(companyId),
        opportunityId,
        exhibition.id,
        exhibition.start_date ?? undefined,
        generatedAt,
      ),
    }),
  };
}
