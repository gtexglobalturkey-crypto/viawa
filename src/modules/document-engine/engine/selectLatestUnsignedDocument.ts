import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";

// RC-01 — the exact record "Katılım Onaylandı" (both entry points —
// ContractPreviewModal's own button, and "Görüşmeyi Tamamla" →
// "Kazanıldı") must attach a signed PDF to: the highest-version
// GeneratedDocumentRecord for this opportunity that isn't already
// signed. Kept as its own pure, no-React module so this exact
// selection rule is unit-testable without a component render — the
// same pattern as ContractPreviewModal's own contractNumber-scoped
// latestGeneratedRecord, just opportunityId-scoped instead (usable
// from CustomerWorkspace's top level, before/without that modal ever
// having been opened).
export function selectLatestUnsignedDocument(
  documents: readonly GeneratedDocumentRecord[],
  opportunityId: string,
): GeneratedDocumentRecord | null {
  const candidates = documents.filter(
    (document) =>
      document.opportunityId === opportunityId &&
      document.status !== "signed",
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((latest, document) =>
    document.version > latest.version
      ? document
      : latest,
  );
}
