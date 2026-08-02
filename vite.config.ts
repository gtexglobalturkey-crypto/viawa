import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { contractTemplatePlugin } from "./vite-plugins/contractTemplatePlugin";
import { documentBasketPlugin } from "./vite-plugins/documentBasketPlugin";

export default defineConfig({
  plugins: [
    react(),
    documentBasketPlugin(),
    contractTemplatePlugin(),
  ],
});
