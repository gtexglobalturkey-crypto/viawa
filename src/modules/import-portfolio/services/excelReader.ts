import * as XLSX from "xlsx";

export type ExcelPreview = {
  rows: Record<string, unknown>[];
  totalRows: number;
};

export function readExcelFile(file: File): Promise<ExcelPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;

        const workbook = XLSX.read(data, {
          type: "array",
        });

        const firstSheet = workbook.SheetNames[0];

        const worksheet = workbook.Sheets[firstSheet];

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          {
            defval: "",
          }
        );

        resolve({
          rows,
          totalRows: rows.length,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;

    reader.readAsArrayBuffer(file);
  });
}