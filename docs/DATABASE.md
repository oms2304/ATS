# Production Database & Migration Strategy — S3-016

**Outcome:** Production data store provisioned, with a migration strategy and a rollback plan.

This document covers how the ATS production database is provisioned, how schema changes reach production safely, and how to recover when a migration goes wrong.

---

## 1. Provisioning

The production data store is **PostgreSQL hosted on Supabase**. No separate database server is run on Render — the app connects out to Supabase.

Supabase exposes two connection strings, and this project uses **both, for different purposes**:

| Purpose | Which URI | Port | Env var | Used by |
|---|---|---|---|---|
| App runtime queries | Transaction pooler (PgBouncer) | 6543 | `DATABASE_URL` | `backend/src/lib/prisma.ts` via `@prisma/adapter-pg` |
| Migrations / schema changes | Session (direct) | 5432 | `DIRECT_URL` | `backend/prisma.config.ts` |

Why the split: the pooler (6543) is optimized for many short-lived serverless-style connections but does not support the session-level operations Prisma Migrate needs. Migrations must therefore run against the direct connection (5432). Keep `?pgbouncer=true` on the pooler URL.

Both values live in the Render service's environment (the backend reads them at boot). They must never be committed; `.env.example` documents the shape only.

---

## 2. Migration strategy

Migrations are managed by **Prisma Migrate**. Migration files live in `backend/prisma/migrations/` and are committed to git — they are the source of truth for the schema. Current history:

```
0_baseline
20260622140000_add_experience_model
20260622150000_add_skill_model
20260622191941_add_career_preferences_model
```

### Local development

Create and apply a migration while iterating:

```bash
cd backend
npx prisma migrate dev --name <short_description>
```

This diffs `schema.prisma` against the DB, writes a new timestamped migration folder, applies it locally, and regenerates the Prisma client. Commit the new migration folder with your code change.

Rules:
- One logical schema change per migration; use a clear name.
- **Never edit a migration that has already been applied to production.** Create a new migration instead.
- Never hand-edit `migration_lock.toml`.

### Production

Production must apply migrations with **`prisma migrate deploy`** — never `migrate dev` and never `db push`. `migrate deploy` only applies already-committed, pending migrations; it never generates new ones, never resets, and never drops data.

```bash
npx prisma migrate deploy   # runs against DIRECT_URL (5432)
```

**Where this runs (already configured):** the Render service's **Start Command** is `npx prisma migrate deploy && npm start`, so every deploy applies pending migrations against `DIRECT_URL` before the server starts. No manual step is needed. A failed migration aborts startup, so a broken migration keeps the bad release from serving traffic.

Note: because it lives in the Start Command, `migrate deploy` also runs on each container start (including free-tier cold-start wake-ups). That is safe — `migrate deploy` is idempotent and a no-op when nothing is pending. Render's dedicated **Pre-Deploy Command** (which would run it once per deploy instead) is a paid-tier feature and is not available on the current Free instance, so the Start Command is the correct approach here.

### Safe-change discipline (expand / contract)

To keep deploys reversible and zero-downtime, make schema changes backward-compatible in stages rather than in one breaking step:

1. **Expand** — add new columns/tables as nullable or with defaults; deploy. Old code still works.
2. **Migrate data / ship code** that writes and reads the new shape.
3. **Contract** — in a later migration, drop the old columns once nothing references them.

Avoid renaming or dropping a column in the same release that stops using it — that removes your ability to roll back the code without also touching the DB.

---

## 3. Rollback plan

Two things can go wrong independently: **a bad application release** and **a bad migration**. They roll back differently.

### 3.1 Roll back the application (schema unchanged)

If the new code is broken but the schema is fine, roll back the app only — do **not** touch the database. In Render, use **Rollback** to the previous deploy (or redeploy the previous good commit). Because migrations are additive and backward-compatible (see expand/contract), the previous app version keeps working against the newer schema.

### 3.2 Roll back a migration (schema is bad)

Prisma migrations are **forward-only** — there is no automatic "down". To reverse a schema change you write a new migration that undoes it, or apply reverse SQL and reconcile Prisma's state.

**If a migration failed midway** (Prisma marks it failed and blocks further deploys):

```bash
# After manually fixing/finishing or reverting the partial change in the DB:
npx prisma migrate resolve --rolled-back <migration_name>   # mark it as rolled back
# or, if you completed it by hand:
npx prisma migrate resolve --applied <migration_name>
```

**If a migration applied cleanly but you need to undo it**, prefer a new forward migration that reverses the change:

```bash
cd backend
npx prisma migrate dev --name revert_<original_name>   # generates the reverse, commit + deploy
```

This keeps history append-only and auditable, which is safer than deleting migration files.

### 3.3 Data rollback (the critical constraint)

**Supabase's free tier has no managed daily backups and no Point-in-Time Recovery** — both are paid-plan features (Pro = 7 days of daily backups; PITR is a paid add-on). That means there is **no automatic restore point** if a migration deletes or corrupts data.

Therefore, for any destructive or risky production migration, the plan is **manual snapshot before, restore after if needed**:

**Before running the migration**, take a dump against the direct connection:

```bash
# full logical backup (schema + data)
pg_dump "$DIRECT_URL" -Fc -f ats_backup_$(date +%Y%m%d_%H%M%S).dump
```

(Equivalently, `supabase db dump` via the Supabase CLI.) Store the dump off-site (not in the repo).

**To restore** if the migration caused data loss:

```bash
pg_restore --clean --if-exists -d "$DIRECT_URL" ats_backup_<timestamp>.dump
```

Recommended: automate a scheduled `pg_dump` (e.g. daily) so a recent snapshot always exists, and consider upgrading Supabase to Pro before the project handles real user data so PITR is available.

---

## 4. Pre-migration checklist (production)

1. Migration is committed and reviewed; PR is green in CI.
2. Change is backward-compatible (expand/contract) — or a maintenance window is agreed for a breaking change.
3. **`pg_dump` snapshot taken** and stored off-site (mandatory on free tier for destructive changes).
4. Deploy runs `prisma migrate deploy` via Render's Pre-Deploy Command.
5. Verify: app boots, key flows work (register/login, create job), no schema-drift warnings.
6. If broken: app-only issue → Render Rollback; schema issue → reverse migration and/or `pg_restore`.

---

## 5. Status of S3-016

- [x] **Production data store provisioned** — Supabase Postgres, split pooler/direct connections wired via `DATABASE_URL` / `DIRECT_URL`.
- [x] **Migrations run automatically on deploy** — Render Start Command `npx prisma migrate deploy && npm start` applies pending migrations before the server starts.
- [x] **Automated daily backup** — `.github/workflows/db-backup.yml` runs `pg_dump` daily and stores the dump as a retained GitHub Actions artifact (off-site from Supabase). **Requires** the `DIRECT_URL` repo secret to be added (see below).
- [x] **Manual pre-migration snapshot** — `backend/scripts/db-backup.sh` for taking a dump before a risky change.
- [ ] **Add the `DIRECT_URL` GitHub Actions secret** so the backup workflow can run (Omar — needs the secret value).
- [ ] Optional: upgrade Supabase to Pro (managed daily backups + PITR) before the app holds real user data.

### Enabling the automated backup

The workflow needs the Supabase **direct/session** connection string as a repository secret:

1. GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `DIRECT_URL`; Value: the Supabase session connection string (the `...pooler.supabase.com:5432` URI, same as `DIRECT_URL` in Render).
3. The workflow then runs daily and can also be triggered manually from the **Actions** tab ("DB Backup" → Run workflow). Download a dump from that run's **Artifacts**.
