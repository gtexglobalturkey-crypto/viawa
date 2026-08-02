import type { SelectedDocumentBasketItem } from "../../call-workspace/document-basket";
import type { SelectedExhibitionDocument } from "../../exhibitions/models/SelectedExhibitionDocument";

import type { CommunicationAttachment } from "../models/CommunicationAttachment";

const TEMPLATE_ATTACHMENTS: Record<
  string,
  string[]
> = {
  "Information Package": [
    "Şirket Profili.pdf",
    "Fuar Broşürü.pdf",
    "Kroki.pdf",
    "Fiyat Listesi.pdf",
    "Katılım Şartları.pdf",
  ],

  "Exhibition Presentation": [
    "Fuar Sunumu.pdf",
    "Şirket Profili.pdf",
  ],

  Quotation: [
    "Resmi Teklif.pdf",
    "Fiyat Hesaplaması.pdf",
    "Kroki.pdf",
  ],

  "Revised Quotation": [
    "Revize Teklif.pdf",
    "Güncel Fiyat Listesi.pdf",
    "Güncel Kat Planı.pdf",
  ],

  Contract: [
    "Katılım Sözleşmesi.pdf",
    "Şartlar ve Koşullar.pdf",
  ],

  "Visa Invitation": [
    "Vize Davet Mektubu.pdf",
  ],

  "Visitor Invitation": [
    "Ziyaretçi Daveti.pdf",
  ],

  "Thank You": [],
};

export function getAttachments(
  template: string,
): string[] {
  return (
    TEMPLATE_ATTACHMENTS[template] ?? []
  );
}

// Compares file names ignoring case, Turkish diacritics and punctuation,
// so "Kroki.pdf" (static template placeholder) recognizes "kroki.pdf"
// (the real Document Basket file) as the same document.
function normalizeAttachmentName(
  value: string,
): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]/g, "");
}

// Merges real, user-selected documents with the template's static
// placeholder list, in priority order: Exhibition Workspace selections
// first, then the older Document Basket source, then template
// placeholders. Higher-priority entries always win: a lower-priority
// entry is dropped whenever its name matches one already added, so the
// same document is never shown twice.
export function buildCommunicationAttachments(
  template: string,
  documentBasketItems: SelectedDocumentBasketItem[],
  exhibitionDocuments: SelectedExhibitionDocument[] = [],
): CommunicationAttachment[] {
  const exhibitionAttachments: CommunicationAttachment[] =
    exhibitionDocuments.map(
      (document) => ({
        id: `exhibition-workspace:${document.exhibitionId}:${document.role}`,
        fileName: document.fileName,
        source: "exhibition-workspace",
        displayName: document.displayName,
        exhibitionId: document.exhibitionId,
        exhibitionRole: document.role,
        fileUrl: document.resolvedUrl,
        mimeType: document.mimeType,
      }),
    );

  const usedNormalizedNames = new Set(
    exhibitionAttachments.map(
      (attachment) =>
        normalizeAttachmentName(
          attachment.fileName,
        ),
    ),
  );

  const documentBasketAttachments: CommunicationAttachment[] =
    documentBasketItems
      .filter(
        (item) =>
          !usedNormalizedNames.has(
            normalizeAttachmentName(
              item.fileName ?? item.label,
            ),
          ),
      )
      .map((item) => ({
        id: `document-basket:${item.id}`,
        fileName:
          item.fileName ?? item.label,
        source: "document-basket",
        documentRole: item.id,
      }));

  for (const attachment of documentBasketAttachments) {
    usedNormalizedNames.add(
      normalizeAttachmentName(
        attachment.fileName,
      ),
    );
  }

  // A real Exhibition Workspace selection means the user has already
  // consciously chosen exactly which documents to send — the static
  // template placeholder list must not be appended on top of that
  // deliberate choice. It only fills in when there is no such selection.
  const templateAttachments: CommunicationAttachment[] =
    exhibitionAttachments.length > 0
      ? []
      : getAttachments(template)
          .filter(
            (fileName) =>
              !usedNormalizedNames.has(
                normalizeAttachmentName(
                  fileName,
                ),
              ),
          )
          .map((fileName) => ({
            id: `template:${fileName}`,
            fileName,
            source: "template" as const,
          }));

  return [
    ...exhibitionAttachments,
    ...documentBasketAttachments,
    ...templateAttachments,
  ];
}