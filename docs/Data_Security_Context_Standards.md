# Data & Security Guardrails Context Document — ATS Resume Tailoring Platform

> **Purpose:** This document defines per-user data ownership rules, authorization patterns, and prohibited access behaviors for the ATS project. Every backend route, service function, and database query must comply with these guardrails. These rules apply to human engineers and AI coding assistants equally — no exceptions.

**Stack:** Express.js · TypeScript · PostgreSQL · Prisma ORM · JWT (Auth)

---

## 1. Core Security Principle

> **Every user can only access their own data. Always. No exceptions.**

There is no admin role in Sprint 1. There is no shared data between users. Every database query that returns user-owned data **must** filter by the authenticated `userId` extracted from the JWT — not from the request body, not from a URL param alone, and never trusted from the client.

---

## 2. Per-User Data Ownership

### Ownership Table

| Resource      | Owner Field         | Owned By                            |
| ------------- | ------------------- | ----------------------------------- |
| `Resume`      | `userId`            | The user who uploaded it            |
| `Application` | `userId`            | The user who created it             |
| `AI_Analysis` | via `Resume.userId` | The user who owns the linked resume |
| `Job`         | `userId`            | The user who added it               |

### Rules

- A user may only **read, update, or delete** resources where `resource.userId === req.user.userId`
- A user may never read another user's resume, application, job, or AI analysis — even if they somehow know the ID
- `userId` is **never** taken from `req.body` or `req.params` for ownership checks — always use `req.user.userId` (decoded from JWT by auth middleware)

```typescript
// ✅ Correct — ownership check uses JWT-decoded userId
const resume = await prisma.resume.findUnique({
  where: { resumeId: req.params.id },
});
if (!resume) throw new NotFoundError("Resume");
if (resume.userId !== req.user.userId) throw new ForbiddenError();

// ❌ Wrong — trusting userId from the request body
const resume = await prisma.resume.findFirst({
  where: { resumeId: req.body.resumeId, userId: req.body.userId }, // Never trust client-supplied userId
});
```

---

## 3. Authorization Checks

### Auth Middleware

Every protected route must go through `auth.middleware.ts` before hitting the controller. This middleware verifies the JWT and attaches the decoded user to `req.user`.

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../utils/errors";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedError();

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    req.user = { userId: decoded.userId };
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
```

### TypeScript Augmentation

```typescript
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user: { userId: string };
    }
  }
}
```

### Route-Level Authorization Pattern

Every protected route follows this exact order:

1. `authenticate` middleware — verifies JWT, attaches `req.user`
2. `validate` middleware — validates request body schema (Zod)
3. Controller — calls service
4. Service — performs ownership check before any DB operation

```typescript
// ✅ Correct route setup
router.get(
  "/resumes/:id",
  authenticate,
  validate(GetResumeSchema),
  resumeController.getResume,
);

// ❌ Wrong — no auth middleware
router.get("/resumes/:id", resumeController.getResume);
```

### Service-Level Ownership Check Pattern

Ownership must be verified in the **service layer**, not just the route. This ensures the check runs even if a service function is called from another service.

```typescript
// ✅ Correct — ownership check in service before returning data
async function getResumeById(
  resumeId: string,
  requestingUserId: string,
): Promise<Resume> {
  const resume = await prisma.resume.findUnique({ where: { resumeId } });
  if (!resume) throw new NotFoundError("Resume");
  if (resume.userId !== requestingUserId) throw new ForbiddenError();
  return resume;
}

