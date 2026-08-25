import type { SupabaseClient } from "@supabase/supabase-js";

export type GeneratedDocumentGenerationStatus =
  | "PENDING"
  | "DOC_CREATED"
  | "PDF_CREATED"
  | "COMPLETED"
  | "FAILED";

export type PendingGeneratedDocument = { id: string; contractId: string; version: number };

export type GeneratedDocumentPersistence = {
  createPending(input: {
    contractId: string;
    opportunityId: string;
    companyId: string;
    exhibitionId: string;
    documentType: "participation-contract";
    templateId: string;
    generatedAt: string;
  }): Promise<PendingGeneratedDocument>;
  markDocCreated(record: PendingGeneratedDocument, input: { googleDocId: string; googleDocUrl: string }): Promise<void>;
  markPdfCreated(record: PendingGeneratedDocument, input: { googlePdfId: string; googlePdfUrl: string }): Promise<void>;
  markCompleted(record: PendingGeneratedDocument): Promise<void>;
  markFailed(record: PendingGeneratedDocument): Promise<void>;
};

const MAX_VERSION_ALLOCATION_ATTEMPTS = 3;

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createGeneratedDocumentRepository(client: SupabaseClient): GeneratedDocumentPersistence {
  async function update(record: PendingGeneratedDocument, values: Record<string, unknown>) {
    const { data, error } = await client.from("generated_documents")
      .update(values).eq("id", record.id).eq("contract_id", record.contractId)
      .select("id").single();
    if (error || data?.id !== record.id) throw new Error("Generated document lifecycle could not be persisted.");
  }

  return {
    async createPending(input) {
      if (!validUuid(input.contractId)) throw new Error("Canonical contract UUID is required.");
      for (let attempt = 0; attempt < MAX_VERSION_ALLOCATION_ATTEMPTS; attempt += 1) {
        const latest = await client.from("generated_documents").select("version")
          .eq("contract_id", input.contractId).order("version", { ascending: false }).limit(1).maybeSingle();
        if (latest.error) throw new Error("Generated document version could not be resolved.");
        const version = typeof latest.data?.version === "number" ? latest.data.version + 1 : 1;
        const inserted = await client.from("generated_documents").insert({
          contract_id: input.contractId,
          opportunity_id: input.opportunityId,
          company_id: input.companyId,
          exhibition_id: input.exhibitionId,
          document_type: input.documentType,
          template_id: input.templateId,
          version,
          generation_status: "PENDING" satisfies GeneratedDocumentGenerationStatus,
          generated_at: input.generatedAt,
        }).select("id,contract_id,version").single();
        if (!inserted.error && inserted.data?.id) {
          return { id: inserted.data.id, contractId: inserted.data.contract_id, version: inserted.data.version };
        }
        if (inserted.error?.code !== "23505") throw new Error("Pending generated document could not be persisted.");
      }
      throw new Error("Generated document version allocation conflicted repeatedly.");
    },
    markDocCreated: (record, refs) => update(record, {
      google_doc_id: refs.googleDocId, google_doc_url: refs.googleDocUrl,
      generation_status: "DOC_CREATED" satisfies GeneratedDocumentGenerationStatus,
    }),
    markPdfCreated: (record, refs) => update(record, {
      google_pdf_id: refs.googlePdfId, google_pdf_url: refs.googlePdfUrl,
      generation_status: "PDF_CREATED" satisfies GeneratedDocumentGenerationStatus,
    }),
    markCompleted: (record) => update(record, {
      generation_status: "COMPLETED" satisfies GeneratedDocumentGenerationStatus,
    }),
    markFailed: (record) => update(record, {
      generation_status: "FAILED" satisfies GeneratedDocumentGenerationStatus,
    }),
  };
}
