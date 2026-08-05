import {
  type DragEvent,
  useRef,
  useState,
} from "react";

// Belge Yaşam Döngüsü — "Katılım Onaylandı": the one manual step this
// sprint replaces Zoho/Adobe/Dropbox Sign + webhooks/API with (none of
// those are wired up yet — see the sprint's own ÖNEMLİ note). The rep
// gets the signed PDF back over Outlook and uploads it here by hand;
// everything downstream (stage/timeline/reminders/archive) is driven
// by the existing onConfirm callback, not by this component.
type ParticipationConfirmedModalProps = {
  submitting: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void;
};

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export function ParticipationConfirmedModal({
  submitting,
  onClose,
  onConfirm,
}: ParticipationConfirmedModalProps) {
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [fileError, setFileError] = useState<
    string | null
  >(null);
  const [isDragActive, setIsDragActive] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(
    null,
  );

  function applySelectedFile(
    file: File | undefined,
  ): void {
    if (!file) {
      return;
    }

    if (!isPdfFile(file)) {
      setFileError(
        "Yalnızca PDF dosyası yükleyebilirsiniz.",
      );
      setSelectedFile(null);
      return;
    }

    setFileError(null);
    setSelectedFile(file);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ): void {
    event.preventDefault();
    setIsDragActive(false);
    applySelectedFile(
      event.dataTransfer.files[0],
    );
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        background:
          "rgba(15, 23, 42, 0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 90,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Katılım Onaylandı"
        style={{
          width: "min(420px, calc(100vw - 32px))",
          background:
            "var(--atlas-surface, #fff)",
          borderRadius: 12,
          boxShadow:
            "0 20px 48px rgba(15, 23, 42, 0.24)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <p
            className="eyebrow"
            style={{ margin: "0 0 4px" }}
          >
            Katılım Onaylandı
          </p>
          <p
            className="muted"
            style={{ margin: 0, fontSize: 12 }}
          >
            İmzalı sözleşmeyi yükleyin.
          </p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() =>
            setIsDragActive(false)
          }
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${
              isDragActive
                ? "#7A0F23"
                : "#cbd5e1"
            }`,
            borderRadius: 10,
            padding: "24px 16px",
            textAlign: "center",
            background: isDragActive
              ? "rgba(122, 15, 35, 0.04)"
              : "#f8fafc",
          }}
        >
          {selectedFile ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: "#334155",
                overflowWrap: "anywhere",
              }}
            >
              {selectedFile.name}
            </p>
          ) : (
            <p
              className="muted"
              style={{
                margin: "0 0 10px",
                fontSize: 12,
              }}
            >
              Sürükle bırak
            </p>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              fileInputRef.current?.click()
            }
            style={{
              marginTop: 10,
              padding: "8px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#ffffff",
              color: "#334155",
              fontSize: 12,
              fontWeight: 700,
              cursor: submitting
                ? "not-allowed"
                : "pointer",
            }}
          >
            PDF Seç
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            aria-label="İmzalı PDF seç"
            onChange={(event) =>
              applySelectedFile(
                event.target.files?.[0],
              )
            }
            style={{ display: "none" }}
          />
        </div>

        {fileError ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 12,
              color: "#b42318",
            }}
          >
            {fileError}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            style={{
              padding: "10px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#ffffff",
              color: "#334155",
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting
                ? "not-allowed"
                : "pointer",
            }}
          >
            İptal
          </button>

          <button
            type="button"
            disabled={
              !selectedFile || submitting
            }
            onClick={() => {
              if (selectedFile) {
                onConfirm(selectedFile);
              }
            }}
            style={{
              padding: "10px 18px",
              border: 0,
              borderRadius: 10,
              background: selectedFile
                ? "#15803d"
                : "#94a3b8",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 800,
              cursor:
                !selectedFile || submitting
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {submitting
              ? "Yükleniyor..."
              : "Katılımı Onayla"}
          </button>
        </div>
      </div>
    </div>
  );
}
