import { UploadCloud } from "lucide-react";

type FilePickerProps = {
  onFileSelected: (file: File) => void;
};

export function FilePicker({ onFileSelected }: FilePickerProps) {
  return (
    <label className="btn btn-primary" style={{ width: "100%" }}>
      <UploadCloud size={18} />
      Select Excel File

      <input
        type="file"
        accept=".xlsx,.xls"
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