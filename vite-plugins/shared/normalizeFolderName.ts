// Shared by every dev-middleware plugin that matches folder/file names by
// role (contractTemplatePlugin, documentBasketPlugin): lowercases, strips
// Turkish diacritics, and drops anything that isn't a-z0-9, so "Fiyat
// Listesi", "fiyat_listesi" and "fiyat-listesi" all compare equal.
export function normalizeFolderName(
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
