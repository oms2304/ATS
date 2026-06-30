# Sprint 2 Demo Run-Sheet

Source of truth for the 15-minute live demo. Keep this file open in a text editor during the demo.

---

## Pre-Demo (T-30 min)

- [ ] Postgres is running (`docker compose up` or local).
- [ ] `cd backend && npx prisma migrate deploy` then `npx prisma db seed` (idempotent upserts).
- [ ] Backend: `cd backend && npm run dev` (port 4000).
- [ ] Frontend: `cd frontend && npm run dev` (port 3000).
- [ ] `frontend/.env.local` exists with `NEXT_PUBLIC_API_URL=http://localhost:4000` (gitignored, do not commit).
- [ ] `backend/.env` exists with `OPENAI_API_KEY` set and not expired.
- [ ] Open GitHub Actions in a second tab — note the URL of the latest successful CI run on `main`.

---

## Credentials

| Role        | Email               | Password      |
|-------------|---------------------|---------------|
| Primary     | `alice@demo.test`   | `Password123` |
| Secondary   | `bob@demo.test`     | `Password123` |

Alice is a Registered Nurse (non-engineering) with 4 seeded jobs spanning `Interested`, `Applied`, `Interview`, and `Offer`. Alice also has 2 pre-seeded AI drafts attached to the "Marketing Coordinator" job.

---

## Demo Script (15 minutes)

Run in this order. Each step lists the checklist ID and the visible result the grader should see.

### Readiness and seed data (C01-C04)

| ID  | Action | Visible Result |
|-----|--------|----------------|
| C01 | Be at the laptop, ready, before the timer starts. | Demo starts without delay. |
| C02 | Tab to `http://localhost:3000`. | Login screen loads cleanly. |
| C03 | Log in as `alice@demo.test`. Land on `/dashboard`. | 4 job cards visible across stages Interested / Applied / Interview / Offer. |
| C04 | Click "My Profile". | Identity section, Summary, Experience, Education, Skills, Career Preferences all visible and pre-populated. |

### Dashboard workflow and navigation (C05-C10)

| ID  | Action | Visible Result |
|-----|--------|----------------|
| C05 | Type "Marketing" in the search box. | Only the Marketing Coordinator card remains. Clear the search. |
| C06 | Use the stage filter dropdown to filter to "Applied". Use the sort dropdown to switch to "Company". | List shrinks to Applied-only and reorders alphabetically. |
| C07 | Point at the colored stage badges on each card. | Interested grey, Applied blue, Interview purple, Offer green. |
| C08 | Click any job card (except the Edit / Archive buttons). | Job Detail page opens at `/jobs/:id`. |
| C09 | Click the "Edit" button on a card or in the Overview section. | Edit modal opens with the same job fields the user just saw. Close it. |
| C10 | In the detail page, change the deadline via "Edit" in the Details section. Reload the page. | The new deadline is still there. |

### Job detail, stage, and timeline (C11-C15)

| ID  | Action | Visible Result |
|-----|--------|----------------|
| C11 | Open the Marketing Coordinator (stage `Interview`) job. Use the stage select in the header to move it to `Offer`. | Stage changes, progress bar fills to 100%, timeline adds a "Stage changed" entry. |
| C12 | **Run the new C12 demo script below.** | Warning dialog appears for non-forward moves. |
| C13 | Reload the page after the stage change. | Timeline entry persists; activity timeline shows the stage change as a blue dot. |
| C14 | In the Interviews section, click "+ Add". Fill Round Type = "Phone Screen", pick today's date, add a note "Recruiter screen". Save. | New interview card appears with a purple "Phone Screen" pill. Timeline gets a purple dot. |
| C15 | In Follow-ups, click "+ Add". Title = "Send thank-you email", Due Date = tomorrow. Save. | New follow-up appears with a checkbox. Timeline gets an orange dot. |

### Profile completion (C16-C19)

