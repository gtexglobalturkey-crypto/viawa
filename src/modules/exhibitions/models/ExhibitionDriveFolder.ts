// Same character set as the exhibitions.drive_folder_id CHECK constraint.
const DRIVE_FOLDER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// Typed/pasted ids must also look like a real Drive id, not a stray word.
const MIN_ENTERED_DRIVE_FOLDER_ID_LENGTH = 10;

export function normalizeDriveFolderId(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return DRIVE_FOLDER_ID_PATTERN.test(trimmed) ? trimmed : null;
}

// The URL is never stored: it is derived from the folder id at render time.
export function getDriveFolderUrl(
  folderId: string | null | undefined,
): string | null {
  const id = normalizeDriveFolderId(folderId);
  return id ? `https://drive.google.com/drive/folders/${id}` : null;
}

// Accepts what a user pastes for an existing folder: the bare id or a
// https://drive.google.com/drive/folders/{id} link. Anything else is rejected.
export function parseDriveFolderInput(value: string): string | null {
  const trimmed = value.trim();
  let candidate = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }

    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const folderIndex = segments.indexOf("folders");
    if (folderIndex < 0) return null;

    candidate = segments[folderIndex + 1] ?? "";
  }

  const id = normalizeDriveFolderId(candidate);
  return id && id.length >= MIN_ENTERED_DRIVE_FOLDER_ID_LENGTH ? id : null;
}
