import { createClient } from "@supabase/supabase-js";

import type { AuthenticatedContractUser } from "./models";
import type { ContractGenerationDataSource } from "../../src/modules/document-engine/orchestration/models.ts";
import {
  loadPersistentApprovedPriceSnapshot,
  loadPersistentDocumentSettings,
} from "../../src/modules/document-engine/repositories/persistentDocumentRepositories.ts";
import { createPersistentContractNumberProvider } from "../../src/modules/document-engine/repositories/persistentContractNumberRepository.ts";
import { createGeneratedDocumentRepository } from "../../src/modules/document-engine/repositories/generatedDocumentRepository.ts";

export function createPersistentEndpointDataSourceFactory(input: {
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  return ({ accessToken }: {
    user: AuthenticatedContractUser;
    accessToken: string;
  }): ContractGenerationDataSource => {
    const client = createClient(input.supabaseUrl, input.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    async function one(table: string, id: string) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    return {
      loadCompany: async (id) => one("companies", id),
      loadOpportunity: async (id) => one("opportunities", id),
      loadExhibition: async (id) => one("exhibitions", id),
      loadContacts: async (companyId) => {
        const { data, error } = await client
          .from("contacts")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data ?? [];
      },
      loadPriceSnapshot: ({ opportunityId, exhibitionId }) =>
        loadPersistentApprovedPriceSnapshot(client, {
          opportunityId,
          exhibitionId,
        }),
      loadSettings: () => loadPersistentDocumentSettings(client),
      resolveContractNumber: createPersistentContractNumberProvider(client),
    } as ContractGenerationDataSource;
  };
}

export function createPersistentGeneratedDocumentRepositoryFactory(input: {
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  return ({ accessToken }: { accessToken: string }) => createGeneratedDocumentRepository(
    createClient(input.supabaseUrl, input.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}
