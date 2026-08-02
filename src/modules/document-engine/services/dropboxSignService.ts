import { supabase } from "../../../services/supabase/client";
import { extractGeneratedDocumentStorageIdentity } from "../engine/contractPdfStorageIdentity";
import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";
import {
  getSendForSignatureErrorMessage,
  parseSendForSignatureResponse,
} from "./dropboxSignResponseParsing";

// Real dropbox-sign-send Edge Function (Sprint 21.8/21.8.1) — no PDF,
// Dropbox Sign API key, or Basic Authorization header ever touches the
// browser. The function reads the PDF from private Storage itself using
// the storageBucket/storagePath already recorded on this document.
const DROPBOX_SIGN_SEND_FUNCTION =
  "dropbox-sign-send";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignatureRequestSigner = {
  name: string;
  email: string;
};

// Thrown when there is no authenticated Supabase session — lets the
// caller show the dedicated "session missing" message without ever
// attempting the Edge Function call.
export class MissingAuthSessionError extends Error {
  constructor() {
    super(
      "No authenticated Supabase session.",
    );

    this.name =
      "MissingAuthSessionError";
  }
}

export async function sendForSignature(
  document: GeneratedDocumentRecord,
  signer: SignatureRequestSigner,
): Promise<GeneratedDocumentRecord> {
  if (document.status === "signed") {
    throw new Error(
      "Document is already signed.",
    );
  }

  // No more "already sent, return an idempotent copy" leniency (that
  // was fine for the Sprint 21.2 stub, but calling the real Dropbox
  // Sign API a second time for the same document would create a
  // duplicate, real signature request).
  if (
    document.status ===
      "sent-for-signature" ||
    document.signatureRequestId
  ) {
    throw new Error(
      "Document has already been sent for signature.",
    );
  }

  if (
    document.storageBucket !==
      "contract-documents" ||
    !document.storagePath?.trim() ||
    document.storageMimeType !==
      "application/pdf" ||
    !document.storageSize ||
    document.storageSize <= 0
  ) {
    throw new Error(
      "Bu sözleşmenin güvenli PDF kaydı bulunamadı.",
    );
  }

  // BUG-S26.2.4 — the Edge Function's ownership check compares its
  // `generatedDocumentId` argument against storagePath's own 3rd
  // segment (the deterministic documentRecordId Document Service
  // actually stored under) — document.id is a separate, random
  // client-side identifier (createDocumentId() in
  // ContractPreviewModal.tsx) that was never that value, so sending it
  // made every real request fail with 422 "Contract document path is
  // invalid." before Dropbox Sign was ever called. Extracted, never
  // guessed/reconstructed — see extractGeneratedDocumentStorageIdentity.
  const storageIdentity =
    extractGeneratedDocumentStorageIdentity(
      document.storagePath,
    );

  if (!storageIdentity) {
    throw new Error(
      "Bu sözleşmenin güvenli PDF kaydı bulunamadı.",
    );
  }

  const signerName = signer.name.trim();
  const signerEmail =
    signer.email.trim();

  if (
    !signerName ||
    !EMAIL_PATTERN.test(signerEmail)
  ) {
    throw new Error(
      "Firma için geçerli bir imza yetkilisi (ad ve e-posta) bulunamadı.",
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new MissingAuthSessionError();
  }

  const { data, error } =
    await supabase.functions.invoke<unknown>(
      DROPBOX_SIGN_SEND_FUNCTION,
      {
        body: {
          // BUG-S26.2.4 — the real storage identity (storagePath's own
          // 3rd segment), NOT document.id. document.id stays a plain
          // React/list-state key for GeneratedDocumentRecord — it was
          // never, and still isn't, a storage ownership identifier.
          generatedDocumentId:
            storageIdentity,
          companyId: document.companyId,
          contractNumber:
            document.contractNumber,
          fileName: document.fileName,
          signerName,
          signerEmail,
          storageBucket:
            document.storageBucket,
          storagePath:
            document.storagePath,
        },
        headers: {
          // Explicit rather than relying on the client's automatic
          // session forwarding — this is the one piece this sprint
          // cannot verify against a live project, so it's made
          // unambiguous instead of assumed.
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

  if (error) {
    throw new Error(
      getSendForSignatureErrorMessage(
        error,
      ),
    );
  }

  const parsed =
    parseSendForSignatureResponse(data);

  if (!parsed) {
    throw new Error(
      "İmza isteği gönderilemedi.",
    );
  }

  return {
    ...document,
    status: "sent-for-signature",
    signatureProvider: "dropbox-sign",
    signatureRequestId:
      parsed.signatureRequestId,
    signatureRequestUrl:
      parsed.signatureRequestUrl?.trim() ||
      undefined,
    signatureSentAt:
      new Date().toISOString(),
    signatureTestMode: parsed.testMode,
  };
}

export async function getSignatureStatus(
  _document: GeneratedDocumentRecord,
): Promise<GeneratedDocumentRecord> {
  void _document;

  throw new Error("Not implemented.");
}

export async function downloadSignedPdf(
  _document: GeneratedDocumentRecord,
): Promise<GeneratedDocumentRecord> {
  void _document;

  throw new Error("Not implemented.");
}

export async function cancelSignatureRequest(
  _document: GeneratedDocumentRecord,
): Promise<void> {
  void _document;

  throw new Error("Not implemented.");
}
