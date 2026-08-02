import type { ExhibitionDocumentId } from "../models/ExhibitionDocument";

// Reuses the existing Document Basket / Exhibition Repository endpoints
// (vite-plugins/documentBasketPlugin.ts) — same role ids, same folder
// resolution — just scoped to a specific exhibition via the
// exhibitionName query param.

export type ExhibitionDocumentStatus = {
  id: ExhibitionDocumentId;
  title: string;
  exists: boolean;
  fileName: string | null;
};

// The exhibition's full "Fuar Adı" is free text with no naming convention,
// so it may share nothing with the on-disk template folder name (e.g. a
// venue's full official name typed by the user). "Kısa Adı" (shortName) is
// sent alongside it as a fallback the server tries when the full name
// doesn't match any folder — see resolveExhibitionRoot in
// vite-plugins/documentBasketPlugin.ts.
function buildExhibitionQuery(
  exhibitionName: string,
  exhibitionShortName?: string,
): string {
  const params = new URLSearchParams({
    exhibitionName,
  });

  if (exhibitionShortName) {
    params.set(
      "exhibitionShortName",
      exhibitionShortName,
    );
  }

  return params.toString();
}

export async function fetchExhibitionDocumentStatus(
  exhibitionName: string,
  exhibitionShortName?: string,
): Promise<ExhibitionDocumentStatus[]> {
  const response = await fetch(
    `/api/document-basket/status?${buildExhibitionQuery(
      exhibitionName,
      exhibitionShortName,
    )}`,
  );

  if (!response.ok) {
    throw new Error(
      "Fuar belgeleri durumu alınamadı.",
    );
  }

  const data = (await response.json()) as {
    items: ExhibitionDocumentStatus[];
  };

  return data.items;
}

export function buildExhibitionDocumentFileUrl(
  role: ExhibitionDocumentId,
  exhibitionName: string,
  exhibitionShortName?: string,
): string {
  return `/api/document-basket/file?role=${encodeURIComponent(
    role,
  )}&${buildExhibitionQuery(
    exhibitionName,
    exhibitionShortName,
  )}`;
}
