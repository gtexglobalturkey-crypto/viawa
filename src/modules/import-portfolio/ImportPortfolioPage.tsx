import {
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CircleCheck,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { FilePicker } from "./components/FilePicker";
import { readExcelFile } from "./services/excelReader";
import {
  mapExcelRows,
  ImportMappingResult,
} from "./services/excelMapper";
import {
  importCompanies,
  ImportRowResult,
  ImportRowStatus,
  ImportSummary,
} from "./services/importService";

const TEMPLATE_FILE_URL =
  "/templates/VIAWA_Toplu_Firma_Yukleme_Sablonu.xlsx";
const TEMPLATE_FILE_NAME =
  "VIAWA_Toplu_Firma_Yukleme_Sablonu.xlsx";

const ROW_STATUS_LABEL: Record<
  ImportRowStatus,
  string
> = {
  created: "Başarılı",
  skipped_duplicate: "Mükerrer",
  partial: "Kısmi",
  failed: "Başarısız",
};

const ROW_STATUS_CLASS: Record<
  ImportRowStatus,
  string
> = {
  created: "import-status-success",
  skipped_duplicate:
    "import-status-duplicate",
  partial: "import-status-partial",
  failed: "import-status-failed",
};

function countContactsFound(
  mappingResult: ImportMappingResult | null,
): number {
  if (!mappingResult) {
    return 0;
  }

  return mappingResult.companies.reduce(
    (sum, company) =>
      sum + company.contacts.length,
    0,
  );
}

export function ImportPortfolioPage() {
  const navigate = useNavigate();

  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [mappingResult, setMappingResult] =
    useState<ImportMappingResult | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState("");

  const [isImporting, setIsImporting] =
    useState(false);
  const [importProgress, setImportProgress] =
    useState<{
      done: number;
      total: number;
    } | null>(null);
  const [importSummary, setImportSummary] =
    useState<ImportSummary | null>(null);

  const isImportingRef = useRef(false);

  useEffect(() => {
    if (!isImporting) {
      return;
    }

    function handleBeforeUnload(
      event: BeforeUnloadEvent,
    ) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, [isImporting]);

  async function handleFileSelected(file: File) {
    setFileName(file.name);
    setTotalRows(null);
    setMappingResult(null);
    setError("");
    setImportSummary(null);
    setImportProgress(null);
    setIsReading(true);

    try {
      const preview = await readExcelFile(file);
      const mapped = mapExcelRows(preview.rows);

      setTotalRows(preview.totalRows);
      setMappingResult(mapped);
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "Excel dosyası okunamadı.",
      );
    } finally {
      setIsReading(false);
    }
  }

  async function handleImport() {
    if (isImportingRef.current) {
      return;
    }

    const validCompanies =
      mappingResult?.companies ?? [];

    if (validCompanies.length === 0) {
      return;
    }

    isImportingRef.current = true;
    setIsImporting(true);
    setImportSummary(null);
    setImportProgress({
      done: 0,
      total: validCompanies.length,
    });

    try {
      const summary = await importCompanies(
        validCompanies,
        (done, total) => {
          setImportProgress({ done, total });
        },
      );

      setImportSummary(summary);
    } finally {
      isImportingRef.current = false;
      setIsImporting(false);
    }
  }

  const contactsFound =
    countContactsFound(mappingResult);

  const hasValidRows =
    (mappingResult?.companies.length ?? 0) > 0;

  if (importSummary) {
    return (
      <main className="page">
        <Panel>
          <p className="eyebrow">
            Import Portfolio
          </p>
          <h1>İçe Aktarma Sonucu</h1>

          <div className="data-list">
            <div>
              <span>Oluşturulan firma</span>
              <strong>
                {
                  importSummary.createdCompanies
                }
              </strong>
            </div>

            <div>
              <span>Oluşturulan kişi</span>
              <strong>
                {
                  importSummary.createdContacts
                }
              </strong>
            </div>

            <div>
              <span>
                Mükerrer olduğu için
                atlanan
              </span>
              <strong>
                {
                  importSummary.skippedDuplicates
                }
              </strong>
            </div>

            <div>
              <span>Kısmen oluşturulan</span>
              <strong>
                {importSummary.partial}
              </strong>
            </div>

            <div>
              <span>Başarısız</span>
              <strong>
                {importSummary.failed}
              </strong>
            </div>
          </div>

          <br />

          <div className="import-result-table">
            <div className="import-result-row import-result-row--head">
              <span>Satır</span>
              <span>Firma</span>
              <span>Firma ID</span>
              <span>Durum</span>
              <span>Açıklama</span>
            </div>

            <div className="import-result-body">
              {importSummary.results.map(
                (
                  row: ImportRowResult,
                ) => (
                  <div
                    className="import-result-row"
                    key={row.rowNumber}
                  >
                    <span>
                      {row.rowNumber}
                    </span>
                    <span>
                      {row.companyName}
                    </span>
                    <span>
                      {row.companyCode ??
                        "—"}
                    </span>
                    <span>
                      <span
                        className={`status ${
                          ROW_STATUS_CLASS[
                            row.status
                          ]
                        }`}
                      >
                        {
                          ROW_STATUS_LABEL[
                            row.status
                          ]
                        }
                      </span>
                    </span>
                    <span>
                      {row.message}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          <br />

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              navigate("/companies")
            }
          >
            Firmalar Listesine Dön
          </button>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page">
      <Panel>
        <p className="eyebrow">Portföy İçe Aktarma</p>
        <h1>Mevcut Portföyü İçe Aktar</h1>

        <p className="muted">
          Firma Excel dosyanızı yükleyin ve birkaç dakika içinde VIAWA'da
          çalışmaya başlayın. Eksik bilgiler satış süreci sırasında tamamlanabilir.
        </p>

        <br />

        <div className="data-list">
          <div>
            <span>Desteklenen Dosya</span>
            <strong>VIAWA Excel Şablonu (.xlsx)</strong>
          </div>
          <div>
            <span>Oluşturulanlar</span>
            <strong>Firmalar, Kişiler, Sektörler, Ürün Grupları</strong>
          </div>
          <div>
            <span>Kural</span>
            <strong>Eksik veriler içe aktarmayı engellemez</strong>
          </div>
        </div>

        <br />

        <a
          className="btn btn-secondary"
          href={TEMPLATE_FILE_URL}
          download={TEMPLATE_FILE_NAME}
        >
          <Download size={16} />
          Şablonu İndir
        </a>

        <br />
        <br />

        <FilePicker
          onFileSelected={handleFileSelected}
          disabled={isImporting}
        />

        <br />
        <br />

        <Panel>
          <FileSpreadsheet size={24} />
          <h2>Önizleme</h2>

          {!fileName && (
            <p className="muted">
              Excel dosyanızı seçtikten sonra VIAWA bulduklarını gösterecek.
            </p>
          )}

          {fileName && (
            <div className="data-list">
              <div>
                <span>Seçilen Dosya</span>
                <strong>{fileName}</strong>
              </div>

              <div>
                <span>Durum</span>
                <strong>
                  {isReading
                    ? "Okunuyor..."
                    : error
                    ? error
                    : "Dosya başarıyla okundu"}
                </strong>
              </div>

              <div>
                <span>Bulunan Satır</span>
                <strong>{totalRows ?? "-"}</strong>
              </div>

              <div>
                <span>Bulunan Firma</span>
                <strong>{mappingResult?.companies.length ?? "-"}</strong>
              </div>

              <div>
                <span>Bulunan Kişi</span>
                <strong>{contactsFound}</strong>
              </div>
            </div>
          )}
        </Panel>

        <br />

        <button
          type="button"
          className="btn btn-primary"
          disabled={
            !hasValidRows || isImporting
          }
          onClick={() => {
            void handleImport();
          }}
        >
          <CircleCheck size={16} />
          {isImporting && importProgress
            ? `${importProgress.done} / ${importProgress.total} firma yükleniyor`
            : "Geçerli Kayıtları Yükle"}
        </button>

        <br />
        <br />

        {isImporting ? (
          <span
            className="btn"
            aria-disabled="true"
            style={{
              opacity: 0.5,
              pointerEvents: "none",
            }}
          >
            Firmalara Dön
          </span>
        ) : (
          <Link className="btn" to="/companies">
            Firmalara Dön
          </Link>
        )}
      </Panel>
    </main>
  );
}
