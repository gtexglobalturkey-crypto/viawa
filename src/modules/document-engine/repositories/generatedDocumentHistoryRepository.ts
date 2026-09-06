import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";

export type GeneratedDocumentHistoryRow = {
  id: string; company_id: string; opportunity_id: string; exhibition_id: string;
  version: number; generated_at: string; template_id: string;
  google_doc_id: string | null; google_doc_url: string | null;
  google_pdf_id: string | null; google_pdf_url: string | null;
  file_name: string | null; pdf_storage_path: string | null;
  pdf_sha256: string | null; pdf_size_bytes: number | null;
  signed_pdf_storage_path?: string | null; signed_pdf_file_name?: string | null; signature_completed_at?: string | null;
  contract_numbers: { contract_number: string } | null;
};

export function mapGeneratedDocumentHistory(row: GeneratedDocumentHistoryRow): GeneratedDocumentRecord {
  if (!row.contract_numbers?.contract_number) throw new Error("Canonical contract number is unavailable.");
  return {
    id: row.id, companyId: row.company_id, opportunityId: row.opportunity_id, exhibitionId: row.exhibition_id,
    documentType: "participation-contract", contractNumber: row.contract_numbers.contract_number,
    version: row.version, createdAt: row.generated_at, status: row.signature_completed_at ? "signed" : "completed", generationStatus: "COMPLETED",
    approvedSnapshotId: `${row.opportunity_id}:${row.exhibition_id}`,
    signedPdfStoragePath: row.signed_pdf_storage_path ?? undefined, signedPdfFileName: row.signed_pdf_file_name ?? undefined, signatureCompletedAt: row.signature_completed_at ?? undefined,
    fileName: row.file_name ?? `${row.contract_numbers.contract_number}.pdf`,
    masterTemplateId: row.template_id, googleDocFileId: row.google_doc_id ?? undefined,
    googleDocUrl: row.google_doc_url ?? undefined, googlePdfFileId: row.google_pdf_id ?? undefined,
    googlePdfUrl: row.google_pdf_url ?? undefined,
    storageBucket: row.pdf_storage_path ? "contract-documents" : undefined,
    storagePath: row.pdf_storage_path ?? undefined, storageSize: row.pdf_size_bytes ?? undefined,
    storageMimeType: row.pdf_storage_path ? "application/pdf" : undefined, pdfSha256: row.pdf_sha256 ?? undefined,
  };
}

const COLUMNS = "id,company_id,opportunity_id,exhibition_id,version,generated_at,template_id,google_doc_id,google_doc_url,google_pdf_id,google_pdf_url,file_name,pdf_storage_path,pdf_sha256,pdf_size_bytes,signed_pdf_storage_path,signed_pdf_file_name,signature_completed_at,contract_numbers(contract_number)";

/** Caller-session client only: RLS is authoritative. Never imports or writes browser history. */
export async function loadGeneratedDocumentHistory(client: SupabaseClient, companyId: string): Promise<GeneratedDocumentRecord[]> {
  const records = new Map<string, GeneratedDocumentRecord>();
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("generated_documents").select(COLUMNS)
      .eq("company_id", companyId).eq("document_type", "participation-contract").eq("generation_status", "COMPLETED")
      .order("generated_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + pageSize - 1);
    if (error || !data) throw new Error("Sözleşme geçmişi yüklenemedi. Lütfen tekrar deneyin.");
    for (const row of data as unknown as GeneratedDocumentHistoryRow[]) {
      const record = mapGeneratedDocumentHistory(row);
      records.set(record.id, record);
    }
    if (data.length < pageSize) return [...records.values()];
  }
}