// ✅ Correct — filter by userId in query (for list endpoints)
async function getUserResumes(userId: string): Promise<Resume[]> {
  return prisma.resume.findMany({ where: { userId } }); // userId comes from req.user, not client
}
```

---

## 4. Protected Route Behavior

### Which Routes Are Protected

| Route pattern          | Protected?       |
| ---------------------- | ---------------- |
| `POST /users/register` | No               |
| `POST /users/login`    | No               |
| All other routes       | **Yes — always** |

### JWT Behavior

- Tokens expire after **7 days**
- Expired token → `401 Unauthorized` with code `TOKEN_EXPIRED`
- Malformed token → `401 Unauthorized` with code `UNAUTHORIZED`
- Missing `Authorization` header → `401 Unauthorized`
- Frontend must redirect to `/login` on any `401` response — no retry

### Password Storage

- Passwords are **never stored in plaintext**
- Hash with `bcrypt`, minimum 12 salt rounds
- Never log passwords, tokens, or any credential — not even in error messages

```typescript
// ✅ Correct
const hashed = await bcrypt.hash(password, 12);

// ❌ Wrong
console.log("User password:", password);
const hashed = await bcrypt.hash(password, 8); // Too few rounds
```

### Environment Variables

- `JWT_SECRET` must be at least 32 characters, randomly generated
- Never use a hardcoded fallback: `process.env.JWT_SECRET || 'secret'` — this is forbidden
- If `JWT_SECRET` is missing at startup, the app must throw and refuse to start

```typescript
// src/app.ts — startup guard
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set.");
}
```

---

## 5. Prohibited Cross-User Access Patterns

The following patterns are **never permitted** under any circumstances:

### Prohibited Query Patterns

```typescript
// ❌ PROHIBITED — fetching a resource by ID alone with no ownership check
const resume = await prisma.resume.findUnique({ where: { resumeId } });
return resume; // Could be any user's resume

// ❌ PROHIBITED — using userId from req.params or req.body for ownership
const resume = await prisma.resume.findFirst({
  where: { resumeId, userId: req.params.userId },
});

// ❌ PROHIBITED — returning all records without a userId filter
const allResumes = await prisma.resume.findMany(); // Exposes all users' data

// ❌ PROHIBITED — using raw SQL that bypasses Prisma's typed queries
await prisma.$queryRaw`SELECT * FROM resumes WHERE resume_id = ${id}`; // No ownership check
```

### Prohibited Frontend Patterns

```typescript
// ❌ PROHIBITED — storing JWT in localStorage (XSS vulnerable)
localStorage.setItem("token", jwt);

// ✅ Correct — store JWT in memory (React state / context) or httpOnly cookie
// Use httpOnly cookies set by the server, or in-memory state for the session
```

### Prohibited API Patterns

- No endpoint may accept a `userId` in the request body to determine what data to return
- No endpoint may return data belonging to a different user than the one authenticated
- No endpoint may expose another user's email, name, resume, or application data in any response field

---

## 6. Input Validation & Injection Prevention

### All Request Bodies Must Be Validated with Zod

No controller may access `req.body` fields without first running them through a Zod schema in the `validate` middleware. This prevents injection and unexpected data shapes.

```typescript
// src/middleware/validate.middleware.ts
import { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0].message);
    }
    req.body = result.data; // Replace with sanitized, typed data
    next();
  };
}
```

### File Uploads

- Maximum file size: **5MB**
- Allowed MIME types: `application/pdf` only (resume uploads)
- File names are never used as-is — generate a UUID-based storage key
- Files are stored in cloud storage (e.g. S3/Supabase Storage) — never on the local filesystem

```typescript
// ✅ Correct — sanitized file key
const storageKey = `resumes/${req.user.userId}/${crypto.randomUUID()}.pdf`;

// ❌ Wrong — using original filename
const storageKey = `resumes/${req.file.originalname}`;
```

---

## 7. Security Checklist (Pre-Merge)

Before any PR touching auth, data access, or user resources is merged, verify:

- [ ] Route has `authenticate` middleware applied
- [ ] Service performs ownership check (`resource.userId === req.user.userId`)
- [ ] No `userId` taken from `req.body` or `req.params` for access control
- [ ] Request body validated with Zod before use
- [ ] No raw Prisma queries returning all records without a `userId` filter
- [ ] No secrets, tokens, or passwords logged anywhere
- [ ] No new environment variables added without updating `.env.example`

---

_Last updated: June 2026 · Maintained by the engineering team · Applies to all contributors including AI assistants_
