import { readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { generateParticipationContract } from "../../src/modules/document-engine/orchestration/generateParticipationContract.ts";
import type {
  ContractDocxGenerationPort,
  ContractGenerationDataSource,
} from "../../src/modules/document-engine/orchestration/models.ts";
import { PARTICIPATION_CONTRACT_TEMPLATE_FILE_NAME } from "../../src/modules/document-engine/templates/participation-contract/templateMetadata.ts";
import { mergeDocxFile } from "../document-merge/docxMergeAdapter.ts";
import type {
  AuthenticatedContractUser,
  ContractDocxEndpointDependencies,
} from "./models";

function safeOutputName(preferredFileName: string) {
  const fileName = path.basename(preferredFileName).replace(/[\r\n]/g, "_");
  if (!fileName.toLowerCase().endsWith(".docx")) {
    throw new Error("Invalid DOCX output filename.");
  }
  return fileName;
}

export function createRequestScopedContractGenerator(input: {
  projectRoot: string;
  templatePath?: string;
  temporaryRoot?: string;
  createDataSource: (context: {
    user: AuthenticatedContractUser;
    accessToken: string;
  }) => ContractGenerationDataSource;
  now?: () => Date;
}): ContractDocxEndpointDependencies["generate"] {
  const templatePath = input.templatePath
    ? path.resolve(input.templatePath)
    : path.resolve(
        input.projectRoot,
        "resources/templates",
        PARTICIPATION_CONTRACT_TEMPLATE_FILE_NAME,
      );
  const temporaryRoot = input.temporaryRoot
    ? path.resolve(input.temporaryRoot)
    : tmpdir();

  return async ({ user, accessToken, companyId, opportunityId }) => {
    const temporaryDirectory = await mkdtemp(
      path.join(temporaryRoot, "viawa-contract-"),
    );
    let handedOffCleanup = false;

    const cleanup = () =>
      rm(temporaryDirectory, { recursive: true, force: true });

    try {
      const docxGenerator: ContractDocxGenerationPort = {
        async generate({ mergeResult, preferredFileName }) {
          const outputFileName = safeOutputName(preferredFileName);
          const outputPath = path.join(temporaryDirectory, outputFileName);
          const result = await mergeDocxFile({
            templatePath,
            outputPath,
            mergeResult,
          });
          return { outputFileName, outputPath, warnings: result.warnings };
        },
      };

      const result = await generateParticipationContract(
        { companyId, opportunityId },
        {
          dataSource: input.createDataSource({ user, accessToken }),
          docxGenerator,
          now: input.now,
        },
      );
      const docxBuffer = result.success
        ? await readFile(result.outputPath)
        : undefined;

      handedOffCleanup = true;
      return { result, docxBuffer, cleanup };
    } finally {
      if (!handedOffCleanup) {
        await cleanup();
      }
    }
  };
}
