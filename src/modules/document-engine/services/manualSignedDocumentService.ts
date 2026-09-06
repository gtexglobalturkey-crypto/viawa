import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";
import { verifyGeneratedPdf } from "./generatedDocumentActions";

/** Persist the existing user-uploaded evidence. This never initiates signing. */
export async function saveManualSignedDocument(client: SupabaseClient, userId: string, record: GeneratedDocumentRecord, file: File) {
  await verifyGeneratedPdf(file);
  const path = `${userId}/${record.companyId}/${record.id}/signed-${crypto.randomUUID()}.pdf`;
  const upload = await client.storage.from("contract-documents").upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw new Error("İmzalı PDF kaydedilemedi.");
  const completedAt = new Date().toISOString();
  const { data, error } = await client.from("generated_documents").update({
    signed_pdf_storage_path: path, signed_pdf_file_name: file.name, signature_completed_at: completedAt,
  }).eq("id", record.id).eq("company_id", record.companyId).eq("generation_status", "COMPLETED")
    .is("signed_pdf_storage_path", null).select("id").single();
  if (error || data?.id !== record.id) throw new Error("İmzalı PDF kaydı tamamlanamadı. Sözleşme geçmişini yeniden yükleyin.");
  return { completedAt, path };
}
