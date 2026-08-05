import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateParticipationContract } from "../../../src/modules/document-engine/orchestration/generateParticipationContract.ts";
import type { ContractDocxGenerationPort, ContractGenerationDataSource } from "../../../src/modules/document-engine/orchestration/models.ts";
import { mergeDocxFile } from "../../../vite-plugins/document-merge/docxMergeAdapter.ts";
import { createPdfAdapter } from "../../../vite-plugins/document-pdf/pdfAdapter.ts";
import type { DocxToPdfConverterPort } from "../../../vite-plugins/document-pdf/docxToPdfConverterPort.ts";
import type { AuthenticatedContractUser, ContractDocxEndpointDependencies } from "../../../vite-plugins/contract-docx-endpoint/models.ts";

function maskId(value: string): string {
  return value.length <= 8 ? value : `${value.slice(0, 8)}…`;
}

function logCheckpoint(stage: string, context: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", stage, ...context }));
}

export function createRequestScopedPdfGenerator(input: {
  templatePath: string;
  temporaryRoot: string;
  converter: DocxToPdfConverterPort;
  createDataSource: (context: { user: AuthenticatedContractUser; accessToken: string }) => ContractGenerationDataSource;
  now?: () => Date;
}): ContractDocxEndpointDependencies["generate"] {
  return async ({ user, accessToken, companyId, opportunityId }) => {
    const directory = await mkdtemp(path.join(input.temporaryRoot, "viawa-contract-pdf-"));
    const cleanup = () => rm(directory, { recursive: true, force: true });
    let handedOff = false;
    const ids = { companyId: maskId(companyId), opportunityId: maskId(opportunityId) };
    try {
      const docxGenerator: ContractDocxGenerationPort = {
        async generate({ mergeResult, preferredFileName }) {
          const docxPath = path.join(directory, "source.docx");
          logCheckpoint("docx_merge_started", ids);
          const merged = await mergeDocxFile({
            templatePath: input.templatePath,
            outputPath: docxPath,
            mergeResult,
            onCheckpoint: (stage) => logCheckpoint(stage, ids),
          });
          const adapter = createPdfAdapter(
            {
              generate: async () => {
                const docxBuffer = await readFile(docxPath);
                logCheckpoint("generated_docx_validated", ids);
                logCheckpoint("pdf_conversion_started", ids);
                return { docxBuffer, warnings: merged.warnings.map((message) => ({ code: "DOCX_WARNING", message })) };
              },
            },
            input.converter,
          );
          const generated = await adapter.generate(mergeResult);
          const outputFileName = preferredFileName.replace(/\.docx$/i, ".pdf");
          const outputPath = path.join(directory, outputFileName);
          await writeFile(outputPath, generated.pdfBuffer, { flag: "wx", mode: 0o600 });
          return { outputFileName, outputPath, warnings: merged.warnings };
        },
      };
      const result = await generateParticipationContract({ companyId, opportunityId }, {
        dataSource: input.createDataSource({ user, accessToken }),
        docxGenerator,
        now: input.now,
        logCheckpoint: (stage, context) => logCheckpoint(stage, { ...ids, ...context }),
      });
      const pdfBuffer = result.success ? await readFile(result.outputPath) : undefined;
      handedOff = true;
      return { result, docxBuffer: pdfBuffer, cleanup };
    } finally {
      if (!handedOff) await cleanup();
    }
  };
}
