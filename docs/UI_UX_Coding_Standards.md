# UI/UX Standards Context Document — ATS Resume Tailoring Platform

> **Purpose:** This document defines the UI/UX rules for the ATS project. It applies to all human engineers and AI coding assistants. Every screen, component, and interaction must follow these conventions. When in doubt, consistency beats creativity.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui

---

## 1. Navigation Model

### Structure

The app uses a **persistent side navigation shell** (`AppShell`) for all authenticated routes. Unauthenticated routes use a centered `AuthLayout` with no nav.

```
Authenticated:                    Unauthenticated:
┌─────────┬──────────────────┐    ┌──────────────────────┐
│         │                  │    │                      │
│  Side   │   Page Content   │    │   Centered Card      │
│   Nav   │                  │    │   Login / Register   │
│         │                  │    │                      │
└─────────┴──────────────────┘    └──────────────────────┘
```

### Side Nav Items (in order)

| Label        | Route           | Icon            |
| ------------ | --------------- | --------------- |
| Dashboard    | `/dashboard`    | LayoutDashboard |
| Applications | `/applications` | FileText        |
| Jobs         | `/jobs`         | Briefcase       |
| Profile      | `/profile`      | User            |
| Settings     | `/settings`     | Settings        |

### Navigation Rules

- Active route is highlighted with a left border accent + background tint — never bold alone
- Nav items never open in a new tab
- Mobile: side nav collapses to a bottom tab bar (max 5 items)
- No nested/dropdown nav items in Sprint 1
- Breadcrumbs are shown on detail pages only (e.g. Jobs → Job Detail)

---

## 2. Dashboard Interaction Model

### Layout

The Dashboard is the landing page after login. It uses a **card grid** layout.

```
┌─────────────────────────────────────────────┐
│  Dashboard                    [+ Add Job]   │
├─────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Job Card │ │ Job Card │ │ Job Card │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐                 │
│  │ Job Card │ │ Job Card │                 │
│  └──────────┘ └──────────┘                 │
└─────────────────────────────────────────────┘
```

### Job Card Anatomy

Each card shows: company name, position title, application status badge, date applied, and a "View" CTA. No truncation on position title — wrap to 2 lines max.

### Dashboard Interactions

| Action            | Behavior                                            |
| ----------------- | --------------------------------------------------- |
| Click job card    | Navigate to `/jobs/[id]`                            |
| Click "+ Add Job" | Open slide-over panel (not a new page)              |
| Filter by status  | Inline pill filters above the grid — no page reload |
| Empty state       | Illustrated empty state with CTA to add first job   |
| Loading state     | Skeleton cards — same dimensions as real cards      |

### Status Badge Colors

| Status      | Color  |
| ----------- | ------ |
| `PENDING`   | Gray   |
| `IN_REVIEW` | Blue   |
| `INTERVIEW` | Purple |
| `ACCEPTED`  | Green  |
| `REJECTED`  | Red    |

---

## 3. Component Usage Rules

### Component Library

Use **shadcn/ui** as the base. Never write raw HTML form elements — always use the shadcn equivalent. Do not install additional UI libraries (no MUI, no Chakra, no Ant Design).

### Component Hierarchy

```
src/components/
├── ui/          ← shadcn primitives only — never modified directly
├── forms/       ← composed form components built on top of ui/
└── layout/      ← page-level layout wrappers
```

### Rules

- `ui/` components are **never modified** — override via Tailwind `className` props only
- All forms use `react-hook-form` + `zod` for validation — no uncontrolled inputs
- Every interactive element must have a visible focus ring (do not use `outline-none` without `focus-visible` replacement)
- Never use `<div>` as a button — use `<button>` or shadcn `Button`
- Icons come from `lucide-react` only — no other icon libraries

### Button Variants

| Variant            | Use case                       |
| ------------------ | ------------------------------ |
| `default` (filled) | Primary CTA — one per view max |
| `outline`          | Secondary action               |
| `ghost`            | Tertiary / nav actions         |
| `destructive`      | Delete / irreversible actions  |

