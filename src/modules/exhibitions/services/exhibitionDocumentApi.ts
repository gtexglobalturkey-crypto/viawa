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

// /api/document-basket/* is served from the local template folders by the
// Vite dev/preview server middleware only (vite-plugins/documentBasketPlugin.ts).
// A static production deployment has no such backend, so its SPA fallback
// answers 200 with index.html. Parsing that as JSON used to surface as
// "Unexpected token '<'". Callers can tell "no local document service on this
// deployment" apart from a real failure via this error.
export class DocumentServiceUnavailableError extends Error {
  constructor() {
    super(
      "Yerel belge servisi bu ortamda mevcut değil.",
    );
    this.name = "DocumentServiceUnavailableError";
  }
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

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new DocumentServiceUnavailableError();
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
