import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "contract-documents";

export type StoredContractPdf = { fileName: string; pdfBuffer: Buffer; path: string };

function documentRecordId(companyId: string, opportunityId: string, snapshotId: string) {
  const hex = createHash("sha256")
    .update(`participation-contract:${companyId}:${opportunityId}:${snapshotId}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const FALLBACK_FILE_NAME = "contract.pdf";

// Also used as the Supabase Storage object key (see store() below), so this
// must be ASCII-safe, not just a display-safe name — the S3-compatible
// storage backend rejects non-ASCII keys with "400 Invalid key". Uses the
// same normalize/strip principle as asciiFileName() in
// document-service/src/pdf/contractPdfEndpoint.ts, which only sanitizes the
// HTTP Content-Disposition filename and never touches the storage key.
export function safeFileName(value: string) {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/\r\n]/g, "_")
    .trim();

  const isPdf = sanitized.toLowerCase().endsWith(".pdf");
  const hasMeaningfulBase = isPdf && sanitized.slice(0, -4).trim().length > 0;

  return hasMeaningfulBase && sanitized.length <= 120
    ? sanitized
    : FALLBACK_FILE_NAME;
}

export function createContractPdfStorage(input: { supabaseUrl: string; supabaseAnonKey: string }) {
  function client(accessToken: string) {
    return createClient(input.supabaseUrl, input.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async function prefix(accessToken: string, userId: string, companyId: string, opportunityId: string) {
    const database = client(accessToken);
    const { data, error } = await database
      .from("approved_price_snapshots")
      .select("id")
      .eq("company_id", companyId)
      .eq("opportunity_id", opportunityId)
      .order("approved_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Contract PDF version could not be resolved.");
    if (!data) return null;
    return `${userId}/${companyId}/${documentRecordId(companyId, opportunityId, data.id)}`;
  }

  async function downloadExisting(accessToken: string, folder: string): Promise<StoredContractPdf | null> {
    const storage = client(accessToken).storage.from(BUCKET);
    const { data, error } = await storage.list(folder, { limit: 2, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error("Contract PDF storage could not be read.");
    const file = data?.find((entry) => entry.name.toLowerCase().endsWith(".pdf"));
    if (!file) return null;
    const path = `${folder}/${file.name}`;
    const downloaded = await storage.download(path);
    if (downloaded.error || !downloaded.data) throw new Error("Contract PDF could not be downloaded.");
    return { fileName: file.name, pdfBuffer: Buffer.from(await downloaded.data.arrayBuffer()), path };
  }

  return {
    async find(inputValue: { accessToken: string; userId: string; companyId: string; opportunityId: string }) {
      const folder = await prefix(inputValue.accessToken, inputValue.userId, inputValue.companyId, inputValue.opportunityId);
      return folder ? downloadExisting(inputValue.accessToken, folder) : null;
    },
    async store(inputValue: { accessToken: string; userId: string; companyId: string; opportunityId: string; fileName: string; pdfBuffer: Buffer }) {
      const folder = await prefix(inputValue.accessToken, inputValue.userId, inputValue.companyId, inputValue.opportunityId);
      if (!folder) throw new Error("Contract PDF version could not be resolved.");
      const fileName = safeFileName(inputValue.fileName);
      const path = `${folder}/${fileName}`;
      const storage = client(inputValue.accessToken).storage.from(BUCKET);
      const { error } = await storage.upload(path, inputValue.pdfBuffer, { contentType: "application/pdf", upsert: false });
      if (!error) return { fileName, pdfBuffer: inputValue.pdfBuffer, path };
      const existing = await downloadExisting(inputValue.accessToken, folder).catch(() => null);
      if (existing) return existing;
      throw new Error("Contract PDF could not be stored.");
    },
  };
}
