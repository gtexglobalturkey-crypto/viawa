// Kritik Akış Düzeltmesi 10 — Repository'nin sahibi Exhibition'dır,
// opportunity değil: bilgisayarda fuar başına tek bir gerçek klasör var
// (bkz. resolveExhibitionRoot), o yüzden "Fuar Dosyaları" artık
// opportunity başına değil, distinct exhibition_id başına bir kart
// üretir. Kept as its own pure, no-React module so this exact rule is
// unit-testable without a component render.
export type ExhibitionFileItem = {
  exhibition_id?: string | null;
};

export function distinctExhibitionIds(
  items: readonly ExhibitionFileItem[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const item of items) {
    if (!item.exhibition_id) {
      continue;
    }

    if (seen.has(item.exhibition_id)) {
      continue;
    }

    seen.add(item.exhibition_id);
    ordered.push(item.exhibition_id);
  }

  return ordered;
}