### Forms

- All form fields have a visible label — no placeholder-only fields
- Error messages appear below the field in red, never as toasts
- Submit buttons show a loading spinner while the request is in flight
- Disable the submit button during submission to prevent double-posting

### Modals & Panels

- Use shadcn `Dialog` for confirmations and short forms
- Use a slide-over panel (`Sheet`) for longer forms (e.g. Add Job, Edit Resume)
- Always include a close button (X) in the top-right
- Clicking the backdrop closes the modal/panel (unless there are unsaved changes)
- Unsaved changes: show a "Discard changes?" confirmation before closing

---

## 4. Spacing & Typography Conventions

### Spacing Scale

Use Tailwind's default spacing scale. Do not use arbitrary values (`p-[13px]`) unless absolutely necessary. Prefer multiples of 4.

| Token      | Value | Use                               |
| ---------- | ----- | --------------------------------- |
| `space-1`  | 4px   | Icon gaps, tight inline spacing   |
| `space-2`  | 8px   | Between label and input           |
| `space-4`  | 16px  | Between form fields, card padding |
| `space-6`  | 24px  | Between sections within a page    |
| `space-8`  | 32px  | Between major layout blocks       |
| `space-12` | 48px  | Page-level top padding            |

### Typography Scale

| Element               | Tailwind Class | Weight                     |
| --------------------- | -------------- | -------------------------- |
| Page title (h1)       | `text-2xl`     | `font-semibold`            |
| Section heading (h2)  | `text-xl`      | `font-semibold`            |
| Card title (h3)       | `text-base`    | `font-medium`              |
| Body text             | `text-sm`      | `font-normal`              |
| Helper / caption text | `text-xs`      | `font-normal`              |
| Error text            | `text-xs`      | `font-normal text-red-500` |

### Typography Rules

- Never use `font-bold` on body text — use `font-medium` or `font-semibold`
- Never set raw pixel font sizes — always use Tailwind text scale
- Line height: default Tailwind (`leading-normal`) for body; `leading-tight` for headings
- No centered body text — only center headings and empty states

---

## 5. Consistency Rules

### Color Usage

- Use Tailwind semantic color tokens, not raw hex values in className
- Primary brand actions: `bg-primary` / `text-primary` (mapped in `tailwind.config`)
- Destructive: `bg-destructive` / `text-destructive`
- Muted text: `text-muted-foreground`
- Card backgrounds: `bg-card`
- Never hardcode `#hex` in JSX — define in `tailwind.config.ts` if a custom color is needed

### Loading States

Every data-fetching component must handle three states — always:

```tsx
// Required pattern for every data-fetching component
if (isLoading) return <SkeletonCard />; // not a spinner alone
if (isError) return <ErrorMessage />; // with retry option
return <ActualContent />;
```

### Empty States

Every list or collection view must have an empty state with:

- A short descriptive message ("No applications yet")
- A primary CTA to add the first item
- No raw "No data found" strings

### Toast Notifications

Use shadcn `Sonner` (toast) for:

- Successful mutations ("Resume uploaded successfully")
- Non-blocking errors ("Failed to save — please try again")

Do NOT use toasts for:

- Form field validation errors (show inline)
- Loading states
- Destructive confirmations (use a dialog)

### Responsive Behavior

| Breakpoint    | Layout change                           |
| ------------- | --------------------------------------- |
| `sm` (640px)  | Single column card grid                 |
| `md` (768px)  | Two column card grid                    |
| `lg` (1024px) | Side nav visible; three column grid     |
| `xl` (1280px) | Max content width capped at `max-w-6xl` |

All pages must be usable at 375px width (iPhone SE). Test at mobile before marking a story done.

### Accessibility (A11y) Minimums

- All images have `alt` text
- All icon-only buttons have `aria-label`
- Color is never the only differentiator (status badges also use text)
- Tab order follows visual reading order
- No content hidden with `visibility: hidden` that should be accessible

---

_Last updated: June 2026 · Maintained by the engineering team · Applies to all contributors including AI assistants_
