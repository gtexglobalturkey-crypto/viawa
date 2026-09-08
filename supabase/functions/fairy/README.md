# Fairy V0

Local implementation of VIAWA's read-only operational assistant. The authenticated
`/fairy` page calls `fairyService.ts`, which invokes this Edge Function. It returns
`{ "answer": "..." }`; failures return a fixed `{ "error": "...", "code": "..." }`.

The function follows `organizer-report` authorization: verify the caller token
with `auth.getUser`, then require that caller's `application_users.is_active` is
literally `true`. A service-role client retrieves shared operational records only
after authorization. It does not read owner/admin-only tables or perform writes.

`_shared/fairyContext.ts` reads explicit columns from companies, exhibitions,
opportunities, reminders, timeline events and stored emails. Current activity and
bounded name lookups supply related records. Table limits, missing links and
incomplete coverage accompany the snapshot; absence is not a claim of no work.
Email excerpts omit markup, quoted history and credential-like text. No OAuth
tables, recipients, tokens, credentials, storage contents or arbitrary metadata
enter the model context. Existing `ai_memory`, AIContextCard and workflow code
remain in place and are not invoked by Fairy.

The server uses direct HTTPS to the [Responses API](https://developers.openai.com/api/docs/guides/text)
with [`gpt-5.6-terra`](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
medium reasoning, at most 6,000 output/reasoning tokens, `store: false`, a 45-second
provider timeout and no tools. Server instructions remain separate from untrusted
records and history. Output is extracted from assistant text/refusal content in
the Responses `output` array, never from reasoning. Partial responses are errors.

Limits: a 2,000-character question, four completed prior turns (eight messages,
16,000 characters total), 6,000 characters per assistant message, 128 KiB request
body and 30,000 characters of operational context. The browser keeps a bounded
conversation in memory; it is not persisted. Errors and logs do not expose raw
provider/database diagnostics or server credentials.

## Verification

Run the focused offline tests with Node 24 or a compatible Node version:

```powershell
node --test supabase/functions/_shared/fairy.test.mjs supabase/functions/_shared/fairyContext.test.mjs supabase/functions/_shared/fairyHandler.test.mjs src/modules/fairy/fairyConversation.test.mjs src/services/supabase/fairyService.test.mjs
npm run build
git diff --check
```

The app build covers `src` only. Also check the Edge Function with the staging
Deno toolchain before deployment; mocked tests do not verify remote imports or
staging schema availability.

## Before a staging smoke test

Deployment and secret configuration require a separate authorized step. Use an
isolated staging Supabase project with the existing VIAWA schema, an active test
member and representative operational records. The function needs server-side
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`; the OpenAI project
must have access to `gpt-5.6-terra`. Never put the OpenAI key in Vite variables.
Point the staging frontend's existing public Supabase configuration at that
project. No migration or new package is required for Fairy.

Verify a valid member, invalid/expired JWT, inactive membership, a general daily
question, a named company/exhibition, insufficient context, an old reminder linked
to a closed opportunity, provider failure, loading and draft preservation. Compare
records before and after; Fairy must not mutate anything or claim to send/create
anything. No live Supabase/OpenAI smoke test is part of the local implementation.
