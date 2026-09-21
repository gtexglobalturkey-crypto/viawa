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
