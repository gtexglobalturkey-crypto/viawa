import { checkGoogleReadiness, type GoogleReadiness } from "../google/googleReadiness.ts";
import { access, constants } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import type { DocumentServiceEnvironment } from "../config/environment.ts";

export type ReadinessCheckResult = {
  status: "ready" | "not_ready";
  businessConfiguration: "demo" | "configured" | "unknown";
  checks: {
    template: "ok" | "unavailable" | "not_required";
    google?: GoogleReadiness;
    generatedDocuments?: "ok" | "unavailable";
    database: "ok" | "unavailable";
    documentSettings: "ok" | "missing" | "incomplete" | "unavailable";
  };
};

type SettingsRow = { issuer: unknown; bank: unknown };

function jsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createReadinessChecker(
  environment: DocumentServiceEnvironment,
  dependencies: {
    checkTemplate?: () => Promise<void>;
    checkGoogle?: typeof checkGoogleReadiness;
    checkGeneratedDocuments?: () => Promise<void>;
    loadSettings?: () => Promise<SettingsRow | null>;
  } = {},
) {
  const checkTemplate = dependencies.checkTemplate
    ?? (() => access(environment.documentTemplatePath, constants.R_OK));
  const loadSettings = dependencies.loadSettings ?? (async () => {
    const client = createClient(
      environment.supabaseUrl,
      environment.supabaseServiceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await client
      .from("document_settings")
      .select("issuer,bank")
      .eq("id", "participation-contract")
      .maybeSingle();
    if (error) throw error;
    return data;
  });
  const checkGeneratedDocuments = dependencies.checkGeneratedDocuments ?? (async () => {
    const client = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.from("generated_documents")
      .select("id,contract_id,google_doc_id,google_doc_url,google_pdf_id,google_pdf_url,file_name,pdf_storage_path,pdf_sha256,pdf_size_bytes,signed_pdf_storage_path,signed_pdf_file_name,signature_completed_at")
      .limit(0);
    if (error) throw new Error("Generated document schema is unavailable.");
  });

  return async (): Promise<ReadinessCheckResult> => {
    let template: ReadinessCheckResult["checks"]["template"] = "ok";
    let database: ReadinessCheckResult["checks"]["database"] = "ok";
    let documentSettings: ReadinessCheckResult["checks"]["documentSettings"] = "ok";
    let settingsAreDemo = false;

    const googleRequired = !!environment.googleWorkspace || environment.nodeEnv === "production";
    const google = googleRequired ? await (dependencies.checkGoogle ?? checkGoogleReadiness)(environment.googleWorkspace) : undefined;
    let generatedDocuments: "ok" | "unavailable" | undefined;
    if (googleRequired) {
      try { await checkGeneratedDocuments(); generatedDocuments = "ok"; }
      catch { generatedDocuments = "unavailable"; }
    }
    if (googleRequired) template = "not_required";
    else { try { await checkTemplate(); } catch { template = "unavailable"; } }
    try {
      const settings = await loadSettings();
      if (!settings) documentSettings = "missing";
      else if (!jsonObject(settings.issuer) || !jsonObject(settings.bank)) {
        documentSettings = "incomplete";
      } else {
        settingsAreDemo = settings.issuer.status === "DEMO_CONFIGURATION"
          && settings.bank.status === "DEMO_CONFIGURATION";
      }
    } catch {
      database = "unavailable";
      documentSettings = "unavailable";
    }

    const ready = template !== "unavailable" && database === "ok" && documentSettings === "ok"
      && (!googleRequired || generatedDocuments === "ok" && !!google && Object.values(google).every((value) => value === "ok"));
    let businessConfiguration: ReadinessCheckResult["businessConfiguration"] = "unknown";
    if (documentSettings === "ok" && settingsAreDemo) businessConfiguration = "demo";
    else if (documentSettings === "ok") businessConfiguration = "configured";
    return { status: ready ? "ready" : "not_ready", businessConfiguration, checks: { template, database, documentSettings, ...(google ? { google, generatedDocuments } : {}) } };
  };
}
