# Sprint 3 Production Demo Run-Sheet

This is the single source of truth for the live Sprint 3 demo. The demo uses
the hosted application; Docker is not required.

## Fixed demo targets

- Frontend: `https://ats-delta-ten.vercel.app`
- Backend: `https://ats-aeyy.onrender.com`
- Primary account: `alice@demo.test` / `Password123`
- Secondary account: `bob@demo.test` / `Password123`

Never paste an API key, database URL, JWT secret, service-role key, or bearer
token into this document, a terminal recording, chat, or Git commit.

## Release gate (day before)

- [ ] The intended commit is merged to `main`.
- [ ] Backend and frontend CI jobs are green on that commit.
- [ ] Render and Vercel show successful production deployments for that commit.
- [ ] `GET /healthz`, `GET /readyz`, and `GET /version` return 200.
- [ ] The database-backup workflow has one recent successful artifact.
- [ ] The production smoke test below passes with `RUN_AI_SMOKE=true`.
- [ ] The smoke test reports cleanup complete; no smoke-created rows remain.
- [ ] The temporary document `Sprint 3 Upload Verification - DELETE ME`, if it
  still exists, has been removed.

Run the automated gate from `backend/`:

```bash
DEMO_API_URL=https://ats-aeyy.onrender.com \
DEMO_FRONTEND_URL=https://ats-delta-ten.vercel.app \
DEMO_EMAIL=alice@demo.test \
DEMO_PASSWORD=Password123 \
ALLOW_PRODUCTION_SMOKE=true \
RUN_AI_SMOKE=true \
npm run smoke:demo
```

The smoke test creates one uniquely tracked job, one PDF, one duplicate,
research/prep notes, and a temporary document link. Cleanup uses only the IDs
returned during that run. It never deletes by title or prefix.

## Known dependency advisories

Safe, non-breaking audit fixes were applied on July 14, 2026. Both production
dependency audits now report zero high and zero critical findings. The
remaining moderate reports are:

- Backend: `prisma` → `@prisma/dev` → `@hono/node-server` static-file path
  handling. The deployed API is Express and does not mount Hono's static-file
  middleware. npm's proposed fix is an incompatible Prisma 7 → 6 downgrade, so
  it was not forced.
- Frontend: Next.js 16.2.7 bundles a PostCSS version covered by an advisory for
  stringifying attacker-controlled CSS containing `</style>`. This app does
  not accept or stringify user-provided CSS. npm's proposed fix is an
  incompatible downgrade to Next 9, so it was not forced.

CI prints `npm audit --omit=dev --json` for both applications without making
the known moderate-only reports a release blocker. Re-evaluate them when the
upstream packages publish compatible patched releases.

## Shared-development seed gate

The seed is for the separate shared-development Supabase project only. It must
never be run with production credentials.

1. Put verified development values in the gitignored `backend/.env.dev`:
   `DATABASE_URL` (6543), `DIRECT_URL` (5432), `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `EXPECTED_DEV_SUPABASE_PROJECT_REF`, and
   `PRODUCTION_SUPABASE_PROJECT_REF`.
2. Confirm the expected development and production project references differ.
3. Load that file explicitly; do not edit or source `backend/.env`.
4. Set `SEED_TARGET=development` and `ALLOW_DEMO_SEED=true`.
5. Run the seed twice. Both runs must print the same observed scoped counts;
   the second run must report zero legacy skills deleted.

The seed fails closed if the database pooler username, direct database host,
and Supabase URL do not all resolve to the expected development project ref.

## Pre-demo checklist (T-30 minutes)

- [ ] Plug in the laptop and disable OS/browser update prompts.
- [ ] Use a stable network; keep a phone hotspot available.
- [ ] Open the production frontend in a clean browser profile.
- [ ] Warm Render by opening `https://ats-aeyy.onrender.com/readyz`.
- [ ] Log in as Alice, then log out, proving credentials work.
- [ ] Confirm the dashboard, Documents page, and Marketing Coordinator job load.
- [ ] Generate one short AI rewrite and verify it returns before the demo.
- [ ] Confirm Alice's seeded documents, research note, and prep note are present.
- [ ] Open the latest green GitHub Actions run in another tab.
- [ ] Keep this run-sheet open locally.
- [ ] Set browser zoom to 90–100%; close unrelated tabs and notifications.

