import { exec } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { Connect, Plugin } from "vite";

import { PARTICIPATION_CONTRACT_TEMPLATE_FILE_NAME } from "../src/modules/document-engine/templates/participation-contract/templateMetadata";

import { normalizeFolderName } from "./shared/normalizeFolderName";

// Mirrors vite-plugins/documentBasketPlugin.ts (folder-role matching,
// OS-default-viewer opening) but kept as an independent module — it must
// not risk breaking the existing Document Basket plugin.

const CONTRACT_TEMPLATE_FOLDER_ALIASES = [
  "sozlesme",
  "sözleşme",
];

// Test data on disk uses the Turkish folder name ("sözleşme") and an
// ".rtf" file, not the ASCII "sozlesme"/".docx" spec names. Matching is
// done by folder role (normalized), and the first real file inside is
// accepted regardless of exact name/extension, same as the document
// basket's tolerant matching.
const CONTRACT_TEMPLATE_ROOT = path.resolve(
  process.cwd(),
  "resources/templates/test-data/exhibitions/01_mining_show_2025",
);

// Falls back to this master template whenever the exhibition has no
// contract file of its own — most real exhibitions won't, so without a
// fallback the tool would report "not found" in the common case.
const MASTER_CONTRACT_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "resources/templates",
  PARTICIPATION_CONTRACT_TEMPLATE_FILE_NAME,
);


type ContractTemplateSource = "opportunity" | "fallback";

type MatchedContractTemplate = {
  fileName: string;
  absolutePath: string;
  source: ContractTemplateSource;
};

// Reserved for when a real opportunity-to-exhibition-folder link is
// wired in. Not called today: the client never sends an opportunity or
// exhibition id (fetchContractTemplateStatus/openContractTemplate take
// no arguments, and no such id is plumbed through CustomerWorkspace or
// ContractTemplateModal), so there is no real per-opportunity folder to
// resolve here — CONTRACT_TEMPLATE_ROOT only ever points at a hardcoded
// sample fixture ("01_mining_show_2025"). Matching it unconditionally
// made every opportunity falsely report a customer-specific template
// before a real fuar even existed. Left in place (unused) rather than
// deleted, and the fixture files on disk are untouched, so this can be
// reconnected once a real opportunity/exhibition id is available.
function findExhibitionContractFile(): MatchedContractTemplate | null {
  if (!existsSync(CONTRACT_TEMPLATE_ROOT)) {
    return null;
  }

  const normalizedAliases =
    CONTRACT_TEMPLATE_FOLDER_ALIASES.map(
      normalizeFolderName,
    );

  const rootEntries = readdirSync(
    CONTRACT_TEMPLATE_ROOT,
    { withFileTypes: true },
  );

  const matchedFolder = rootEntries.find(
    (entry) =>
      entry.isDirectory() &&
      normalizedAliases.includes(
        normalizeFolderName(entry.name),
      ),
  );

  if (!matchedFolder) {
    return null;
  }

  const folderPath = path.join(
    CONTRACT_TEMPLATE_ROOT,
    matchedFolder.name,
  );

  const files = readdirSync(folderPath, {
    withFileTypes: true,
  }).filter(
    (entry) =>
      entry.isFile() &&
      entry.name.toLowerCase() !== "desktop.ini" &&
      !entry.name.startsWith("."),
  );

  if (files.length === 0) {
    return null;
  }

  const fileName = files[0].name;

  return {
    fileName,
    absolutePath: path.join(folderPath, fileName),
    source: "opportunity",
  };
}

function findContractTemplateFile(): MatchedContractTemplate | null {
  // No real opportunity/exhibition link exists yet (see
  // findExhibitionContractFile's comment above) — always resolve to the
  // master template. Once a real per-opportunity folder is wired in,
  // that lookup should run first and only fall through to this when it
  // finds nothing, exactly as it did before this fix (that's still the
  // intended shape — findExhibitionContractFile is just not called yet).
  if (existsSync(MASTER_CONTRACT_TEMPLATE_PATH)) {
    return {
      fileName: path.basename(MASTER_CONTRACT_TEMPLATE_PATH),
      absolutePath: MASTER_CONTRACT_TEMPLATE_PATH,
      source: "fallback",
    };
  }

  return null;
}

function openWithDefaultViewer(
  absolutePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;

    const command =
      platform === "win32"
        ? `start "" "${absolutePath}"`
        : platform === "darwin"
          ? `open "${absolutePath}"`
          : `xdg-open "${absolutePath}"`;

    exec(
      command,
      platform === "win32"
        ? { shell: "cmd.exe" }
        : undefined,
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function registerContractTemplateMiddleware(
  middlewares: Connect.Server,
): void {
  middlewares.use(
    "/api/contract-template/status",
    (_request, response) => {
      const match = findContractTemplateFile();

      sendJson(response, 200, {
        exists: match !== null,
        fileName: match?.fileName ?? null,
        source: match?.source ?? null,
      });
    },
  );

  middlewares.use(
    "/api/contract-template/open",
    (_request, response) => {
      const match = findContractTemplateFile();

      if (!match) {
        sendJson(response, 404, {
          error: "Contract template not found.",
        });

        return;
      }

      openWithDefaultViewer(match.absolutePath)
        .then(() => {
          sendJson(response, 200, { ok: true });
        })
        .catch((error) => {
          sendJson(response, 500, {
            error:
              error instanceof Error
                ? error.message
                : "Failed to open contract template.",
          });
        });
    },
  );
}

export function contractTemplatePlugin(): Plugin {
  return {
    name: "viawa-contract-template",
    configureServer(server) {
      registerContractTemplateMiddleware(
        server.middlewares,
      );
    },
    configurePreviewServer(server) {
      registerContractTemplateMiddleware(
        server.middlewares,
      );
    },
  };
}
