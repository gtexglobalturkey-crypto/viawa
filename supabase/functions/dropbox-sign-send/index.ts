import { resolveDropboxSignTestMode } from "./testModeResolution.ts";
import {
  buildStorageObjectUrl,
  classifyStorageDownloadFailure,
} from "./storageDownloadHelpers.ts";

// Dropbox Sign backend for VIAWA contract signature requests.
//
// Every POST request (both modes below) must carry a valid Supabase user
// access token (Authorization: Bearer <token>) — see authenticateRequest.
// SUPABASE_SERVICE_ROLE_KEY bypasses RLS, so the caller-supplied
// storagePath can never be trusted on its own; the real-send path
// additionally verifies the authenticated user.id against the path's
// first segment (and companyId/generatedDocumentId against the rest)
// before any service-role Storage call is made — see
// validateStoragePathOwnership.
//
// Two modes, selected by the request body:
//
// - checkConnection: true — makes ONE real call to Dropbox Sign's
//   account-info endpoint (GET /v3/account) purely to confirm the
//   configured API key can reach Dropbox Sign. Never calls
//   /v3/signature_request/send and never sends any document metadata or
//   file. storageBucket/storagePath are not required for this mode.
//
// - checkConnection omitted or false (default) — downloads the
//   already-uploaded contract PDF from the private contract-documents
//   Storage bucket (via the service-role key, never a signed/public
//   URL) and sends a REAL Dropbox Sign signature_request/send call.
//   storageBucket/storagePath are required for this mode.
//
// SPRINT 26.2.2 — test_mode is resolved from the DROPBOX_SIGN_TEST_MODE
// secret (see testModeResolution.ts), NEVER from the client request body
// — request.testMode is validated for shape only and intentionally never
// read for this decision, so the browser can never choose whether a
// signature is legally binding. Fail-safe: anything other than the exact
// secret value "false" stays test-mode (Dropbox Sign test-mode requests
// are not legally binding) — a missing/misconfigured secret can never
// silently send a real, binding request. The success response's
// `testMode` field lets the caller show the correct
// test-vs-production message to the user.
//
// Called from src/modules/document-engine/services/dropboxSignService.ts,
// itself called from Workspace Email's "Sözleşme Gönder" (Sprint 26.2/
// 26.2.1) — VIAWA's one official signature-request trigger. No webhook —
// the caller gets signatureRequestId/signatureRequestUrl/testMode back
// synchronously and nothing more.

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
};

// Account-info only — used solely to confirm the configured API key can
// reach Dropbox Sign (checkConnection mode).
const DROPBOX_SIGN_ACCOUNT_URL =
  "https://api.hellosign.com/v3/account";

// The real signature-request endpoint, used for the default (non
// checkConnection) mode only.
const DROPBOX_SIGN_SEND_URL =
  "https://api.hellosign.com/v3/signature_request/send";

const DROPBOX_SIGN_SEND_MESSAGE =
  "Please review and sign this contract.";

const DROPBOX_SIGN_TIMEOUT_MS = 10_000;

// Mirrors src/modules/document-engine/services/contractDocumentStorage.ts's
// CONTRACT_DOCUMENTS_BUCKET — this function runs in a separate Deno
// runtime with no access to that module, so the literal is duplicated
// here rather than shared.
const CONTRACT_DOCUMENTS_BUCKET =
  "contract-documents";

// Server-side defense in depth — the bucket's own file_size_limit (see
// supabase/migrations/20260730_create_contract_documents_bucket.sql)
// should already prevent an oversized object from existing, but this
// avoids ever handing an unexpectedly large download to Dropbox Sign.
const MAX_CONTRACT_PDF_BYTES = 10 * 1024 * 1024;

const SUPABASE_AUTH_USER_PATH =
  "/auth/v1/user";

type DropboxSignSendRequest = {
  generatedDocumentId: string;
  companyId: string;
  opportunityId: string | null;
  contractNumber: string;
  fileName: string;
  signerName: string;
  signerEmail: string;
  testMode: boolean;
  checkConnection: boolean;
  // Required only when checkConnection is false (the real-send path) —
  // see validateRequest. Absent/undefined for checkConnection requests.
  storageBucket?: string;
  storagePath?: string;
};

