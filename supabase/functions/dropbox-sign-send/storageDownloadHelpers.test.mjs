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

const {
  buildStorageObjectUrl,
  classifyStorageDownloadFailure,
} = await import(
  new URL("./storageDownloadHelpers.ts", import.meta.url)
);

// BUG-S26.2.7 — Test: geçerli bucket/path -> doğru URL.
test("buildStorageObjectUrl: joins segments with real slashes, not %2F", () => {
  const url = buildStorageObjectUrl(
    "https://project.supabase.co",
    "contract-documents",
    ["user-1", "company-1", "hash-1", "contract.pdf"],
  );

  assert.equal(
    url,
    "https://project.supabase.co/storage/v1/object/contract-documents/user-1/company-1/hash-1/contract.pdf",
  );
  assert.doesNotMatch(url, /%2F/i);
});

test("buildStorageObjectUrl: a trailing slash on supabaseUrl never produces a double slash", () => {
  const url = buildStorageObjectUrl(
    "https://project.supabase.co/",
    "contract-documents",
    ["user-1", "company-1", "hash-1", "contract.pdf"],
  );

  assert.equal(
    url,
    "https://project.supabase.co/storage/v1/object/contract-documents/user-1/company-1/hash-1/contract.pdf",
  );
  assert.doesNotMatch(url, /\.co\/\/storage/);
});

// BUG-S26.2.7 — Test: özel karakterli PDF dosya adı doğru encode edilir.
test("buildStorageObjectUrl: special characters within a single segment are safely encoded, slashes still literal", () => {
  const url = buildStorageObjectUrl(
    "https://project.supabase.co",
    "contract-documents",
    [
      "user-1",
      "company-1",
      "hash-1",
      "Katılım Sözleşmesi (v2).pdf",
    ],
  );

  assert.equal(
    url,
    "https://project.supabase.co/storage/v1/object/contract-documents/user-1/company-1/hash-1/" +
      encodeURIComponent(
        "Katılım Sözleşmesi (v2).pdf",
      ),
  );
  // Exactly 4 real path separators after the bucket segment — special
  // characters within a segment are encoded, but slashes between
  // segments are never turned into "%2F".
  const afterBucket = url.split(
    "/contract-documents/",
  )[1];
  assert.equal(
    afterBucket.split("/").length,
    4,
  );
});

// BUG-S26.2.7 — Test: 404 doğru sınıflandırılır (Supabase Storage'ın
// gerçek HTTP 400 + body statusCode:"404" davranışı, canlı API testiyle
// doğrulandı — bkz. rapor).
test("classifyStorageDownloadFailure: HTTP 400 with a NoSuchKey body is classified as 404 (real Supabase Storage behavior)", () => {
  const result = classifyStorageDownloadFailure(
    400,
    {
      statusCode: "404",
      error: "not_found",
      message: "Object not found",
      code: "NoSuchKey",
    },
  );

  assert.equal(result.status, 404);
});

test("classifyStorageDownloadFailure: HTTP 400 with a NoSuchBucket body is also classified as 404", () => {
  const result = classifyStorageDownloadFailure(
    400,
    {
      statusCode: "404",
      error: "Bucket not found",
      message: "Bucket not found",
      code: "NoSuchBucket",
    },
  );

  assert.equal(result.status, 404);
});

test("classifyStorageDownloadFailure: a real transport-level 404 (no body) is still classified as 404", () => {
  const result = classifyStorageDownloadFailure(
    404,
    null,
  );

  assert.equal(result.status, 404);
});

// BUG-S26.2.7 — Test: 401/403 doğru sınıflandırılır.
test("classifyStorageDownloadFailure: HTTP 401 is classified as 403 (storage access)", () => {
  const result = classifyStorageDownloadFailure(
    401,
    null,
  );

  assert.equal(result.status, 403);
});

test("classifyStorageDownloadFailure: HTTP 403 is classified as 403", () => {
  const result = classifyStorageDownloadFailure(
    403,
    null,
  );

  assert.equal(result.status, 403);
});

test("classifyStorageDownloadFailure: a body-only statusCode of \"403\" (wrapped in a different transport status) is classified as 403", () => {
  const result = classifyStorageDownloadFailure(
    400,
    { statusCode: "403", error: "Forbidden" },
  );

  assert.equal(result.status, 403);
});

// BUG-S26.2.7 — Test: 400 (gerçekten malformed) doğru sınıflandırılır.
test("classifyStorageDownloadFailure: an unrecognized failure falls back to 400, never silently to 404/403", () => {
  const result = classifyStorageDownloadFailure(
    500,
    { statusCode: "500", error: "Internal error" },
  );

  assert.equal(result.status, 400);
});

test("classifyStorageDownloadFailure: no body at all falls back to 400 for a non-404/401/403 transport status", () => {
  const result = classifyStorageDownloadFailure(
    418,
    null,
  );

  assert.equal(result.status, 400);
});

test("classifyStorageDownloadFailure: never returns the raw provider error/message in its own error field", () => {
  const result = classifyStorageDownloadFailure(
    400,
    {
      statusCode: "404",
      error: "not_found",
      message: "some raw internal Supabase Storage detail",
      code: "NoSuchKey",
    },
  );

  assert.doesNotMatch(
    result.error,
    /raw internal/,
  );
});
