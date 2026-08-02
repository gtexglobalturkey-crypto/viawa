// BUG-S26.2.7 — deliberately Deno-independent (no `Deno.*` reference
// anywhere in this file) so it can be unit tested with plain `node --test`
// — mirrors testModeResolution.ts's rationale. index.ts is the only
// Deno-specific file in this function and only ever imports from these
// sibling files, never the other way around.

/**
 * Builds the Supabase Storage GET-object URL the exact same way
 * regardless of whether supabaseUrl carries a trailing slash (a
 * platform-injected SUPABASE_URL's exact format isn't something this
 * function controls). Each path segment is encoded on its own, then
 * rejoined with a literal "/" — encoding the whole path in one pass
 * would turn the "/" separators themselves into "%2F" and break the
 * object path; per-segment encoding avoids that while still safely
 * encoding any special characters within a single segment (e.g. a
 * non-ASCII file name).
 */
export function buildStorageObjectUrl(
  supabaseUrl: string,
  bucket: string,
  segments: readonly string[],
): string {
  const base = supabaseUrl.replace(
    /\/+$/,
    "",
  );

  const encodedPath = segments
    .map((segment) =>
      encodeURIComponent(segment),
    )
    .join("/");

  return `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
}

export type StorageDownloadFailureClassification =
  {
    status: 404 | 403 | 400;
    error: string;
  };

/**
 * BUG-S26.2.7 — Supabase Storage on this project returns HTTP 400 (NOT
 * 404) for "object/bucket not found": confirmed via direct API testing
 * (see BUG-S26.2.7 report) — a genuinely missing object returns
 * `{ statusCode: "404", error: "not_found", code: "NoSuchKey" }` (or
 * "NoSuchBucket") wrapped in an HTTP 400 status, not a 404. Trusting the
 * raw HTTP status alone silently misclassified every "not found" as a
 * generic, less actionable failure. This reads the JSON body's own
 * `statusCode`/`code` fields FIRST, only falling back to the
 * transport-level HTTP status when the body doesn't say otherwise (so a
 * genuinely different Storage deployment that DOES return a real 404/401/
 * 403 status is still classified correctly).
 */
export function classifyStorageDownloadFailure(
  httpStatus: number,
  body: unknown,
): StorageDownloadFailureClassification {
  const bodyRecord =
    typeof body === "object" &&
    body !== null
      ? (body as Record<string, unknown>)
      : null;

  const bodyStatusCode =
    bodyRecord?.statusCode;
  const bodyErrorCode = bodyRecord?.code;

  const isNotFound =
    httpStatus === 404 ||
    bodyStatusCode === "404" ||
    bodyErrorCode === "NoSuchKey" ||
    bodyErrorCode === "NoSuchBucket";

  if (isNotFound) {
    return {
      status: 404,
      error:
        "Contract document was not found in storage.",
    };
  }

  const isAuthError =
    httpStatus === 401 ||
    httpStatus === 403 ||
    bodyStatusCode === "401" ||
    bodyStatusCode === "403";

  if (isAuthError) {
    return {
      status: 403,
      error:
        "Contract document storage access could not be verified.",
    };
  }

  return {
    status: 400,
    error:
      "Contract document request was invalid.",
  };
}
