# AI Prompting & Review Context Document — ATS Resume Tailoring Platform

> **Purpose:** This document defines how AI-generated code is prompted, reviewed, tested, and approved before it is merged into the codebase. It applies to all team members using AI assistants (Claude, Copilot, ChatGPT, Cursor, etc.). AI-generated code is treated the same as human-written code — it must be understood, tested, and owned by the engineer who merges it.

---

## 1. Core Principle

> **The engineer who merges AI-generated code is fully responsible for it.**

"The AI wrote it" is not an acceptable explanation for a bug, security issue, or standards violation. Before merging any AI-generated code, the engineer must be able to explain every line as if they wrote it themselves.

---

## 2. How to Prompt AI for This Project

### Always Provide Context First

Every AI prompt for this codebase must include the relevant context docs before making a request. Do not assume the AI knows your stack, conventions, or security rules.

**Required context to attach per task type:**

| Task Type               | Context Docs to Include                                  |
| ----------------------- | -------------------------------------------------------- |
| Any backend code        | Engineering Standards + Data & Security Guardrails       |
| Any frontend code       | Engineering Standards + UI/UX Standards                  |
| Auth / data access      | Data & Security Guardrails (mandatory)                   |
| API endpoints           | Engineering Standards (API response conventions section) |
| AI integration (OpenAI) | AI Prompting doc + Engineering Standards                 |
| New component           | UI/UX Standards + Engineering Standards                  |

### Prompt Structure

Use this structure for every code generation request:

```
[CONTEXT]
<paste relevant sections from the context docs>

[STACK]
Frontend: Next.js with TypeScript
Backend: Express.js with TypeScript
Database: PostgreSQL via Prisma ORM
Auth: JWT (Bearer token)

[TASK]
<specific, scoped description of what to build>

[CONSTRAINTS]
- Follow the naming conventions in the Engineering Standards doc
- All ownership checks must use req.user.userId (never req.body.userId)
- Use the ApiResponse<T> envelope format for all responses
- Throw typed AppError subclasses — never res.status() inline
- <any other task-specific constraints>

[OUTPUT FORMAT]
Return only the implementation. No explanations unless I ask.
```

### Scoping Rules

| Do                                                       | Don't                                               |
| -------------------------------------------------------- | --------------------------------------------------- |
| Ask for one function or one file at a time               | Ask for "build the entire resume feature"           |
| Specify the exact file being created/edited              | Let the AI decide the file structure                |
| Provide the Prisma schema when asking for DB queries     | Assume the AI knows your schema                     |
| Ask for the service layer separately from the controller | Ask for controller + service + routes in one prompt |
| Name the error classes to use                            | Let the AI invent its own error handling            |

### Example — Good Prompt

```
[CONTEXT]
Stack: Express.js + TypeScript + Prisma (PostgreSQL)
Error classes: AppError, NotFoundError, ForbiddenError, ValidationError (from src/utils/errors.ts)
All responses use: { success: boolean, data: T | null, error?: { code, message } }
Ownership rule: always verify resource.userId === req.user.userId before returning data

[TASK]
Write the Express controller function `getResume` for GET /resumes/:id.
It should:
1. Call resumeService.getResumeById(req.params.id, req.user.userId)
2. Return 200 with the resume wrapped in ApiResponse<Resume>
3. Forward any thrown errors to next(err)

[CONSTRAINTS]
- Do not write inline res.status(404) calls
- Use async/await with try/catch
- Explicit TypeScript return type: Promise<void>
```

### Example — Bad Prompt

```
Build me the resume API
```

---

## 3. Review Checklist for AI-Generated Code

Every piece of AI-generated code must pass this checklist before it is committed. The reviewing engineer completes this — not the AI.

### Standards Compliance

- [ ] Naming conventions match the Engineering Standards doc (camelCase, PascalCase, kebab-case files)
- [ ] Folder location is correct per the defined structure
- [ ] No `any` types — all variables and return types are explicitly typed
- [ ] No raw `console.log` statements
- [ ] Prettier and ESLint pass with no errors (`npm run lint`)

### Security (Backend)

- [ ] No `userId` taken from `req.body` or `req.params` for ownership decisions
- [ ] Ownership check present: `resource.userId === req.user.userId`
- [ ] Route has `authenticate` middleware applied
- [ ] Request body validated with Zod before use
- [ ] No secrets or credentials logged or hardcoded
- [ ] No `findMany()` calls without a `userId` filter on user-owned resources

### API Conventions

- [ ] Response uses `ApiResponse<T>` envelope (`{ success, data, error }`)
- [ ] Errors thrown as typed `AppError` subclasses, not inline `res.status()`
- [ ] Correct HTTP status codes used (201 for create, 422 for validation, etc.)

### Frontend

- [ ] No `localStorage` used for JWT or sensitive data
- [ ] All three states handled: loading (skeleton), error (with retry), success
- [ ] Form uses `react-hook-form` + `zod` — no uncontrolled inputs
- [ ] No raw HTML `<button>` or `<input>` — shadcn components used
- [ ] Focus rings not removed (`outline-none` without `focus-visible` is blocked)

