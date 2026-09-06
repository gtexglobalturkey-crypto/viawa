import type { GenerationPdfArchive } from "../storage/immutableGenerationPdf.ts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateParticipationContract } from "../../../src/modules/document-engine/orchestration/generateParticipationContract.ts";
import { buildGoogleContractPlaceholderMap, validateGoogleContractPlaceholderMap } from "../../../src/modules/document-engine/google/googleContractPlaceholders.ts";
import type { ContractDocxGenerationPort, ContractGenerationDataSource } from "../../../src/modules/document-engine/orchestration/models.ts";
import type { AuthenticatedContractUser, ContractDocxEndpointDependencies } from "../../../vite-plugins/contract-docx-endpoint/models.ts";
import { createGoogleWorkspaceClient, refreshGoogleWorkspaceAccessToken, type GoogleContractArtifacts } from "./googleWorkspaceClient.ts";
import type { GeneratedDocumentPersistence, PendingGeneratedDocument } from "../../../src/modules/document-engine/repositories/generatedDocumentRepository.ts";
import type { GoogleContractPlaceholderMap } from "../../../src/modules/document-engine/google/googleContractPlaceholders.ts";

export { runPersistedGoogleGeneration } from "./portableGoogleContractGeneration.ts";
import { runPersistedGoogleGeneration } from "./portableGoogleContractGeneration.ts";

export function createRequestScopedGoogleContractGenerator(input: {
  temporaryRoot: string;
  masterTemplateId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  generatedDocumentsFolderId: string;
  createDataSource: (context: { user: AuthenticatedContractUser; accessToken: string }) => ContractGenerationDataSource;
  createPersistence: (context: { accessToken: string }) => GeneratedDocumentPersistence;
  archivePdf: (input: { accessToken: string; userId: string; companyId: string; generatedDocumentId: string; fileName: string; pdf: Buffer }) => Promise<GenerationPdfArchive>;
  now?: () => Date;
}): ContractDocxEndpointDependencies["generate"] {
  return async ({ user, accessToken, companyId, opportunityId }) => {
    const directory = await mkdtemp(path.join(input.temporaryRoot, "viawa-google-contract-"));
    const cleanup = () => rm(directory, { recursive: true, force: true });
    let artifacts: GoogleContractArtifacts | undefined;
    let handedOff = false;
    try {
      const googleToken = await refreshGoogleWorkspaceAccessToken(input);
      const google = createGoogleWorkspaceClient({
        accessToken: googleToken,
        masterTemplateId: input.masterTemplateId,
        generatedDocumentsFolderId: input.generatedDocumentsFolderId,
      });
      const persistence = input.createPersistence({ accessToken });
      const generator: ContractDocxGenerationPort = {
        async generate({ mergeResult, contractIdentity, companyId: resolvedCompanyId, opportunityId: resolvedOpportunityId, exhibitionId, generatedAt }) {
          const values = buildGoogleContractPlaceholderMap(mergeResult);
          const missing = validateGoogleContractPlaceholderMap(values);
          if (missing.length) throw new Error(`REQUIRED_GOOGLE_CONTRACT_FIELDS_MISSING:${missing.join(",")}`);
          let outputPath = "";
          const generated = await runPersistedGoogleGeneration({
            values, contractIdentity, companyId: resolvedCompanyId, opportunityId: resolvedOpportunityId,
            exhibitionId, generatedAt, masterTemplateId: input.masterTemplateId, google, persistence,
            onPdfReady: async (pdf, baseName, pending) => {
              outputPath = path.join(directory, `${baseName}.pdf`);
              await writeFile(outputPath, pdf, { flag: "wx", mode: 0o600 });
              return input.archivePdf({ accessToken, userId: user.id, companyId: resolvedCompanyId, generatedDocumentId: pending.id, fileName: `${baseName}.pdf`, pdf: Buffer.from(pdf) });
            },
          });
          artifacts = generated.artifacts;
          return { outputFileName: `${generated.baseName}.pdf`, outputPath, warnings: [] };
        },
      };
      const result = await generateParticipationContract({ companyId, opportunityId }, {
        dataSource: input.createDataSource({ user, accessToken }), docxGenerator: generator, now: input.now,
      });
      const pdfBuffer = result.success ? await import("node:fs/promises").then(({ readFile }) => readFile(result.outputPath)) : undefined;
      handedOff = true;
      return { result, docxBuffer: pdfBuffer, cleanup, artifacts };
    } finally {
      if (!handedOff) await cleanup();
    }
  };
}