## Primary demo script (10–12 minutes)

### 1. Production readiness (45 seconds)

1. Open the production login page and sign in as Alice.
2. Show the dashboard populated with jobs across multiple stages.
3. Briefly show the latest green CI run: backend and frontend lint, build, test.
4. State that `/readyz` checks database connectivity while `/healthz` checks
   process liveness.

### 2. Job workflow and transition protection (90 seconds)

1. Open the Marketing Coordinator job.
2. Show persisted research notes and categorized interview prep notes.
3. Try a non-forward stage move. The warning must appear before state changes.
4. Cancel and show that the original stage is preserved.
5. Repeat and explicitly confirm the override; show the timeline entry.

### 3. AI drafting without data loss (2 minutes)

1. Generate a resume. While it runs, point out the busy/disabled state.
2. Edit one sentence in the draft.
3. Enter `Make the opening more concise` and click Rewrite.
4. Show Original and Rewritten side by side.
5. Choose Keep Original once, proving the rewrite cannot silently clobber the
   user's draft. Repeat if needed and choose Keep Rewrite.
6. Generate a cover letter and save both document types.

If the AI provider fails, the existing draft must remain visible. Say that the
provider is temporarily unavailable and continue with the seeded saved drafts.

### 4. Full document library (3 minutes)

1. Open Documents and show active status, type, tag, and sort controls.
2. Click **Upload document** and upload a small PDF (under 5 MB).
3. Edit its title and enter tags such as `demo, nursing, Demo`. Save and show
   that the duplicate tag was removed case-insensitively.
4. Click Download and confirm the original PDF downloads through the
   authenticated API rather than an expiring storage URL.
5. Open History and download version 1.
6. Duplicate the PDF, download the copy, and explain that it has an independent
   storage object and version ID.
7. Archive the original; switch to Archived and restore it.
8. Open a job's Linked Documents section. Link a resume, attempt to replace it,
   show the conflict confirmation, then confirm the replacement.

### 5. Metrics and close (60 seconds)

1. Return to the dashboard and show stage counts, response rate, velocity, and
   stage conversion.
2. Reload once to demonstrate persistence.
3. End on the populated dashboard, not on a dialog or loading screen.

## Negative cases to have ready

- Non-forward transition returns 422 and performs no database write:
  `backend/src/tests/stageTransition.test.ts`.
- PNG upload returns 400 while PDF/DOCX/TXT are accepted:
  `backend/src/tests/documents.test.ts`.
- A version ID from another document returns 404:
  `backend/src/tests/documents.test.ts`.
- Case-insensitive tags are trimmed/deduplicated and limits are enforced on
  both client and server.
- A stored path outside the authenticated user's folder is rejected:
  `backend/src/tests/storage.test.ts`.
- The seed refuses missing, mismatched, or production project fingerprints:
  `backend/src/tests/seed.test.ts`.

## Fallback ladder

1. **AI slow/unavailable:** use seeded saved drafts; demonstrate edit, history,
   linking, and download. Do not retry repeatedly during the timed demo.
2. **Render cold start:** open `/readyz`, wait up to 60 seconds, then refresh the
   frontend once.
3. **Network issue:** switch to the prepared hotspot and use the same URLs.
4. **Upload issue:** use a known-good PDF under 100 KB with MIME type
   `application/pdf`; continue with a seeded generated document if needed.
5. **Production outage:** show the latest automated smoke output and green CI,
   then use a local frontend/backend only if both point to the verified
   shared-development Supabase project. Never repoint local code at production
   as an improvised fallback.

## After the demo

- [ ] Delete only documents/jobs created manually during the demo.
- [ ] Do not delete the canonical seeded Alice/Bob records.
- [ ] Re-run the smoke test without AI and confirm cleanup.
- [ ] Record the demonstrated production commit SHA and CI URL.
- [ ] Rotate any credential that may have appeared on screen.

Production commit: ____________________

CI run: ______________________________