### Logic

- [ ] The engineer can explain every line without re-reading the AI output
- [ ] Edge cases are handled (empty results, null values, failed async calls)
- [ ] No dead code, unused imports, or placeholder comments left in

---

## 4. Testing Requirements Before Merge

AI-generated code has the same testing bar as human-written code. Do not merge untested AI output.

### Minimum Testing Per Code Type

| Code Type        | Required Tests                                                       |
| ---------------- | -------------------------------------------------------------------- |
| Service function | Unit test with mocked Prisma — happy path + not found + forbidden    |
| Controller       | Integration test — correct status code + response shape              |
| Auth middleware  | Unit test — valid token, expired token, missing token                |
| Zod schema       | Unit test — valid input passes, invalid input returns correct error  |
| React component  | Renders without error; loading/error/success states render correctly |
| Custom hook      | Returns correct state on mount; handles error state                  |

### Test File Naming

```
src/services/__tests__/resume.service.test.ts
src/controllers/__tests__/resume.controller.test.ts
src/components/__tests__/JobDetailCard.test.tsx
```

### Minimum Test Structure (Backend)

```typescript
describe('resumeService.getResumeById', () => {
  it('returns the resume when it belongs to the requesting user', async () => { ... });
  it('throws NotFoundError when resume does not exist', async () => { ... });
  it('throws ForbiddenError when resume belongs to a different user', async () => { ... });
});
```

---

## 5. Approval Before Merge

### PR Requirements for AI-Generated Code

All PRs containing AI-generated code must:

1. Include `[AI]` in the PR title: `feat(resume): ATS-42 [AI] add resume upload service`
2. Include a note in the PR description: which tool was used (Claude, Copilot, etc.) and which context docs were provided
3. Pass all automated checks (ESLint, Prettier, TypeScript compile, tests)
4. Be reviewed by at least one other team member — self-merge is not allowed for AI-generated PRs

### PR Description Template for AI-Generated Code

```markdown
## What this PR does

<description>

## AI Assistance

- Tool used: Claude / Copilot / ChatGPT
- Context docs provided: Engineering Standards / UI/UX Standards / Security Guardrails
- Scope of AI generation: [entire file | specific function | boilerplate only]

## Review Checklist

- [ ] I can explain every line without referring back to the AI output
- [ ] Security checklist passed (see DATA_SECURITY_GUARDRAILS.md)
- [ ] Tests written and passing
- [ ] ESLint + Prettier clean
```

---

## 6. What AI Should and Should Not Generate

### AI is appropriate for:

- Boilerplate (controller/service/route scaffolding following established patterns)
- Zod schema definitions from a known entity shape
- Prisma query construction for standard CRUD
- TypeScript type definitions from a spec
- Test cases given a function signature
- Tailwind className composition for known components

### AI should NOT generate (human must write):

- JWT verification and auth middleware logic
- Ownership check logic — too security-critical for unreviewed AI output
- Database migration files — must be human-authored and reviewed
- `.env` configuration or any file containing secrets
- Business logic that involves billing, data deletion, or account management (not in Sprint 1, but noted for future)

---

## 7. OpenAI Integration Guidelines (Runtime AI — GPT-4)

This section covers how the app itself calls OpenAI at runtime (resume tailoring, AI analysis) — separate from AI-assisted coding.

### Prompt Construction Rules

- System prompts are stored in `src/lib/prompts/` as TypeScript string constants — never inline in service files
- User data injected into prompts must be sanitized — strip HTML, limit length
- Never inject raw user input directly into a prompt without validation

```typescript
// ✅ Correct — prompt template in dedicated file
// src/lib/prompts/tailoring.prompt.ts
export const TAILORING_SYSTEM_PROMPT = `
You are an expert resume coach. Given a resume and a job description,
rewrite the resume to highlight relevant experience without fabricating details.
Return only the rewritten resume text.
`;

// ❌ Wrong — inline prompt in service
const prompt = `Rewrite this resume: ${req.body.resume}`;
```

### OpenAI API Rules

- Always set `max_tokens` explicitly — never leave it unbounded
- Always handle OpenAI API errors — wrap calls in try/catch, throw `AIServiceError`
- Never expose the raw OpenAI error response to the client
- Log OpenAI errors server-side with the request ID, never the full prompt (may contain PII)
- Model: `gpt-4` — do not switch models without a team decision

```typescript
// ✅ Correct OpenAI call pattern
try {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    max_tokens: 1500,
    messages: [
      { role: "system", content: TAILORING_SYSTEM_PROMPT },
      { role: "user", content: sanitizedResumeAndJobText },
    ],
  });
  return response.choices[0].message.content;
} catch (err) {
  console.error("[OpenAI Error]", { requestId, error: err.message });
  throw new AIServiceError("Resume tailoring failed. Please try again.");
}
```

---

_Last updated: June 2026 · Maintained by the engineering team · Applies to all contributors including AI assistants_
