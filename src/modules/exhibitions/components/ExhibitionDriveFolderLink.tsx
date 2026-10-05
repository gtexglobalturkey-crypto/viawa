import { ExternalLink, FolderOpen } from "lucide-react";

import { getDriveFolderUrl } from "../models/ExhibitionDriveFolder";

type Props = {
  driveFolderId: string | null | undefined;
};

// Opens the exhibition's canonical Google Drive folder. An exhibition without
// a bound (or with an unsafe) folder id shows a muted note, never a link.
export function ExhibitionDriveFolderLink({ driveFolderId }: Props) {
  const url = getDriveFolderUrl(driveFolderId);

  if (!url) {
    return (
      <span className="exhibition-drive-folder-unbound">
        Drive klasörü bağlı değil
      </span>
    );
  }

  return (
    <a
      className="exhibition-drive-folder-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <FolderOpen size={14} aria-hidden="true" />
      <span>Drive Klasörünü Aç</span>
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
