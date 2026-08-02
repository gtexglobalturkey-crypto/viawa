import { UploadCloud } from "lucide-react";

type FilePickerProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
};

export function FilePicker({
  onFileSelected,
  disabled = false,
}: FilePickerProps) {
  return (
    <label
      className="btn btn-primary"
      style={{
        width: "100%",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled
          ? "none"
          : "auto",
      }}
    >
      <UploadCloud size={18} />
      Select Excel File

      <input
        type="file"
        accept=".xlsx,.xls"
        disabled={disabled}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onFileSelected(file);
          }
        }}
      />
    </label>
  );
}