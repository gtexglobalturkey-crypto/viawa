import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import type { DocxToPdfConverterPort } from "../../../vite-plugins/document-pdf/docxToPdfConverterPort.ts";
import { DocxToPdfConversionError } from "../../../vite-plugins/document-pdf/models.ts";

const DEFAULT_BINARY_PATH = "libreoffice";
const DEFAULT_TEMP_ROOT = "/tmp/viawa-document-service";
const DEFAULT_TIMEOUT_MS = 30_000;
const INPUT_FILE_NAME = "document.docx";
const OUTPUT_FILE_NAME = "document.pdf";

type ExecFileOptions = {
  timeout: number;
  killSignal: NodeJS.Signals;
  maxBuffer: number;
  windowsHide: boolean;
  shell: false;
};

export type LibreOfficeProcessRunner = (
  binaryPath: string,
  args: readonly string[],
  options: ExecFileOptions,
) => Promise<void>;

export type LibreOfficeConverterConfig = {
  binaryPath?: string;
  tempRoot?: string;
  defaultTimeoutMs?: number;
};

export type LibreOfficeConverterDependencies = {
  runProcess?: LibreOfficeProcessRunner;
  removeDirectory?: (directory: string) => Promise<void>;
};

const execFileAsync = promisify(execFile);

const defaultProcessRunner: LibreOfficeProcessRunner = async (
  binaryPath,
  args,
  options,
) => {
  await execFileAsync(binaryPath, [...args], options);
};

function positiveTimeout(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const processError = error as Error & {
    code?: string;
    killed?: boolean;
    signal?: string;
  };
  return processError.code === "ETIMEDOUT" || processError.killed === true;
}

export function createLibreOfficeDocxToPdfConverter(
  config: LibreOfficeConverterConfig = {},
  dependencies: LibreOfficeConverterDependencies = {},
): DocxToPdfConverterPort {
  const binaryPath = config.binaryPath?.trim() || DEFAULT_BINARY_PATH;
  const tempRoot = path.resolve(config.tempRoot?.trim() || DEFAULT_TEMP_ROOT);
  const defaultTimeoutMs = positiveTimeout(
    config.defaultTimeoutMs,
    DEFAULT_TIMEOUT_MS,
  );
  const runProcess = dependencies.runProcess ?? defaultProcessRunner;
  const removeDirectory =
    dependencies.removeDirectory ??
    ((directory: string) => rm(directory, { recursive: true, force: true }));

  return {
    async convert(docxBuffer, options) {
      await mkdir(tempRoot, { recursive: true, mode: 0o700 });
      const conversionRoot = await mkdtemp(path.join(tempRoot, "conversion-"));
      const inputDirectory = path.join(conversionRoot, "input");
      const outputDirectory = path.join(conversionRoot, "output");
      const profileDirectory = path.join(conversionRoot, "profile");
      const inputPath = path.join(inputDirectory, INPUT_FILE_NAME);
      const outputPath = path.join(outputDirectory, OUTPUT_FILE_NAME);

      try {
        await Promise.all([
          mkdir(inputDirectory, { mode: 0o700 }),
          mkdir(outputDirectory, { mode: 0o700 }),
          mkdir(profileDirectory, { mode: 0o700 }),
        ]);
        await writeFile(inputPath, docxBuffer, { flag: "wx", mode: 0o600 });

        const args = [
          "--headless",
          "--nologo",
          "--nodefault",
          "--nolockcheck",
          "--nofirststartwizard",
          `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
          "--convert-to",
          "pdf",
          "--outdir",
          outputDirectory,
          inputPath,
        ] as const;

        try {
          await runProcess(binaryPath, args, {
            timeout: positiveTimeout(options?.timeoutMs, defaultTimeoutMs),
            killSignal: "SIGKILL",
            maxBuffer: 64 * 1024,
            windowsHide: true,
            shell: false,
          });
        } catch (error) {
          // Node's execFile rejection embeds raw process stdout/stderr in
          // .message, which may echo document-derived text -- only the
          // structural, content-free fields are safe to log here.
          const processError = error as Error & { code?: string | number; killed?: boolean; signal?: string };
          console.error(JSON.stringify({
            level: "error",
            message: "LibreOffice conversion process failed.",
            errorName: processError.name,
            errorCode: processError.code,
            killed: processError.killed,
            signal: processError.signal,
          }));
          throw new DocxToPdfConversionError(
            isTimeoutError(error) ? "TIMEOUT" : "CONVERSION_FAILED",
            isTimeoutError(error)
              ? "PDF conversion timed out."
              : "DOCX to PDF conversion failed.",
          );
        }

        let outputInfo;
        try {
          outputInfo = await lstat(outputPath);
        } catch (error) {
          const fsError = error as Error & { code?: string };
          console.error(JSON.stringify({
            level: "error",
            message: "LibreOffice conversion output file is missing.",
            errorName: fsError.name,
            errorCode: fsError.code,
          }));
          throw new DocxToPdfConversionError(
            "CONVERSION_FAILED",
            "DOCX to PDF conversion failed.",
          );
        }
        if (!outputInfo.isFile() || outputInfo.isSymbolicLink()) {
          console.error(JSON.stringify({
            level: "error",
            message: "LibreOffice conversion output is not a regular file.",
            isFile: outputInfo.isFile(),
            isSymbolicLink: outputInfo.isSymbolicLink(),
          }));
          throw new DocxToPdfConversionError(
            "CONVERSION_FAILED",
            "DOCX to PDF conversion failed.",
          );
        }

        return await readFile(outputPath);
      } finally {
        try {
          await removeDirectory(conversionRoot);
        } catch {
          // A cleanup failure must not replace the conversion result or error.
        }
      }
    },
  };
}

export function createLibreOfficeConverterFromEnvironment() {
  const timeoutValue = Number(process.env.PDF_CONVERSION_TIMEOUT_MS);
  return createLibreOfficeDocxToPdfConverter({
    binaryPath: process.env.LIBREOFFICE_BINARY_PATH,
    tempRoot: process.env.DOCUMENT_TEMP_ROOT,
    defaultTimeoutMs: Number.isFinite(timeoutValue) ? timeoutValue : undefined,
  });
}
