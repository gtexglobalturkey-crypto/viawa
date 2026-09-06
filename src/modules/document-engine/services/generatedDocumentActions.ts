import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Use the persisted provider URL verbatim, and reject master/mismatched references. */
export function generatedGoogleDocsUrl(record: GeneratedDocumentRecord): string | null {
  if (!record.googleDocUrl || !record.googleDocFileId || record.googleDocFileId === record.masterTemplateId) return null;
  try {
    const url = new URL(record.googleDocUrl);
    const id = url.pathname.match(/^\/document\/d\/([^/]+)/)?.[1];
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.username || url.password || id !== record.googleDocFileId) return null;
    return record.googleDocUrl;
  } catch { return null; }
}

export async function verifyGeneratedPdf(blob: Blob, expectedSha256?: string): Promise<void> {
  const bytes = await blob.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Sözleşme PDF'i doğrulanamadı.");
  if (expectedSha256) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const actual = [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (actual !== expectedSha256) throw new Error("PDF bu sözleşme sürümüyle eşleşmiyor.");
  }
}

export async function loadMatchingGeneratedPdf(client: SupabaseClient, record: GeneratedDocumentRecord): Promise<Blob> {
  let blob: Blob;
  if (record.storagePath && record.storageBucket) {
    const result = await client.storage.from(record.storageBucket).download(record.storagePath);
    if (result.error || !result.data) throw new Error("PDF indirilemedi. Lütfen tekrar deneyin.");
    blob = result.data;
  } else if (record.pdfDataUrl?.startsWith("data:application/pdf")) {
    blob = await (await fetch(record.pdfDataUrl)).blob();
  } else { throw new Error("Bu eski sürümün PDF'i Google Drive arşivinde açılabilir."); }
  await verifyGeneratedPdf(blob, record.pdfSha256);
  return blob;
}
