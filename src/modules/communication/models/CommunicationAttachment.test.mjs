import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { resolveOpenableAttachmentUrl } = await import(
  new URL("./CommunicationAttachment.ts", import.meta.url)
);

// BUG-S26-002.1 — pdfDataUrl (a freshly generated, not-yet-signed
// contract's own data URL) reaching fileUrl must be openable.
test("resolveOpenableAttachmentUrl: a PDF data URL (from pdfDataUrl/signedPdfDataUrl) is openable", () => {
  const url = resolveOpenableAttachmentUrl({
    fileUrl: "data:application/pdf;base64,AAAA",
    mimeType: "application/pdf",
  });

  assert.equal(url, "data:application/pdf;base64,AAAA");
});

test("resolveOpenableAttachmentUrl: an http(s) fileUrl (repository document) is openable", () => {
  const url = resolveOpenableAttachmentUrl({
    fileUrl: "https://example.com/files/brosur.pdf",
    mimeType: "application/pdf",
  });

  assert.equal(url, "https://example.com/files/brosur.pdf");
});

test("resolveOpenableAttachmentUrl: a relative fileUrl (repository document) is openable", () => {
  const url = resolveOpenableAttachmentUrl({
    fileUrl: "/api/document-basket/file?role=kroki&exhibitionName=VIAWA",
    mimeType: "application/pdf",
  });

  assert.equal(
    url,
    "/api/document-basket/file?role=kroki&exhibitionName=VIAWA",
  );
});

test("resolveOpenableAttachmentUrl: no fileUrl -> not openable", () => {
  assert.equal(
    resolveOpenableAttachmentUrl({}),
    null,
  );
});

test("resolveOpenableAttachmentUrl: an empty/whitespace fileUrl -> not openable", () => {
  assert.equal(
    resolveOpenableAttachmentUrl({ fileUrl: "   " }),
    null,
  );
});

// A data URL that identifies itself as a PDF is trusted even without an
// explicit mimeType field.
test("resolveOpenableAttachmentUrl: a data:application/pdf URL is openable even without mimeType set", () => {
  const url = resolveOpenableAttachmentUrl({
    fileUrl: "data:application/pdf;base64,AAAA",
  });

  assert.equal(url, "data:application/pdf;base64,AAAA");
});

// Guards against ever treating a non-PDF data URL (or a raw storage
// path someone mistakenly put in fileUrl) as safely openable.
test("resolveOpenableAttachmentUrl: a non-PDF data URL is rejected", () => {
  const url = resolveOpenableAttachmentUrl({
    fileUrl: "data:image/png;base64,AAAA",
    mimeType: "image/png",
  });

  assert.equal(url, null);
});

test("resolveOpenableAttachmentUrl: a raw storage path (not a URL) is rejected", () => {
  const url = resolveOpenableAttachmentUrl({
    fileUrl: "user-1/company-1/record-id/contract.pdf",
    mimeType: "application/pdf",
  });

  assert.equal(url, null);
});

test("resolveOpenableAttachmentUrl: never mutates the attachment it was given", () => {
  const attachment = {
    fileUrl: "https://example.com/a.pdf",
    mimeType: "application/pdf",
  };
  const snapshot = { ...attachment };

  resolveOpenableAttachmentUrl(attachment);

  assert.deepEqual(attachment, snapshot);
});
