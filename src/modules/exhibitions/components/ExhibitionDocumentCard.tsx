import type { ExhibitionDocument } from "../models/ExhibitionDocument";

type ExhibitionDocumentCardProps = {
  document: ExhibitionDocument;
  exists: boolean;
  // Google Drive source (exhibition_sales_documents). When present the tile
  // is a real link that opens the current Drive file in a new tab.
  driveUrl?: string | null;
  isSelected: boolean;
  isPreviewed: boolean;
  onPreview: () => void;
  onToggleSelected: () => void;
};

export function ExhibitionDocumentCard({
  document,
  exists,
  driveUrl = null,
  isSelected,
  isPreviewed,
  onPreview,
  onToggleSelected,
}: ExhibitionDocumentCardProps) {
  if (driveUrl) {
    return (
      <a
        className="exhibition-doc-card"
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${document.title} — Google Drive'da aç`}
      >
        <div className="exhibition-doc-card-thumb">
          <document.icon size={20} />
        </div>

        <p className="exhibition-doc-card-title">
          {document.title}
        </p>
      </a>
    );
  }

  return (
    <div
      className={`exhibition-doc-card${
        isPreviewed
          ? " exhibition-doc-card-active"
          : ""
      }${
        !exists
          ? " exhibition-doc-card-disabled"
          : ""
      }`}
      role="button"
      aria-disabled={!exists}
      tabIndex={exists ? 0 : -1}
      onClick={() => {
        if (!exists) {
          return;
        }

        onPreview();
      }}
      onKeyDown={(event) => {
        if (!exists) {
          return;
        }

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onPreview();
        }
      }}
    >
      <input
        type="checkbox"
        className="exhibition-doc-card-checkbox"
        checked={isSelected}
        disabled={!exists}
        aria-label={`${document.title} gönderilecek olarak seç`}
        onClick={(event) =>
          event.stopPropagation()
        }
        onChange={onToggleSelected}
      />

      <div className="exhibition-doc-card-thumb">
        <document.icon size={20} />
      </div>

      <p className="exhibition-doc-card-title">
        {document.title}
      </p>

      {!exists && (
        <span className="exhibition-doc-card-status">
          Belge bulunamadı
        </span>
      )}
    </div>
  );
}
