// Mirrors PREVIEWABLE_MIME_TYPES in vite-plugins/documentBasketPlugin.ts —
// kept in sync manually since plugin files (vite-plugins/**) and app code
// (src/**) live in separate TypeScript projects and can't share a module.
const KNOWN_MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function resolveMimeType(
  fileName: string,
): string {
  const separatorIndex =
    fileName.lastIndexOf(".");

  if (separatorIndex === -1) {
    return "application/octet-stream";
  }

  const extension = fileName
    .slice(separatorIndex)
    .toLowerCase();

  return (
    KNOWN_MIME_TYPES[extension] ??
    "application/octet-stream"
  );
}
