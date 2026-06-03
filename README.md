# ATS for Job Seekers

CS490 project at NJIT. A web app to track job applications.

---

## Before you start

Make sure you have these installed on your computer:
- Node.js v22
- Git
- npm

If you do not have Node v22 run this in your terminal:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

Close your terminal and open a new one then run:

```bash
nvm install 22
nvm use 22
node -v
```

Should show v22.

---

## How to clone and set up

### 1. Clone the repo

```bash
git clone https://github.com/JacobTalaat/ats-for-job-seekers.git
cd ats-for-job-seekers
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open the `.env` file and fill in the values. Ask Jacob for the values on Discord.

Run the backend:

```bash
npm run dev
```

Should run on http://localhost:4000

Open your browser and go to http://localhost:4000. You should see:

```json
{ "success": true, "message": "ATS for Job Seekers API is running" }
```

### 3. Set up the frontend

Open a new terminal tab and run:

```bash
cd frontend
npm install
cp .env.example .env.local
```

Open `.env.local` and add:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Run the frontend:

```bash
npm run dev
```

Should run on http://localhost:3000

---

## How we work

- One branch per Jira ticket
- Branch name format: `feature/S1-010-user-registration`
- One PR per branch only
- Branch must be fully done before opening the PR
- PR must pass CI before merging
- At least one teammate reviews every PR before merge
- Never push directly to main
- Post standup on Discord before noon every day

---

## Commit rules

- Keep commits short and casual
- Example: `add login route` or `fix middleware bug`
- Space commits out naturally. Do not commit 5 times in 5 minutes.
- One or two commits per branch is enough

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Express.js v5, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT, bcryptjs |
| Email | Resend |
| AI | OpenAI GPT-4 |
| Testing | Vitest |
| CI/CD | GitHub Actions |

---

## Project structure

```
ats-for-job-seekers/
├── frontend/     Next.js app
├── backend/      Express app
├── shared/       shared TypeScript types
└── .github/      GitHub Actions CI
```

---