| ID  | Action | Visible Result |
|-----|--------|----------------|
| C16 | Move a job to `Rejected`, scroll to the Outcome section. Click "Add note", type "Rejected after final round, culture fit mismatch". Save. | Outcome note appears. |
| C17 | Click "My Profile". | All 6 sections visible: Identity, Summary, Experience, Education, Skills, Career Preferences. |
| C18 | In Skills, try to add a skill named "999" (or paste a clearly invalid value). | Inline red error message appears under the field. |
| C19 | In Skills, try to add a duplicate of an existing skill (e.g. "react" when "React" already exists). | Inline red error "You already have this skill" appears under the name field. |

### AI draft and job-context document (C20-C22)

| ID  | Action | Visible Result |
|-----|--------|----------------|
| C20 | Open the Marketing Coordinator job. Click "Generate Resume with AI". | A tailored resume appears in the textarea within a few seconds. |
| C21 | Click "Generate Cover Letter with AI". Then in the Rewrite input type "make it more concise" and click "Rewrite Cover Letter". | Original and rewritten appear side by side with Keep Original / Keep Rewrite buttons. |
| C22 | Click "Save Resume" and "Save Cover Letter". | "Resume saved" / "Cover letter saved" toast. The "Saved Documents" section now lists both with links to the job. |

### GitHub Actions CI and test evidence (C23-C25)

| ID  | Action | Visible Result |
|-----|--------|----------------|
| C23 | Switch to the GitHub Actions tab. Open the most recent successful run on `main`. | Run summary shows backend + frontend jobs. |
| C24 | Click into the backend job, then the test step. | Step name includes `npm run test` and shows a passing summary. |
| C25 | Walk through the three negative tests below. | Three passing tests, each negative. |

### Instructor Q&A

See "Subjective Q&A — Top Talking Points" at the bottom of this file.

---

## C12 Demo Script (the new forward-only transition)

Use the Marketing Coordinator job (currently in `Offer` after step C11) or any non-terminal job.

1. Click the stage select in the page header.
2. Try to move it to a stage that is **not** in `FORWARD_TRANSITIONS` for the current stage.
   - From `Offer`, the only forward moves are `Archived` or `Rejected`. Anything else (e.g. back to `Applied`) is non-forward.
3. The **Non-Forward Transition** warning dialog appears.
4. It states the current stage, the target stage, and lists the valid next stages in blue.
5. Click **Cancel** — nothing changes on the page. The state is preserved.
6. Click the stage select again and pick the same non-forward stage.
7. This time click **Override Anyway** — the PATCH fires with `confirmedOverride: true`. The server returns 200, the stage changes, and a `StageTransition` plus a `JobActivity` row are written.
8. Reload the page. The new stage and the timeline entry persist.
9. Land on a successful forward move (e.g. `Offer` -> `Archived`) to leave the demo on a clean state.

If asked how the rule is enforced on the backend: the `FORWARD_TRANSITIONS` table in `backend/src/controllers/jobs.controller.ts` returns HTTP 422 with `details.allowed` listing the legal next stages **unless** the request includes `confirmedOverride: true`. The dashboard dropdown's `window.confirm` path is the one that demonstrates the 422 rollback: if the user clicks Cancel on the native confirm, no PATCH is sent; if they accept, the request is sent without `confirmedOverride` (or with it false), the server returns 422, and the dashboard's `setJobs` snapshot is restored.

---

## Three Negative Tests to Show (C25)

Each is a single `it(...)` block. Open the file and point at the name and assertion. Do not run live unless asked — describe them.

1. **Backward transition returns 422**
   - File: `backend/src/tests/stageTransition.test.ts`
   - Test name: `"returns 422 on a backward (non-forward) transition (S2-BR-007 / C12)"`
   - Asserts: status 422, body has `error: "Invalid stage transition"`, `details.allowed: ["Offer", "Rejected"]`, and no `stageTransition.create` / `jobActivity.create` calls.

2. **Terminal stage cannot be changed**
   - File: `backend/src/tests/stageTransition.test.ts`
   - Test name: `"returns 422 with an empty allowed list when the current stage is terminal (Rejected)"`
   - Asserts: status 422, `details.allowed: []`, and no transition rows written.

3. **Duplicate skill blocked (case-insensitive)**
   - File: `backend/src/tests/skill.test.ts`
   - Test name: `"should return 400 with 'You already have this skill' if duplicate is case-insensitive"` (lines around 128-153).
   - Asserts: status 400, body has `fields.name: ['You already have this skill']`, and `prisma.skill.create` is not called.

