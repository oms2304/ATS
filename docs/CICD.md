# CI/CD Deployment Pipeline — S3-017

**Outcome:** A merge to `main` triggers a production deployment, and the deploy is verified with health checks.

This describes how code goes from a pull request to live production, and how we confirm the release is healthy.

---

## Pipeline overview

```
PR opened ──► CI (GitHub Actions) ──► review + merge to main
                 lint · build · test          │
                                              ▼
                       Render (backend) + Vercel (frontend) auto-deploy
                                              │
                                              ▼
                    Health checks: Render probe + Post-Deploy Health Check workflow
```

### 1. Continuous Integration (gate before merge)

`.github/workflows/ci.yml` runs on every pull request to `main` (and on push to `main`). Two jobs must pass:

- **backend** — `npm ci` → dependency report → `prisma generate` → `lint` → `build` → `test`
- **frontend** — `npm ci` → dependency report → `lint` → `build` → `test`

A PR should not be merged unless both are green. This is enforced by branch protection (see "Remaining setup").

### 2. Deployment (triggered by merge to `main`)

When a PR merges to `main`, both hosts deploy automatically — no manual step:

- **Backend → Render.** Auto-Deploy is set to *On Commit*. The Start Command `npx prisma migrate deploy && npm start` applies any pending database migrations, then boots the server. A failed migration aborts startup, so a bad release does not serve traffic.
- **Frontend → Vercel.** Vercel builds the `main` branch as the Production deployment and points `ats-delta-ten.vercel.app` at it.

### 3. Health checks (verify the deploy)

Two independent layers confirm the release is healthy:

- **Render health probe.** `GET /healthz` proves process liveness. `GET /readyz` additionally executes a bounded database query and returns 503 when the API cannot serve real traffic.
- **Post-Deploy Health Check workflow** (`.github/workflows/deploy-healthcheck.yml`). Runs on push to `main`, waits for the rollout, then curls the production backend `/readyz` and the frontend `/login`, retrying to absorb build time and free-tier cold starts. It fails the commit's checks if production isn't ready — a clear, visible signal that a deploy is broken.

---

## Endpoints & files

| Piece | Location |
|---|---|
| Health endpoints | `backend/src/index.ts` → `GET /healthz`, `GET /readyz`, `GET /version` |
| CI (test gate) | `.github/workflows/ci.yml` |
| Post-deploy health check | `.github/workflows/deploy-healthcheck.yml` |
| Backend host | Render service `ATS` (auto-deploy on commit) |
| Frontend host | Vercel project `ats` (production = `main`) |

---

## Remaining setup (one-time, live-config — do after the S3-015/016/017 PRs merge)

These touch the running services and your GitHub settings, so they're listed for you to do (they can't be safely flipped before the new code is on `main`):

1. **Point Render at `main`.** Render currently tracks `feature/S3-015-cloud-runtime` for testing. After the branches merge, set Render → Settings → Build & Deploy → **Branch = `main`** so production deploys come from `main`.
2. **Set Render Health Check Path = `/healthz`.** Render → Settings → Health Checks. Do this only once the `/healthz` code is deployed (otherwise Render will consider the current release unhealthy). Until then it can stay unset or point at `/`.
3. **Confirm Vercel Production Branch = `main`** (Vercel → Settings → Git).
4. **Enable branch protection on `main`.** GitHub → Settings → Branches → add rule for `main`: require the CI checks to pass and require 1 review before merge. This enforces the team rule "PR must pass CI before merging."

Once these are set, the flow is fully automatic: open PR → CI runs → review → merge → production deploys → health checks confirm it's live.