const REQUIRED_STRING_FIELDS = [
  "generatedDocumentId",
  "companyId",
  "contractNumber",
  "fileName",
  "signerName",
  "signerEmail",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: JSON_HEADERS,
    },
  );
}

function readTrimmedString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

type ValidationResult =
  | { request: DropboxSignSendRequest }
  | { error: string };

function validateRequest(
  body: Record<string, unknown>,
): ValidationResult {
  // Read and branch on checkConnection FIRST, before any of the
  // real-send-only fields are even looked at. Previously the
  // REQUIRED_STRING_FIELDS loop ran unconditionally at the top of this
  // function, so a bare {"checkConnection": true} body was rejected
  // with '"generatedDocumentId" is required...' before checkConnection
  // was ever read — that was the bug. checkConnection never reaches the
  // real-send path (see Deno.serve), so it must not require
  // generatedDocumentId/companyId/contractNumber/fileName/signerName/
  // signerEmail/storageBucket/storagePath at all.
  const checkConnectionRaw =
    body.checkConnection;

  if (
    checkConnectionRaw !== undefined &&
    typeof checkConnectionRaw !==
      "boolean"
  ) {
    return {
      error:
        '"checkConnection" must be a boolean.',
    };
  }

  const checkConnection =
    typeof checkConnectionRaw === "boolean"
      ? checkConnectionRaw
      : false;

  if (checkConnection) {
    return {
      request: {
        generatedDocumentId: "",
        companyId: "",
        opportunityId: null,
        contractNumber: "",
        fileName: "",
        signerName: "",
        signerEmail: "",
        testMode: true,
        checkConnection: true,
        storageBucket: undefined,
        storagePath: undefined,
      },
    };
  }

  const values: Record<string, string> =
    {};

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = readTrimmedString(
      body[field],
    );

    if (!value) {
      return {
        error: `"${field}" is required and must not be empty.`,
      };
    }

    values[field] = value;
  }

  if (
    !EMAIL_PATTERN.test(
      values.signerEmail,
    )
  ) {
    return {
      error:
        '"signerEmail" must be a valid email address.',
    };
  }

  const opportunityIdRaw =
    body.opportunityId;

  let opportunityId: string | null = null;

  if (
    opportunityIdRaw !== undefined &&
    opportunityIdRaw !== null
  ) {
    const trimmedOpportunityId =
      readTrimmedString(
        opportunityIdRaw,
      );

    if (!trimmedOpportunityId) {
      return {
        error:
          '"opportunityId" must not be an empty string.',
      };
    }

    opportunityId = trimmedOpportunityId;
  }

  const testModeRaw = body.testMode;

  if (
    testModeRaw !== undefined &&
    typeof testModeRaw !== "boolean"
  ) {
    return {
      error:
        '"testMode" must be a boolean.',
    };
  }

  // Reached only for the real-send path (checkConnection already
  // returned early above) — storageBucket/storagePath are required here.
  const storageBucketRaw =
    readTrimmedString(body.storageBucket);

  if (!storageBucketRaw) {
    return {
      error:
        '"storageBucket" is required and must not be empty.',
    };
  }

  if (
    storageBucketRaw !==
    CONTRACT_DOCUMENTS_BUCKET
  ) {
    return {
      error: `"storageBucket" must be "${CONTRACT_DOCUMENTS_BUCKET}".`,
    };
  }

  const storagePathRaw = readTrimmedString(
    body.storagePath,
  );

  if (!storagePathRaw) {
    return {
      error:
        '"storagePath" is required and must not be empty.',
    };
  }

  return {
    request: {
      generatedDocumentId:
        values.generatedDocumentId,
      companyId: values.companyId,
      opportunityId,
      contractNumber:
        values.contractNumber,
      fileName: values.fileName,
      signerName: values.signerName,
      signerEmail: values.signerEmail,
      // SPRINT 26.2.2 — never read by the real-send path; the actual
      // test_mode decision comes only from the DROPBOX_SIGN_TEST_MODE
      // secret (see resolveDropboxSignTestMode/Deno.serve below) — a
      // client-supplied value must never be able to make a signature
      // request legally binding. Kept on the type/validated for
      // request-shape compatibility only.
      testMode:
        typeof testModeRaw === "boolean"
          ? testModeRaw
          : true,
      checkConnection: false,
      storageBucket: storageBucketRaw,
      storagePath: storagePathRaw,
    },
  };
}

type AuthenticationResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

// Verifies the caller is a real, currently-valid Supabase user — never
// trusts a userId the client might put in the request body. Uses the
// incoming user access token against Supabase Auth's own /auth/v1/user
// endpoint (requires SUPABASE_URL + the project's anon key, both
// platform-injected — no new secret). Never logs the token, the
// Authorization header, or the returned user object.
async function authenticateRequest(
  req: Request,
): Promise<AuthenticationResult> {
  const authorizationHeader =
    req.headers.get("authorization");

  const bearerMatch =
    authorizationHeader?.match(
      /^Bearer\s+(.+)$/i,
    ) ?? null;

  const accessToken =
    bearerMatch?.[1]?.trim();

  if (!accessToken) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            "Authentication is required.",
        },
        401,
      ),
    };
  }

  const supabaseUrl = Deno.env
    .get("SUPABASE_URL")
    ?.trim();

  const anonKey = Deno.env
    .get("SUPABASE_ANON_KEY")
    ?.trim();

  if (!supabaseUrl || !anonKey) {
    console.error(
      "dropbox-sign-send: Supabase auth credentials are not configured.",
    );

    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            "Authentication could not be verified.",
        },
        502,
      ),
    };
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DROPBOX_SIGN_TIMEOUT_MS);

  try {
    const authResponse = await fetch(
      `${supabaseUrl}${SUPABASE_AUTH_USER_PATH}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        signal: controller.signal,
      },
    );

    if (!authResponse.ok) {
      console.error(
        "dropbox-sign-send: auth verification received a non-OK status.",
        authResponse.status,
      );

      if (authResponse.status >= 500) {
        return {
          ok: false,
          response: jsonResponse(
            {
              ok: false,
              error:
                "Authentication could not be verified.",
            },
            502,
          ),
        };
      }

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error: "Authentication failed.",
          },
          401,
        ),
      };
    }

    let userBody: unknown;

    try {
      userBody =
        await authResponse.json();
    } catch {
      console.error(
        "dropbox-sign-send: auth verification response was not valid JSON.",
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error: "Authentication failed.",
          },
          401,
        ),
      };
    }

    const userId =
      typeof userBody === "object" &&
      userBody !== null &&
      typeof (
        userBody as Record<
          string,
          unknown
        >
      ).id === "string"
        ? (
            (
              userBody as Record<
                string,
                unknown
              >
            ).id as string
          ).trim()
        : "";

    if (!userId) {
      console.error(
        "dropbox-sign-send: auth verification response missing user id.",
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error: "Authentication failed.",
          },
          401,
        ),
      };
    }

    return { ok: true, userId };
  } catch (authError) {
    if (
      authError instanceof DOMException &&
      authError.name === "AbortError"
    ) {
      console.error(
        "dropbox-sign-send: auth verification timed out.",
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error:
              "Authentication verification timed out.",
          },
          504,
        ),
      };
    }

    console.error(
      "dropbox-sign-send: auth verification network error.",
    );

    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            "Authentication could not be verified.",
        },
        502,
      ),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Dropbox Sign expects HTTP Basic auth with the API key as the
// username and an empty password.
function createDropboxSignAuthorizationHeader(
  apiKey: string,
): string {
  return `Basic ${btoa(`${apiKey}:`)}`;
}

// Calls Dropbox Sign's account-info endpoint only — never
// signature_request/send. Confirms the configured API key can reach
// Dropbox Sign; sends no document metadata. Server logs only ever carry
// a fixed label plus the Dropbox Sign HTTP status, never the response
// body, the Authorization header, or the API key.
async function verifyDropboxSignConnection(
  apiKey: string,
): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DROPBOX_SIGN_TIMEOUT_MS);

  try {
    const dropboxSignResponse =
      await fetch(
        DROPBOX_SIGN_ACCOUNT_URL,
        {
          method: "GET",
          headers: {
            Authorization:
              createDropboxSignAuthorizationHeader(
                apiKey,
              ),
          },
          signal: controller.signal,
        },
      );

    if (dropboxSignResponse.ok) {
      return jsonResponse(
        {
          ok: true,
          mode: "connection-check",
          provider: "dropbox-sign",
          connected: true,
          message:
            "Dropbox Sign API connection verified. No signature request was sent.",
        },
        200,
      );
    }

    console.error(
      "dropbox-sign-send: connection check received a non-OK status.",
      dropboxSignResponse.status,
    );

    if (
      dropboxSignResponse.status ===
        401 ||
      dropboxSignResponse.status === 403
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Dropbox Sign authentication failed.",
        },
        502,
      );
    }

    if (
      dropboxSignResponse.status === 429
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Dropbox Sign is temporarily rate limited.",
        },
        503,
      );
    }

    return jsonResponse(
      {
        ok: false,
        error:
          "Dropbox Sign connection could not be verified.",
      },
      502,
    );
  } catch (connectionError) {
    if (
      connectionError instanceof
        DOMException &&
      connectionError.name ===
        "AbortError"
    ) {
      console.error(
        "dropbox-sign-send: connection check timed out.",
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Dropbox Sign connection timed out.",
        },
        504,
      );
    }

    console.error(
      "dropbox-sign-send: connection check network error.",
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Dropbox Sign connection could not be verified.",
      },
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

type StoragePathValidationResult =
  | { ok: true; segments: string[] }
  | {
      ok: false;
      status: 403 | 422;
      error: string;
    };

// Confirms the caller-supplied storagePath actually belongs to the
// authenticated user and matches the request's own companyId/
// generatedDocumentId — required because SUPABASE_SERVICE_ROLE_KEY
// bypasses RLS, so nothing downstream can be trusted to reject a
// mismatched path on its own. The raw string is never decoded/
// renormalized — "." / ".." are rejected as literal segment values
// only, exactly as received.
function validateStoragePathOwnership(
  path: string,
  userId: string,
  companyId: string,
  generatedDocumentId: string,
): StoragePathValidationResult {
  // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC, remove after root cause is
  // confirmed. Logs the exact inputs this function was called with.
  console.error(
    "[BUG-S26.2.5] validateStoragePathOwnership CALLED",
    {
      path,
      userId,
      companyId,
      generatedDocumentId,
    },
  );

  if (path.includes("\\")) {
    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] 422 SOURCE: path.includes(\"\\\\\") check (backslash in path)",
      { path },
    );

    return {
      ok: false,
      status: 422,
      error:
        "Contract document path is invalid.",
    };
  }

  const rawSegments = path.split("/");

  if (rawSegments.length !== 4) {
    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] 422 SOURCE: rawSegments.length !== 4",
      {
        path,
        segmentCount: rawSegments.length,
        rawSegments,
      },
    );

    return {
      ok: false,
      status: 422,
      error:
        "Contract document path is invalid.",
    };
  }

  const segments = rawSegments.map(
    (segment) => segment.trim(),
  );

  // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
  console.error(
    "[BUG-S26.2.5] segments parsed",
    {
      pathUserId: segments[0],
      pathCompanyId: segments[1],
      pathGeneratedDocumentId: segments[2],
      fileName: segments[3],
    },
  );

  for (const [
    index,
    segment,
  ] of segments.entries()) {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".."
    ) {
      // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.5] 422 SOURCE: empty/\".\"/\"..\" segment",
        { index, segment, segments },
      );

      return {
        ok: false,
        status: 422,
        error:
          "Contract document path is invalid.",
      };
    }
  }

  const [
    pathUserId,
    pathCompanyId,
    pathGeneratedDocumentId,
    fileName,
  ] = segments;

  if (pathUserId !== userId) {
    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC. (This is a 403, not 422 — logged
    // for completeness of the trace since it's on the same path.)
    console.error(
      "[BUG-S26.2.5] 403 SOURCE: pathUserId !== userId",
      { pathUserId, userId },
    );

    return {
      ok: false,
      status: 403,
      error:
        "Access to the contract document was denied.",
    };
  }

  if (
    pathCompanyId !== companyId ||
    pathGeneratedDocumentId !==
      generatedDocumentId
  ) {
    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] 422 SOURCE: pathCompanyId !== companyId || pathGeneratedDocumentId !== generatedDocumentId",
      {
        pathCompanyId,
        companyId,
        companyIdMismatch:
          pathCompanyId !== companyId,
        pathGeneratedDocumentId,
        generatedDocumentId,
        generatedDocumentIdMismatch:
          pathGeneratedDocumentId !==
          generatedDocumentId,
      },
    );

    return {
      ok: false,
      status: 422,
      error:
        "Contract document path is invalid.",
    };
  }

  if (
    !fileName
      .toLowerCase()
      .endsWith(".pdf")
  ) {
    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] 422 SOURCE: fileName does not end with .pdf",
      { fileName },
    );

    return {
      ok: false,
      status: 422,
      error:
        "Contract document path is invalid.",
    };
  }

  // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
  console.error(
    "[BUG-S26.2.5] validateStoragePathOwnership PASSED",
    { segments },
  );

  return { ok: true, segments };
}

type StorageDownloadResult =
  | { ok: true; blob: Blob }
  | { ok: false; response: Response };

// Downloads via the Storage HTTP API using the service-role key (bypasses
// RLS — same privilege level the Sprint 21.6 policies deliberately don't
// add a redundant service-role policy for). Never a signed or public
// URL. No SQL, no supabase-js — one plain fetch, matching the rest of
// this function's zero-dependency style. Only ever called with segments
// that already passed validateStoragePathOwnership.
async function downloadContractDocumentFromStorage(
  bucket: string,
  segments: string[],
): Promise<StorageDownloadResult> {
  // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC: confirms the storage download
  // step actually started (i.e. validateStoragePathOwnership passed).
  console.error(
    "[BUG-S26.2.5] STORAGE DOWNLOAD STARTING",
    { bucket, segments },
  );

  const supabaseUrl = Deno.env
    .get("SUPABASE_URL")
    ?.trim();

  const serviceRoleKey = Deno.env
    .get("SUPABASE_SERVICE_ROLE_KEY")
    ?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "dropbox-sign-send: Supabase service-role credentials are not configured.",
    );

    // 501 (not 500) — a distinct, unused-elsewhere status specifically
    // for "this backend isn't configured yet", so the client can show
    // "E-imza hizmeti henüz yapılandırılmamıştır." without parsing the
    // response body (see dropboxSignService.ts's status-only mapping).
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            "Contract document storage is not configured.",
        },
        501,
      ),
    };
  }

  const objectUrl = buildStorageObjectUrl(
    supabaseUrl,
    bucket,
    segments,
  );

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DROPBOX_SIGN_TIMEOUT_MS);

  try {
    const storageResponse = await fetch(
      objectUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        signal: controller.signal,
      },
    );

    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] STORAGE FETCH RESPONDED",
      {
        objectUrl,
        status: storageResponse.status,
        ok: storageResponse.ok,
      },
    );

    if (!storageResponse.ok) {
      // BUG-S26.2.7 — TEMPORARY DIAGNOSTIC: the real response shape
      // behind "non-OK status", so a genuine 400 can be told apart from
      // Supabase Storage's wrapped "not found" (confirmed via direct API
      // testing — see report). Never logs the Authorization/apikey
      // header, the service-role key, or PDF bytes — only the response
      // metadata and JSON error body, which never carries any of those.
      let parsedBody: unknown = null;

      try {
        parsedBody =
          await storageResponse.json();
      } catch {
        // Non-JSON body — classifyStorageDownloadFailure treats a null
        // body as "no extra information", falling back to the
        // transport-level HTTP status alone.
      }

      console.error(
        "[BUG-S26.2.7] STORAGE DOWNLOAD RESPONSE",
        {
          status: storageResponse.status,
          statusText:
            storageResponse.statusText,
          contentType:
            storageResponse.headers.get(
              "content-type",
            ),
          body: parsedBody,
        },
      );

      console.error(
        "dropbox-sign-send: storage download received a non-OK status.",
        storageResponse.status,
      );

      const classification =
        classifyStorageDownloadFailure(
          storageResponse.status,
          parsedBody,
        );

      // BUG-S26.2.7 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.7] STORAGE DOWNLOAD CLASSIFIED AS",
        classification,
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error: classification.error,
          },
          classification.status,
        ),
      };
    }

    const blob = await storageResponse.blob();

    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] STORAGE BLOB READ",
      { type: blob.type, size: blob.size },
    );

    if (
      blob.type !== "application/pdf" ||
      blob.size === 0
    ) {
      // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.5] 422 SOURCE: blob.type !== \"application/pdf\" || blob.size === 0",
        { type: blob.type, size: blob.size },
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error:
              "Contract document is not a valid PDF.",
          },
          422,
        ),
      };
    }

    if (
      blob.size > MAX_CONTRACT_PDF_BYTES
    ) {
      // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.5] 422 SOURCE: blob.size > MAX_CONTRACT_PDF_BYTES",
        {
          size: blob.size,
          max: MAX_CONTRACT_PDF_BYTES,
        },
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error:
              "Contract document exceeds the maximum allowed size.",
          },
          422,
        ),
      };
    }

    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] STORAGE DOWNLOAD SUCCEEDED",
    );

    return { ok: true, blob };
  } catch (downloadError) {
    if (
      downloadError instanceof
        DOMException &&
      downloadError.name === "AbortError"
    ) {
      console.error(
        "dropbox-sign-send: storage download timed out.",
      );

      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error:
              "Contract document could not be read in time.",
          },
          504,
        ),
      };
    }

    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.5] 422 SOURCE: catch(downloadError) generic branch",
      {
        message:
          downloadError instanceof Error
            ? downloadError.message
            : String(downloadError),
      },
    );

    console.error(
      "dropbox-sign-send: storage download network error.",
    );

    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            "Contract document could not be read.",
        },
        422,
      ),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

type ExtractedSignatureRequestFields = {
  signatureRequestId: string | null;
  signatureRequestUrl: string | null;
};

function readNonEmptyStringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === "string" &&
    value.trim().length > 0
    ? value
    : null;
}

// Dropbox Sign's standard (non-embedded) signature_request/send response
// does not reliably include a caller-facing signing URL — signers are
// emailed directly by Dropbox Sign itself. Read one defensively if
// present under either shape; never fabricate one.
function extractSignatureRequestFields(
  body: unknown,
): ExtractedSignatureRequestFields {
  if (
    typeof body !== "object" ||
    body === null
  ) {
    return {
      signatureRequestId: null,
      signatureRequestUrl: null,
    };
  }

  const signatureRequest = (
    body as Record<string, unknown>
  ).signature_request;

  if (
    typeof signatureRequest !== "object" ||
    signatureRequest === null
  ) {
    return {
      signatureRequestId: null,
      signatureRequestUrl: null,
    };
  }

  const record =
    signatureRequest as Record<
      string,
      unknown
    >;

  const signatureRequestId =
    readNonEmptyStringField(
      record,
      "signature_request_id",
    );

  let signatureRequestUrl =
    readNonEmptyStringField(
      record,
      "signing_url",
    );

  if (
    !signatureRequestUrl &&
    Array.isArray(record.signatures) &&
    record.signatures.length > 0
  ) {
    const firstSignature =
      record.signatures[0];

    if (
      typeof firstSignature === "object" &&
      firstSignature !== null
    ) {
      signatureRequestUrl =
        readNonEmptyStringField(
          firstSignature as Record<
            string,
            unknown
          >,
          "signing_url",
        );
    }
  }

  return {
    signatureRequestId,
    signatureRequestUrl,
  };
}

// The real /v3/signature_request/send call — multipart/form-data.
// test_mode is decided ENTIRELY server-side by resolveDropboxSignTestMode
// (DROPBOX_SIGN_TEST_MODE secret) — request.testMode (client-supplied) is
// intentionally never read here, so the browser can never choose whether
// a signature is legally binding.
async function sendDropboxSignSignatureRequest(
  apiKey: string,
  pdfBlob: Blob,
  request: DropboxSignSendRequest,
  testMode: boolean,
): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DROPBOX_SIGN_TIMEOUT_MS);

  try {
    const formData = new FormData();

    formData.append(
      "file",
      pdfBlob,
      request.fileName,
    );
    formData.append(
      "subject",
      request.contractNumber,
    );
    formData.append(
      "message",
      DROPBOX_SIGN_SEND_MESSAGE,
    );
    formData.append(
      "test_mode",
      testMode ? "1" : "0",
    );
    formData.append(
      "signers[0][name]",
      request.signerName,
    );
    formData.append(
      "signers[0][email_address]",
      request.signerEmail,
    );

    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC: confirms sendDropboxSignSignatureRequest
    // itself started (i.e. the caller reached this point).
    console.error(
      "[BUG-S26.2.5] sendDropboxSignSignatureRequest CALLED — about to fetch DROPBOX_SIGN_SEND_URL",
      { testMode },
    );

    const dropboxSignResponse =
      await fetch(DROPBOX_SIGN_SEND_URL, {
        method: "POST",
        headers: {
          Authorization:
            createDropboxSignAuthorizationHeader(
              apiKey,
            ),
        },
        body: formData,
        signal: controller.signal,
      });

    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC: confirms the real Dropbox Sign
    // API actually responded (i.e. the network call reached
    // api.hellosign.com), and with what status.
    console.error(
      "[BUG-S26.2.5] DROPBOX SIGN API RESPONDED",
      {
        status: dropboxSignResponse.status,
        ok: dropboxSignResponse.ok,
      },
    );

    if (dropboxSignResponse.ok) {
      let parsedBody: unknown;

      try {
        parsedBody =
          await dropboxSignResponse.json();
      } catch {
        console.error(
          "dropbox-sign-send: signature request response was not valid JSON.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Dropbox Sign response could not be read.",
          },
          502,
        );
      }

      const {
        signatureRequestId,
        signatureRequestUrl,
      } =
        extractSignatureRequestFields(
          parsedBody,
        );

      if (!signatureRequestId) {
        console.error(
          "dropbox-sign-send: signature request response missing signature_request_id.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Dropbox Sign response was missing the signature request id.",
          },
          502,
        );
      }

      return jsonResponse(
        {
          ok: true,
          provider: "dropbox-sign",
          signatureRequestId,
          signatureRequestUrl,
          testMode,
        },
        200,
      );
    }

    console.error(
      "dropbox-sign-send: signature request received a non-OK status.",
      dropboxSignResponse.status,
    );

    if (
      dropboxSignResponse.status ===
        401 ||
      dropboxSignResponse.status === 403
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Dropbox Sign authentication failed.",
        },
        502,
      );
    }

    if (
      dropboxSignResponse.status === 429
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Dropbox Sign is temporarily rate limited.",
        },
        503,
      );
    }

    return jsonResponse(
      {
        ok: false,
        error:
          "Dropbox Sign signature request could not be created.",
      },
      502,
    );
  } catch (sendError) {
    if (
      sendError instanceof DOMException &&
      sendError.name === "AbortError"
    ) {
      console.error(
        "dropbox-sign-send: signature request timed out.",
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Dropbox Sign connection timed out.",
        },
        504,
      );
    }

    console.error(
      "dropbox-sign-send: signature request network error.",
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Dropbox Sign signature request could not be created.",
      },
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method not allowed.",
      },
      405,
    );
  }

  // Required for BOTH checkConnection and the real-send path — done
  // before anything else so an unauthenticated caller never reaches the
  // Dropbox Sign secret check, body parsing, or (further down) any
  // service-role Storage call.
  const authentication =
    await authenticateRequest(req);

  if (!authentication.ok) {
    return authentication.response;
  }

  const { userId } = authentication;

  // Only checked for presence — never read into a request, logged, or
  // returned to the caller. Trimmed so a whitespace-only secret counts
  // as missing too.
  const apiKey = Deno.env
    .get("DROPBOX_SIGN_API_KEY")
    ?.trim();

  if (!apiKey) {
    console.error(
      "dropbox-sign-send: DROPBOX_SIGN_API_KEY secret is not configured.",
    );

    // 501, not 500 — see the matching comment in
    // downloadContractDocumentFromStorage above.
    return jsonResponse(
      {
        ok: false,
        error:
          "Dropbox Sign backend is not configured.",
      },
      501,
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      400,
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid request body.",
      },
      400,
    );
  }

  const validation = validateRequest(
    body as Record<string, unknown>,
  );

  if ("error" in validation) {
    return jsonResponse(
      {
        ok: false,
        error: validation.error,
      },
      400,
    );
  }

  const { request } = validation;

  if (request.checkConnection) {
    return await verifyDropboxSignConnection(
      apiKey,
    );
  }

  // Guaranteed non-undefined here — validateRequest already required and
  // trimmed both when checkConnection is false — this is purely a
  // runtime type-narrowing guard for strict mode, not a reachable error
  // path in practice.
  if (
    !request.storageBucket ||
    !request.storagePath
  ) {
    console.error(
      "dropbox-sign-send: storageBucket/storagePath missing after validation.",
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Contract document storage location is missing.",
      },
      500,
    );
  }

  try {
    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC: the exact inputs about to be
    // checked against each other.
    console.error(
      "[BUG-S26.2.5] Deno.serve: about to call validateStoragePathOwnership",
      {
        "request.generatedDocumentId":
          request.generatedDocumentId,
        "request.storagePath":
          request.storagePath,
        "request.companyId":
          request.companyId,
        userId,
      },
    );

    const pathValidation =
      validateStoragePathOwnership(
        request.storagePath,
        userId,
        request.companyId,
        request.generatedDocumentId,
      );

    if (!pathValidation.ok) {
      // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.5] REQUEST CUT OFF at validateStoragePathOwnership — storage download never starts, Dropbox Sign API never called",
        {
          status: pathValidation.status,
          error: pathValidation.error,
        },
      );

      return jsonResponse(
        {
          ok: false,
          error: pathValidation.error,
        },
        pathValidation.status,
      );
    }

    const downloadResult =
      await downloadContractDocumentFromStorage(
        request.storageBucket,
        pathValidation.segments,
      );

    if (!downloadResult.ok) {
      // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.5] REQUEST CUT OFF at downloadContractDocumentFromStorage — Dropbox Sign API never called",
      );

      return downloadResult.response;
    }

    // BUG-S26.2.5 — TEMPORARY DIAGNOSTIC: confirms we reached the point
    // of actually calling the Dropbox Sign API.
    console.error(
      "[BUG-S26.2.5] DROPBOX SIGN API CALL STARTING (validateStoragePathOwnership + storage download both succeeded)",
    );

    return await sendDropboxSignSignatureRequest(
      apiKey,
      downloadResult.blob,
      request,
      resolveDropboxSignTestMode(
        Deno.env.get(
          "DROPBOX_SIGN_TEST_MODE",
        ),
      ),
    );
  } catch (unexpectedError) {
    console.error(
      "dropbox-sign-send: unexpected error.",
      unexpectedError instanceof Error
        ? unexpectedError.message
        : "unknown error",
    );

    return jsonResponse(
      {
        ok: false,
        error: "Unexpected server error.",
      },
      500,
    );
  }
});
