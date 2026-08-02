# Security

- Bearer tokens are verified through the existing Supabase Auth adapter; service-role credentials
  never substitute for user authentication.
- Authorization retains the existing company/opportunity ownership checks and RLS-backed reads.
- Only allowlisted CORS origins receive CORS headers; production wildcard origins are rejected.
- JSON content type and a configured positive body limit are mandatory. Unsupported media returns
  `415`, oversized requests `413`, malformed JSON `400`, unsupported methods `405`, and unknown
  routes `404`.
- Responses and logs exclude tokens, keys, document contents, database errors, and local paths.
- Every response receives a correlation ID. Generated files remain request-scoped and are cleaned
  by the existing handler.
- The container runs as non-root with an ephemeral writable temp root; production should keep the
  remaining root filesystem read-only and inject secrets through the deployment platform.