(Backup option if asked for a third skill test: `"should return 400 with 'You already have this skill' if exact duplicate name exists"` in the same file at lines 106-126.)

---

## Failure Fallback (OpenAI)

If `npm run dev` works but the live OpenAI call hangs or errors:

- The pre-seeded drafts (resume + cover letter) on the Marketing Coordinator job still satisfy C20-C22.
- Switch to those and walk through the **Saved Documents** section + **Documents** page (`/documents`) to show the end-to-end linking instead.
- If the OpenAI failure happens during the demo, transparently say so and pivot; do not silently skip.

---

## GitHub Actions Link

Fill this in on demo day with the URL of the most recent green run on `main`:

- Latest CI run: ____________________________________________

The workflow lives at `.github/workflows/ci.yml` and runs `lint`, `build`, and `test` for both `backend` and `frontend`.

---

## Subjective Q&A — Top Talking Points

1. **Why does your workflow logic belong in Job Detail rather than separate screens?**
   Timeline, interviews, follow-ups, outcome notes, AI drafts, and saved documents all share `job_id` and are meant to be read in chronological context. `backend/src/controllers/timeline.controller.ts` merges them on one view (`created + jobActivity + interviews + followups`, sorted by date). Splitting across screens would force the user to mentally re-associate activity with a job each time.

2. **What is the hardest validation rule you added in Sprint 2 and why?**
   Case-insensitive duplicate-skill prevention in `backend/src/controllers/skill.controller.ts`. Two layers: a friendly controller-level `findFirst` with `mode: 'insensitive'`, plus Prisma's `@@unique([userId, name])` in `schema.prisma` as a backstop. The frontend extracts field-level errors from a thrown Error via `extractFieldErrors` in `app/(dashboard)/profile/page.tsx` because `apiFetch` throws on non-2xx.

3. **How did you keep AI output editable and still useful?**
   Every AI-generated draft lives in local state (`resumeDraft`/`coverLetterDraft` in `app/(dashboard)/jobs/[id]/page.tsx`) and is dropped into a `<textarea>`. The rewrite endpoint shows a side-by-side with **Keep Original / Keep Rewrite** so the user never silently loses their edit. Nothing persists until they explicitly click **Save Resume** / **Save Cover Letter**.

4. **What tradeoff did your team make in Sprint 2 and why?**
   The dashboard stage list omits `Archived` (`dashboard/page.tsx:21` has 5 stages), while job detail includes it (`jobs/[id]/page.tsx:51` has 6). An archived job can still be re-opened and edited from detail — it's not deleted, just hidden from the active flow. This matches the design rule "Archived is not a transition stage; it's a separate view" at `dashboard/page.tsx:20`.

5. **What changed in the forward-only stage transition rule, and why HTTP 422?**
   Before, any stage could change to any other stage — including backward jumps (e.g. `Interview` -> `Applied`) — as long as the value was a valid enum entry. We added a `FORWARD_TRANSITIONS` map that defines the legal workflow: `Interested -> Applied | Rejected -> ..., Rejected` (terminal), `Archived` (terminal). The PATCH endpoint returns `422 Unprocessable Entity` (distinct from `400` validation) with `details.allowed` so the frontend can show the legal next stages. The frontend mirrors the same map and gates the stage select with a warning dialog before sending the request — the user can still **Override Anyway** to force the change if they need to undo a misclick.

---

## Risks Worth Calling Out

1. **Stage list inconsistency.** Dashboard shows 5 stages (no Archived), Job Detail shows 6 (with Archived). Intentional — Archived is a separate view, not a transition stage. Mention this in one sentence so the grader doesn't read it as a bug.
2. **OpenAI live demo risk.** Section 4a of the implementation seeds two drafts so a live OpenAI failure during the demo does not lose C20-C22.
3. **The Override Anyway button is a deliberate-action affordance, not a hard block.** The server still accepts the override (`confirmedOverride: true`) and writes the transition. The 422 path is exercised only on the dashboard dropdown's native `window.confirm` flow, where `confirmedOverride` is not sent.