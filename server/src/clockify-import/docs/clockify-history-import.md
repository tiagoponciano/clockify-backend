# Clockify history import

How the one-shot (repeatable) import from Clockify.com into this MySQL database works today — for operators and developers running or extending the CLI.

## What this is

A Nest-backed CLI that pulls workspace users, clients, projects, tags, and detailed time entries from the Clockify API and upserts them into the local schema. It is not a continuous sync: run it when you need a backfill or catch-up. Re-runs are idempotent via `clockify_id` columns.

Invariants:

- Only users with email `@` + `ALLOWED_EMAIL_DOMAIN` (default `certi.org.br`) are imported.
- Local `acronym` is the email local-part (`tpa@certi.org.br` → `tpa`).
- Imported users get `google_sub = clockify:<clockifyUserId>` until the first Google login replaces it by email match.
- Time entries without a mapped user, or without both start and end, are skipped.

## Surface

| Item | Value |
|------|--------|
| Command | `pnpm import:clockify` (from `server/`) |
| Entry | `src/clockify-import/run-import.ts` |
| Service | `ClockifyImportService.run()` — reads config and runs the importers in order |
| Importers | `importers/`: `users`, `clients` (plus the synthetic `No Client`), `projects`, `time-entries` (windows and pages), `entry-tags` |
| Auth | None (local CLI; uses DB credentials + Clockify API key) |

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `CLOCKIFY_API_KEY` | yes | Clockify profile API key (`X-Api-Key`) |
| `CLOCKIFY_WORKSPACE_ID` | yes | Target workspace |
| `ALLOWED_EMAIL_DOMAIN` | no | Default `certi.org.br` |
| `DATABASE_*` | yes | Same as the API server |

Never commit real keys. Put them in `.env` (see `.env.example`).

## Data shapes

### User mapping

| Clockify | Local `users` |
|----------|----------------|
| `id` | `clockify_id` |
| `email` | `email` (lowercased) |
| local-part of email | `acronym` |
| `name` | `name` |
| `status === ACTIVE` | `is_active` |
| — | `google_sub` = `clockify:<id>` on create |

### Clients / projects

| Clockify | Local |
|----------|--------|
| client `id` / `name` / `archived` | `clients.clockify_id` / `name` / `is_active` |
| project `id` / `name` / `clientId` / `archived` | `projects.*`; missing client → synthetic client `No Client` (`clockify_id = __no_client__`) |

### Tags

Clockify tags are workspace-scoped; local tags are project-scoped. On each detailed entry, tags are upserted under that entry’s project with `clockify_id = <tagId>:<localProjectId>`, then linked in `time_entry_tags`.

### Time entries

| Clockify detailed report | Local `time_entries` |
|--------------------------|----------------------|
| `_id` | `clockify_id` |
| `userId` | `user_id` (via user map) |
| `projectId` | `project_id` (via project map; nullable) |
| `description` | `description` |
| `timeInterval.start` / `end` | `started_at` / `ended_at` |

Running or incomplete intervals (no end) are skipped.

## Rules and behavior

1. Load users → clients → projects → workspace tags → detailed entries.
2. Detailed entries are fetched in **31-day windows** from `2015-01-01T00:00:00.000Z` through now (Free-plan safe).
3. Each window paginates `page` / `pageSize` (200) until a short page.
4. HTTP 429 retries with backoff (up to 5 retries).
5. Upsert order per entity: find by `clockify_id`, else fall back to natural key (email / name), then save.
6. Google login (`UsersService.upsertFromGoogle`): match `google_sub`, else match `email` and replace placeholder `google_sub`, else create.

## Related API

Imported users are listed for the frontend via `GET /api/users` (active users only), which returns `id`, `email`, `acronym`, `name`, `avatarUrl`, `role`, and `isActive`.

## What this does NOT do

- Continuous / cron sync with Clockify.com
- Apps Script NEO project filters
- Spreadsheet output
- Import of users outside `ALLOWED_EMAIL_DOMAIN` (their entries are skipped)
- Creating Google OAuth credentials for users (they sign in later)

## Gotchas

- Symptom: CLI exits with missing env → set `CLOCKIFY_API_KEY` and `CLOCKIFY_WORKSPACE_ID`.
- Symptom: entries skipped for a person → their Clockify email is not `@certi.org.br` (or domain mismatch).
- Symptom: duplicate users on first Google login → ensure migration + email-link path are deployed (`upsertFromGoogle` by email).
- Symptom: Free plan rate limits → import takes longer; 31-day windows and backoff are intentional.
- Symptom: project without client in Clockify → appears under local client `No Client`.
- Re-run is safe: updates existing rows by `clockify_id`; does not delete local-only rows.

## Setup

```bash
cd server
# ensure MySQL is up and migrations applied
pnpm db:migrate
# set CLOCKIFY_* in .env
pnpm import:clockify
```
