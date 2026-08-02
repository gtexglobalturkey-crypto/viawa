import { exec } from "node:child_process";
import {
  createReadStream,
  existsSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

import type { Connect, Plugin } from "vite";

import { normalizeFolderName } from "./shared/normalizeFolderName";
import { resolveExhibitionRoot as resolveExhibitionRootShared } from "./shared/resolveExhibitionRoot";

export type DocumentBasketRole =
  | "flyer"
  | "brosur"
  | "fiyat_listesi"
  | "fuar_takvimi"
  | "kroki"
  | "sozlesme";

type DocumentBasketDefinition = {
  id: DocumentBasketRole;
  title: string;
  folderAliases: string[];
};

// Test data on disk uses Turkish/spaced folder names (e.g. "broşür",
// "fiyat listesi") instead of the ASCII/underscore spec names, and the
// file inside each folder isn't reliably named after its role (one
// exhibition's "fiyat listesi" folder contains "Kroki.pdf"). Matching is
// therefore done by folder role, not by exact file name.
const DOCUMENT_BASKET_DEFINITIONS: DocumentBasketDefinition[] = [
  { id: "flyer", title: "Flyer", folderAliases: ["flyer"] },
  {
    id: "brosur",
    title: "Broşür",
    folderAliases: ["brosur", "broşür"],
  },
  {
    id: "fiyat_listesi",
    title: "Fiyat Listesi",
    folderAliases: [
      "fiyat_listesi",
      "fiyat listesi",
      "fiyat-listesi",
      "price-list",
      "price list",
    ],
  },
  {
    id: "fuar_takvimi",
    title: "Fuar Takvimi",
    folderAliases: [
      "fuar_takvimi",
      "fuar takvimi",
      "takvim",
      "exhibition-calendar",
      "exhibition calendar",
    ],
  },
  {
    id: "kroki",
    title: "Kroki",
    folderAliases: [
      "kroki",
      "floor-plan",
      "floor plan",
      "hall-plan",
      "hall plan",
    ],
  },
  {
    id: "sozlesme",
    title: "Sözleşme",
    folderAliases: [
      "sozlesme",
      "sözleşme",
      "contract",
    ],
  },
];

// Thin local wrapper: this plugin only ever needs the resolved absolute
// path, never the matched folder name (unlike the pricing config
// endpoint, which reports it back to the client).
function resolveExhibitionRoot(
  exhibitionName: string | null,
  exhibitionShortName: string | null,
): string | null {
  return (
    resolveExhibitionRootShared(
      exhibitionName,
      exhibitionShortName,
    )?.absolutePath ?? null
  );
}

type MatchedDocument = {
  fileName: string;
  absolutePath: string;
};

function findDocumentFile(
  root: string | null,
  definition: DocumentBasketDefinition,
): MatchedDocument | null {
  if (!root || !existsSync(root)) {
    return null;
  }

  const normalizedAliases = definition.folderAliases.map(
    normalizeFolderName,
  );

  const rootEntries = readdirSync(root, {
    withFileTypes: true,
  });

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
    root,
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
  };
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

// Only these render reliably inside a browser <iframe>/<img> — anything
// else (e.g. the test data's .rtf contract) is still resolvable/openable
// but the client shows a graceful "preview not supported" state instead
// of attempting to embed it. No new PDF/office viewer is introduced.
const PREVIEWABLE_MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function registerDocumentBasketMiddleware(
  middlewares: Connect.Server,
): void {
  middlewares.use(
    "/api/document-basket/status",
    (request, response) => {
      const url = new URL(
        request.url ?? "",
        "http://localhost",
      );

      const exhibitionName = url.searchParams.get(
        "exhibitionName",
      );

      const exhibitionShortName =
        url.searchParams.get(
          "exhibitionShortName",
        );

      const root = resolveExhibitionRoot(
        exhibitionName,
        exhibitionShortName,
      );

      const items = DOCUMENT_BASKET_DEFINITIONS.map(
        (definition) => {
          const match = findDocumentFile(
            root,
            definition,
          );

          return {
            id: definition.id,
            title: definition.title,
            exists: match !== null,
            fileName: match?.fileName ?? null,
          };
        },
      );

      sendJson(response, 200, { items });
    },
  );

  middlewares.use(
    "/api/document-basket/open",
    (request, response) => {
      const url = new URL(
        request.url ?? "",
        "http://localhost",
      );

      const role = url.searchParams.get(
        "role",
      ) as DocumentBasketRole | null;

      const exhibitionName = url.searchParams.get(
        "exhibitionName",
      );

      const exhibitionShortName =
        url.searchParams.get(
          "exhibitionShortName",
        );

      const definition =
        DOCUMENT_BASKET_DEFINITIONS.find(
          (item) => item.id === role,
        );

      if (!definition) {
        sendJson(response, 400, {
          error: "Unknown document role.",
        });

        return;
      }

      const root = resolveExhibitionRoot(
        exhibitionName,
        exhibitionShortName,
      );

      const match = findDocumentFile(
        root,
        definition,
      );

      if (!match) {
        sendJson(response, 404, {
          error: "Document not found.",
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
                : "Failed to open document.",
          });
        });
    },
  );

  // Streams the resolved file's bytes with a real Content-Type so
  // Exhibition Workspace can preview it inline (<iframe> for PDF, <img>
  // for images) instead of only being able to open it externally.
  middlewares.use(
    "/api/document-basket/file",
    (request, response) => {
      const url = new URL(
        request.url ?? "",
        "http://localhost",
      );

      const role = url.searchParams.get(
        "role",
      ) as DocumentBasketRole | null;

      const exhibitionName = url.searchParams.get(
        "exhibitionName",
      );

      const exhibitionShortName =
        url.searchParams.get(
          "exhibitionShortName",
        );

      const definition =
        DOCUMENT_BASKET_DEFINITIONS.find(
          (item) => item.id === role,
        );

      if (!definition) {
        sendJson(response, 400, {
          error: "Unknown document role.",
        });

        return;
      }

      const root = resolveExhibitionRoot(
        exhibitionName,
        exhibitionShortName,
      );

      const match = findDocumentFile(
        root,
        definition,
      );

      if (!match) {
        sendJson(response, 404, {
          error: "Document not found.",
        });

        return;
      }

      const extension = path
        .extname(match.fileName)
        .toLowerCase();

      const mimeType =
        PREVIEWABLE_MIME_TYPES[extension] ??
        "application/octet-stream";

      response.statusCode = 200;
      response.setHeader(
        "Content-Type",
        mimeType,
      );

      createReadStream(
        match.absolutePath,
      ).pipe(response);
    },
  );
}

export function documentBasketPlugin(): Plugin {
  return {
    name: "viawa-document-basket",
    configureServer(server) {
      registerDocumentBasketMiddleware(
        server.middlewares,
      );
    },
    configurePreviewServer(server) {
      registerDocumentBasketMiddleware(
        server.middlewares,
      );
    },
  };
}
