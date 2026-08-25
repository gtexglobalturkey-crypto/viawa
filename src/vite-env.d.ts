/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: "development" | "staging" | "production";
  readonly VITE_PRODUCTION_SUPABASE_PROJECT_REF?: string;
  readonly VITE_STAGING_SUPABASE_PROJECT_REF?: string;
}
