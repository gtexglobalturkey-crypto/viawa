import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

import { contractTemplatePlugin } from "./vite-plugins/contractTemplatePlugin";
import { documentBasketPlugin } from "./vite-plugins/documentBasketPlugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (mode === "staging") {
    const productionRef = env.VITE_PRODUCTION_SUPABASE_PROJECT_REF?.trim();
    const stagingRef = env.VITE_STAGING_SUPABASE_PROJECT_REF?.trim();
    const stagingUrl = env.VITE_SUPABASE_URL?.trim();
    const documentServiceUrl = env.VITE_DOCUMENT_SERVICE_URL?.trim();
    const validRef = (value: string | undefined) => Boolean(value && /^[a-z]{20}$/.test(value));

    if (
      env.VITE_APP_ENV !== "staging" ||
      !validRef(productionRef) ||
      !validRef(stagingRef) ||
      productionRef === stagingRef ||
      stagingUrl !== `https://${stagingRef}.supabase.co` ||
      !documentServiceUrl?.startsWith("https://") ||
      /localhost|127\.0\.0\.1/i.test(documentServiceUrl)
    ) {
      throw new Error("Unsafe staging configuration: distinct project refs and HTTPS staging targets are required.");
    }
  }

  return {
    plugins: [
      react(),
      documentBasketPlugin(),
      contractTemplatePlugin(),
    ],
  };
});
