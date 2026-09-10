import { build } from "vite";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Bundle the existing business modules, excluding native/Node adapters. Supabase
// CLI --use-api deploys this directory without requiring a local Docker daemon.
const root = path.resolve(".tmp/contract-edge");
const outDir = path.join(root, "supabase/functions/contract-generate");
await build({ configFile: false, publicDir: false, build: {
  target: "es2022", outDir, emptyOutDir: true, minify: false,
  lib: { entry: "supabase/functions/contract-generate/index.ts", formats: ["es"], fileName: () => "index.js" },
  rollupOptions: { external: ["@supabase/supabase-js"], output: { paths: { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.110.2" } } },
} });
const source = await readFile(path.join(outDir, "index.js"), "utf8");
if (/from\s+["']node:|child_process|libreoffice|mkdtemp/i.test(source)) throw new Error("Native dependency in Edge bundle");
await mkdir(path.join(root, "supabase"), { recursive: true });
await writeFile(path.join(root, "supabase/config.toml"), '[functions.contract-generate]\nverify_jwt = true\nentrypoint = "./functions/contract-generate/index.js"\n');
console.log(`Portable Edge bundle: ${Buffer.byteLength(source)} bytes; ${root}`);
