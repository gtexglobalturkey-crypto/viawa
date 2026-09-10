import * as XLSX from "xlsx";

import { EXCEL_TEMPLATE_SHEET_NAME } from "../excelMapping";

export type ExcelPreview = {
  rows: Record<string, unknown>[];
  totalRows: number;
};

/**
 * The official template (resources/templates/
 * VIAWA_Toplu_Firma_Yukleme_Sablonu.xlsx) has three sheets: "Firma Veri
 * Girişi" (the only one to import), "Kullanım Talimatı" (instructions —
 * not data), and "Örnek Kayıt" (a sample record — not real data). Only
 * "Firma Veri Girişi" is read here, by name, so the other two are never
 * mistaken for company rows.
 *
 * Within that sheet, row 1 is a title, row 2 an instructions line, and
 * row 3 a group-header row (e.g. "KİŞİ 1" spanning its 7 columns) — the
 * actual column headers are row 4, so parsing starts there (range: 3,
 * 0-indexed).
 */
const HEADER_ROW_INDEX = 3;

export function readExcelFile(
  file: File,
): Promise<ExcelPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;

        const workbook = XLSX.read(data, {
          type: "array",
        });

        const worksheet = workbook.Sheets[EXCEL_TEMPLATE_SHEET_NAME] ?? workbook.Sheets["VIAWA Import"];

        if (!worksheet) {
          reject(
            new Error(
              `"${EXCEL_TEMPLATE_SHEET_NAME}" veya "VIAWA Import" sekmesi bulunamadı.`,
            ),
          );

          return;
        }

        const isMasterExport = Boolean(workbook.Sheets["VIAWA Import"] === worksheet);
        const rows = XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(worksheet, {
          defval: "",
          range: isMasterExport ? 0 : HEADER_ROW_INDEX,
        });

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
