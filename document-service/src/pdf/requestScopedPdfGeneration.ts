import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateParticipationContract } from "../../../src/modules/document-engine/orchestration/generateParticipationContract.ts";
import type { ContractDocxGenerationPort, ContractGenerationDataSource } from "../../../src/modules/document-engine/orchestration/models.ts";
import { mergeDocxFile } from "../../../vite-plugins/document-merge/docxMergeAdapter.ts";
import { createPdfAdapter } from "../../../vite-plugins/document-pdf/pdfAdapter.ts";
import type { DocxToPdfConverterPort } from "../../../vite-plugins/document-pdf/docxToPdfConverterPort.ts";
import type { AuthenticatedContractUser, ContractDocxEndpointDependencies } from "../../../vite-plugins/contract-docx-endpoint/models.ts";

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
    try {
      const docxGenerator: ContractDocxGenerationPort = {
        async generate({ mergeResult, preferredFileName }) {
          const docxPath = path.join(directory, "source.docx");
          const merged = await mergeDocxFile({ templatePath: input.templatePath, outputPath: docxPath, mergeResult });
          const adapter = createPdfAdapter(
            { generate: async () => ({ docxBuffer: await readFile(docxPath), warnings: merged.warnings.map((message) => ({ code: "DOCX_WARNING", message })) }) },
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
        dataSource: input.createDataSource({ user, accessToken }), docxGenerator, now: input.now,
      });
      const pdfBuffer = result.success ? await readFile(result.outputPath) : undefined;
      handedOff = true;
      return { result, docxBuffer: pdfBuffer, cleanup };
    } finally {
      if (!handedOff) await cleanup();
    }
  };
}
