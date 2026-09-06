import { useState } from "react";
import { supabase } from "../../../services/supabase/client";
import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";
import { generatedGoogleDocsUrl, loadMatchingGeneratedPdf } from "../services/generatedDocumentActions";

export function GeneratedContractActions({ record }: { record: GeneratedDocumentRecord }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docsUrl = generatedGoogleDocsUrl(record);
  const buttonStyle = { padding: "10px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center" };

  async function download(signed = false) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const downloadRecord = signed ? { ...record, storageBucket: "contract-documents" as const, storagePath: record.signedPdfStoragePath, pdfSha256: undefined, fileName: record.signedPdfFileName ?? "signed.pdf", pdfDataUrl: record.signedPdfDataUrl } : record;
      const blob = await loadMatchingGeneratedPdf(supabase, downloadRecord);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = downloadRecord.fileName; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF indirilemedi.");
    } finally { setBusy(false); }
  }

  return <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
    {docsUrl && <a href={docsUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, background: "#1d4ed8", color: "white", border: "1px solid #1d4ed8" }}>Google Docs'ta Aç</a>}
    {(record.storagePath || record.pdfDataUrl) ? <button type="button" onClick={() => void download()} disabled={busy} style={{ ...buttonStyle, background: "white", color: "#334155", border: "1px solid #cbd5e1" }}>{busy ? "İndiriliyor…" : "PDF İndir"}</button>
      : record.googlePdfUrl && <a href={record.googlePdfUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, color: "#334155", border: "1px solid #cbd5e1" }}>PDF İndir</a>}
    {record.signedPdfStoragePath && <button type="button" onClick={() => void download(true)} disabled={busy} style={{ ...buttonStyle, background: "white", color: "#334155", border: "1px solid #cbd5e1" }}>İmzalı PDF İndir</button>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
