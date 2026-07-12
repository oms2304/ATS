# S3-019: Performance and Accessibility Pass

Audit and fixes performed across the frontend, focused on the four pages a user
touches most in a normal session: Dashboard, Documents, Profile, and Settings.

Rules: S3-BR-019, S3-BR-020

---

## Method

- **Automated:** [jest-axe](https://github.com/nickcolley/jest-axe) (wraps the
  [axe-core](https://github.com/dequelabs/axe-core) accessibility engine) run
  against the rendered DOM of each page, in both populated and empty states.
  New test files: `*.a11y.test.tsx` alongside each page's existing test file.
- **Manual:** keyboard-only navigation pass (Tab / Shift+Tab / Enter / Space)
  on Dashboard and Documents, since axe cannot fully verify real focus order
  or interaction behavior.

## Findings and Fixes

| # | Page(s) | Issue | Fix |
|---|---------|-------|-----|
| 1 | Documents, Dashboard | Document/job card titles used `<h3>` directly under the page's `<h1>`, skipping `<h2>` (WCAG heading-order violation — screen readers rely on sequential heading levels to build a page outline) | Changed card titles to `<h2>` in `document-card.tsx` and `job-card.tsx` |
| 2 | Documents | Type, status, and sort `<select>` filters had no accessible name (icon/visual-only, no `<label>` or `aria-label`) | Added `aria-label` to each select: "Filter by document type", "Filter by document status", "Sort documents" |
| 3 | Dashboard | Stage filter and sort `<select>` dropdowns had no accessible name | Added `aria-label`: "Filter by stage", "Sort jobs" |
| 4 | Dashboard | Per-card inline stage-change `<select>` (`StageSelect`) had no accessible name | Added `aria-label="Change job stage"` |

Settings and Profile pages: no violations found by the automated pass.

## Manual Keyboard Testing

- **Dashboard job cards**: Tab reaches each card; Enter opens the job detail
  (cards are native `<a>` links, so Space intentionally does not activate them —
  this matches standard browser link behavior, not a bug).
- **Documents page** (View / Duplicate / Rename buttons): Tab reaches each
  button; both Enter and Space activate them, as expected for native `<button>`
  elements.
- Focus outlines are visible on every interactive element while tabbing.
- Tab order follows visual layout (filters → cards → in-card actions) on both
  pages.

## Test Evidence

New automated a11y test files (all passing, 0 violations after fixes):
- `DocumentsPage.a11y.test.tsx` (populated + empty state)
- `DashboardPage.a11y.test.tsx` (populated + empty state)
- `SettingsPage.a11y.test.tsx`
- `ProfilePage.a11y.test.tsx`

Full regression: 17 test suites / 101 tests passing, 0 lint errors, `tsc --noEmit` clean.

## Not Covered in This Pass

- **Job Detail page** (`/jobs/[id]`): no existing full-page test harness in the
  repo to build an automated a11y check against without significant additional
  mocking (interviews, notes, document links all render conditionally). Flagging
  as a follow-up rather than skipping silently — worth a dedicated pass if time
  allows before the demo.
- **Color contrast**: jsdom (the test environment) does not compute real
  rendered contrast ratios, so axe cannot reliably flag contrast issues in this
  setup. The dark theme's text/background pairs (`#8b949e` on `#0d1117`/`#161b22`,
  etc.) were spot-checked visually and read clearly at normal viewing distance,
  but this was not run through a dedicated contrast-ratio tool.
