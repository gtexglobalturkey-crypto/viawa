import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { FilePicker } from "./components/FilePicker";
import { readExcelFile } from "./services/excelReader";
import { mapExcelRows, ImportMappingResult } from "./services/excelMapper";

export function ImportPortfolioPage() {
  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [mappingResult, setMappingResult] =
    useState<ImportMappingResult | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileSelected(file: File) {
    setFileName(file.name);
    setTotalRows(null);
    setMappingResult(null);
    setError("");
    setIsReading(true);

    try {
      const preview = await readExcelFile(file);
      const mapped = mapExcelRows(preview.rows);

      setTotalRows(preview.totalRows);
      setMappingResult(mapped);
    } catch {
      setError("Excel file could not be read.");
    } finally {
      setIsReading(false);
    }
  }

  return (
    <main className="page">
      <Panel>
        <p className="eyebrow">Import Portfolio</p>
        <h1>Import Existing Portfolio</h1>

        <p className="muted">
          Upload your company Excel file and start working in Atlas within a few
          minutes. Missing information can be completed during the sales process.
        </p>

        <br />

        <div className="data-list">
          <div>
            <span>Supported File</span>
            <strong>Atlas Excel Template (.xlsx)</strong>
          </div>
          <div>
            <span>Creates</span>
            <strong>Companies, Contacts, Exhibition Interests</strong>
          </div>
          <div>
            <span>Rule</span>
            <strong>Missing data will not block import</strong>
          </div>
        </div>

        <br />

        <FilePicker onFileSelected={handleFileSelected} />

        <br />
        <br />

        <Panel>
          <FileSpreadsheet size={24} />
          <h2>Preview</h2>

          {!fileName && (
            <p className="muted">
              After selecting your Excel file, Atlas will show what it found.
            </p>
          )}

          {fileName && (
            <div className="data-list">
              <div>
                <span>Selected File</span>
                <strong>{fileName}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {isReading
                    ? "Reading..."
                    : error
                    ? error
                    : "File read successfully"}
                </strong>
              </div>

              <div>
                <span>Rows Found</span>
                <strong>{totalRows ?? "-"}</strong>
              </div>

              <div>
                <span>Companies Found</span>
                <strong>{mappingResult?.companies.length ?? "-"}</strong>
              </div>

              <div>
                <span>Contacts Found</span>
                <strong>{mappingResult?.contacts.length ?? "-"}</strong>
              </div>

              <div>
                <span>Exhibition Interests Found</span>
                <strong>
                  {mappingResult?.exhibitionInterests.length ?? "-"}
                </strong>
              </div>
            </div>
          )}
        </Panel>

        <br />

        <Link className="btn" to="/companies">
          Back to Companies
        </Link>
      </Panel>
    </main>
  );
}