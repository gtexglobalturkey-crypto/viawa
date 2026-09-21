export type ExhibitionSalesDocument = {
  id: string;
  exhibitionId: string;
  documentType: string;
  title: string;
  driveFileId: string;
  sortOrder: number;
};

const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

export function getDriveFileViewUrl(fileId: string): string | null {
  return typeof fileId === "string" && DRIVE_FILE_ID_PATTERN.test(fileId)
    ? `https://drive.google.com/file/d/${fileId}/view`
    : null;
}

export type ExhibitionSalesDocumentLink = {
  document: ExhibitionSalesDocument;
  url: string;
};

// Resolves the current Drive reference for one document type, so existing UI
// (e.g. the Flyer/Kroki tiles) can consume the generic table without knowing
// any exhibition or file id. `documents` arrives ordered by sort_order.
export function findSalesDocumentLink(
  documents: ExhibitionSalesDocument[],
  documentType: string,
): ExhibitionSalesDocumentLink | null {
  for (const document of documents) {
    if (document.documentType !== documentType) continue;

    const url = getDriveFileViewUrl(document.driveFileId);
    if (url) return { document, url };
  }

  return null;
}
