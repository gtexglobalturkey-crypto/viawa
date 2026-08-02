import { useEffect, useState } from "react";

import type { ExhibitionDocument } from "../models/ExhibitionDocument";

type ExhibitionDocumentPreviewProps = {
  document: ExhibitionDocument | null;
  fileName: string | null;
  fileUrl: string | null;
  isSelected: boolean;
  onToggleSelected: () => void;
};

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

function getExtension(
  fileName: string,
): string {
  const separatorIndex =
    fileName.lastIndexOf(".");

  return separatorIndex === -1
    ? ""
    : fileName
        .slice(separatorIndex)
        .toLowerCase();
}

export function ExhibitionDocumentPreview({
  document,
  fileName,
  fileUrl,
  isSelected,
  onToggleSelected,
}: ExhibitionDocumentPreviewProps) {
  const [hasLoadError, setHasLoadError] =
    useState(false);

  useEffect(() => {
    setHasLoadError(false);
  }, [fileUrl]);

  if (!document) {
    return (
      <div className="exhibition-doc-preview">
        <p className="exhibition-doc-preview-empty">
          Bir belge seçin
        </p>
      </div>
    );
  }

  const extension = fileName
    ? getExtension(fileName)
    : "";

  const isImage =
    IMAGE_EXTENSIONS.has(extension);

  const isPdf = extension === ".pdf";

  return (
    <div className="exhibition-doc-preview">
      <div className="exhibition-doc-preview-placeholder">
        {!fileUrl ? (
          <document.icon size={36} />
        ) : hasLoadError ? (
          <span className="exhibition-doc-preview-error">
            Önizleme yüklenemedi.
          </span>
        ) : isPdf ? (
          <iframe
            key={fileUrl}
            src={fileUrl}
            title={document.title}
            className="exhibition-doc-preview-frame"
            onError={() =>
              setHasLoadError(true)
            }
          />
        ) : isImage ? (
          <img
            key={fileUrl}
            src={fileUrl}
            alt={document.title}
            className="exhibition-doc-preview-image"
            onError={() =>
              setHasLoadError(true)
            }
          />
        ) : (
          <span className="exhibition-doc-preview-error">
            Bu belge türü önizlenemiyor.
          </span>
        )}
      </div>

      <p className="exhibition-doc-preview-title">
        {document.title}
      </p>

      <label className="exhibition-doc-preview-checkbox-row">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelected}
        />

        <span>Gönderilecek</span>
      </label>
    </div>
  );
}
