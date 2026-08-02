import type { ExhibitionDocument } from "../models/ExhibitionDocument";

type ExhibitionDocumentCardProps = {
  document: ExhibitionDocument;
  exists: boolean;
  isSelected: boolean;
  isPreviewed: boolean;
  onPreview: () => void;
  onToggleSelected: () => void;
};

export function ExhibitionDocumentCard({
  document,
  exists,
  isSelected,
  isPreviewed,
  onPreview,
  onToggleSelected,
}: ExhibitionDocumentCardProps) {
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
