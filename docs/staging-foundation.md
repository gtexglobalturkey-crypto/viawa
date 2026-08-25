# VIAWA staging foundation

This runbook is fail-closed. Treat the currently linked `ATLAS` project
(`qpyq...nqgb`) as the protected current environment until its production role
is confirmed by an administrator. Never run a remote migration command from a
shell that is still linked to that project.

## Required targets

- Supabase: a new project named `VIAWA Staging`, with a new project ref and no
  production data import.
- Frontend: a separate HTTPS hostname such as `viawa-staging.example.com`.
- Document Service: a separate HTTPS service such as
  `document-service-staging.example.com`, built from the same commit as the
  staging frontend.

## User-controlled bootstrap

1. Create the staging Supabase project in the approved VIAWA organization.
2. Record the staging project ref and publishable/anon key in the staging
   platform secret manager. Do not commit either environment file generated
   from the examples.
3. Install/authenticate the Supabase CLI, then prove target separation:

   ```powershell
   .\scripts\staging\assert-staging-target.ps1 `
     -ProductionProjectRef 'PRODUCTION_PROJECT_REF' `
     -StagingProjectRef 'STAGING_PROJECT_REF'
   ```

4. Use a separate working directory or explicit `--project-ref` for staging.
   Do not overwrite the protected repo's existing link until the administrator
   confirms what `ATLAS` represents.
5. Initialize the staging migration ledger exclusively from this repository:

   ```powershell
   npx supabase@latest login
   npx supabase@latest link --project-ref STAGING_PROJECT_REF
   npx supabase@latest migration list --linked
   npx supabase@latest db push --dry-run --linked
   npx supabase@latest db push --linked
   npx supabase@latest migration list --linked
   ```

   Inspect the dry-run before `db push`. Stop if it proposes destructive work,
   a history repair, or a project ref other than the masked staging ref.

## Google Workspace

Use the VIAFA Workspace identity only after its administrator approves staging
automation. The current implementation requires these minimum OAuth scopes:

- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/documents`

`drive.file` is insufficient for copying an existing master that was not
created by the staging OAuth client. Generate the refresh token through the
approved OAuth consent flow, store it only in the Document Service staging
secret manager, and grant the identity read/copy access to master document
`1Whhw7_JHhIsI0ZR-tCjEVt_Z4cHQUmFMYOAZub0CtSI`. Verify metadata/read and copy;
never issue a Docs batch update against the master ID.

## Minimal fixtures

Create three staging Auth users with non-customer addresses: active owner,
active non-owner, and inactive. Add matching `application_users` rows. Create
one synthetic company, exhibition, owned opportunity, primary contact, signing
authority, approved-price snapshot, matching five-row-or-shorter payment plan,
and the canonical `participation-contract` document settings row. Obtain the
contract number through `get_or_create_contract_number`; do not insert a client
chosen visible number. Use obviously synthetic names such as `VIAWA STAGING
TEST A.S.` and never import production rows.

## Deployment gates

The frontend must be built with `.env.staging` values and display the STAGING
banner. The Document Service must use only server-side staging secrets, allow
only the staging frontend origin, and pass `/health` and `/ready`. Before any
contract smoke, verify `generated_documents`, its RLS policies, trigger,
constraints, and indexes on staging, then execute owner/non-owner/inactive RLS
checks. Production stays blocked until every real staging smoke passes.
