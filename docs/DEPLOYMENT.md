# Deployment Runbook — S3-015 (Provision Cloud Runtime)

**Outcome:** App deployed to cloud with a public URL and documented environment setup.

## Target architecture

| Layer | Where it runs | Why |
|---|---|---|
| Database | Supabase (already provisioned) | Postgres already lives here; nothing new to create |
| Backend (Express API) | Render — Web Service | Free tier, native Node/Prisma, long-running process |
| Frontend (Next.js) | Vercel | First-party Next.js host, zero-config builds |

> If S3-BR-016 / S3-BR-017 mandate a specific host, swap Render/Vercel accordingly — the env-var wiring below is the same regardless.

---

## Step 0 — One required code change (CORS)

The backend currently only accepts requests from `localhost`, so the deployed frontend will be blocked until you fix this.

In **`backend/src/index.ts`**, replace:

```ts
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000']
```

with:

```ts
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]
```

Commit this on a ticket branch (e.g. `feature/S3-015-cloud-runtime`) per your repo rules.

---

## Step 1 — Grab your Supabase connection strings

In the Supabase dashboard → **Project Settings → Database → Connection string**, copy both:

- **Transaction pooler** (port `6543`) → this is your `DATABASE_URL` (runtime).
- **Session / direct** (port `5432`) → this is your `DIRECT_URL` (migrations).

Keep the `?pgbouncer=true` on the pooler URL. You'll paste these into Render next.

---

## Step 2 — Deploy the backend to Render

1. Go to <https://render.com> → sign in with GitHub → **New → Web Service** → pick the `oms2304/ATS` repo.
2. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && npm start`
   - **Instance Type:** Free
3. Add **Environment Variables** (Advanced → Add Environment Variable):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Supabase pooler URI (6543, with `?pgbouncer=true`) |
   | `DIRECT_URL` | Supabase direct URI (5432) |
   | `JWT_SECRET` | a long random string |
   | `RESEND_API_KEY` | from resend.com |
   | `EMAIL_FROM` | e.g. `ATS for Job Seekers <onboarding@resend.dev>` |
   | `OPENAI_API_KEY` | from OpenAI |
   | `FRONTEND_URL` | leave blank for now — you'll set it in Step 4 |

   > Don't set `PORT` — Render injects its own and your code already reads `process.env.PORT`.
4. Click **Create Web Service**. First deploy runs the build, applies migrations, and starts the server.
5. When it's live, copy the public URL, e.g. `https://ats-backend-xxxx.onrender.com`. Hit it in a browser — you should see `{"success":true,"message":"ATS for Job Seekers API is running"}`.

> Free-tier note: the service sleeps after ~15 min idle and takes ~50s to wake on the next request. Fine for a class project.

---

## Step 3 — Deploy the frontend to Vercel

1. Go to <https://vercel.com> → sign in with GitHub → **Add New → Project** → import `oms2304/ATS`.
2. Configure:
   - **Root Directory:** `frontend`
   - Framework preset auto-detects **Next.js** — leave build/output defaults.
3. Add **Environment Variables**:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | your Render backend URL from Step 2 |
   | `NEXT_PUBLIC_APP_URL` | leave blank for now — set after first deploy gives you the domain |
4. Click **Deploy**. When done, copy the frontend URL, e.g. `https://ats-frontend.vercel.app`.
5. Set `NEXT_PUBLIC_APP_URL` to that URL and redeploy (Vercel → Deployments → Redeploy) so client-side links resolve correctly.

---

## Step 4 — Close the loop (frontend ↔ backend)

Now that you have the real frontend URL, go back to **Render** and set:

- `FRONTEND_URL = https://ats-frontend.vercel.app`  (your actual Vercel URL)

Save — Render auto-redeploys. This does two things: unblocks CORS (Step 0) and makes verification/password-reset email links point at production.

---

## Step 5 — Verify end to end

1. Open the Vercel URL, register a new account.
2. Confirm the verification email arrives (Resend) and its link points at the Vercel domain.
3. Log in, create a job application, reload — data persists (confirms Supabase + backend + CORS all wired).
4. Open browser dev tools → Network → confirm API calls go to the Render URL and return 200, no CORS errors.

---

## Production environment variables (reference)

### Backend (Render)
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENAI_API_KEY`, `FRONTEND_URL`

### Frontend (Vercel)
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`

> `REDIS_URL` appears in `.env.example` but is **not used** in the codebase — no Redis instance needs provisioning.

---

## Deploy order cheat-sheet

Backend first (get its URL) → Frontend with that URL (get its URL) → set backend `FRONTEND_URL` + frontend `NEXT_PUBLIC_APP_URL` → redeploy both → verify.
