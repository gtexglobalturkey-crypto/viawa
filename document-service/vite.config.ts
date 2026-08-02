import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    target: "node22",
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    ssr: "document-service/src/server.ts",
    rollupOptions: { output: { entryFileNames: "server.js" } },
  },
});
