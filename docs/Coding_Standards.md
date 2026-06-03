S1-001: Engineering Coding Standards

What is this?
This is our team agreement for how we write code.
Everyone reads this before writing anything.
The goal is simple. When someone reads your code they should understand it without asking you.

1. Folder Structure
   One GitHub repo. Two main folders inside.

ats-for-job-seekers/
├── frontend/ (Next.js, everything the user sees)
├── backend/ (Express, API and database)
├── shared/ (types used by both)
└── package.json (run npm run dev to start both)

Frontend folders:
frontend/
├── app/ (pages)
├── components/ (buttons, cards, forms)
├── lib/api.ts (all backend calls go here)
└── hooks/ (custom React hooks)

Backend folders:
backend/src/
├── index.ts (Express starts here, port 4000)
├── routes/ (auth, jobs, profile, ai)
├── controllers/ (logic for each route)
├── middleware/ (auth check, ownership check)
└── lib/ (prisma, openai, jwt)

2. Naming Rules
   Follow these so everyone can find things fast.

File names
Use kebab-case.
job-card.tsx (good)
auth.routes.ts (good)
JobCard.tsx (bad)
authRoutes.ts (bad)

Variables and functions
Use camelCase.
const jobTitle = 'Engineer'
function getUserById(id) { }

React components
Use PascalCase.
export function JobCard({ job }) { }

TypeScript types
Use PascalCase.
type Job = { id: string; title: string }
interface UserProfile { firstName: string }

Database models
Model name in PascalCase. Field names in camelCase.
model Job {
id String @id @default(cuid())
title String
userId String
createdAt DateTime @default(now())
}

3. TypeScript Rules
   We use TypeScript in every file. No plain JavaScript.

Never write 'any' as a type. Figure out the real type.
Always add types to your component props.
Put shared types in shared/types.ts.

Good:
type JobCardProps = {
job: Job
onEdit: (id: string) => void
}

export function JobCard({ job, onEdit }: JobCardProps) {
return <div>{job.title}</div>
}

Bad:
export function JobCard({ job, onEdit }: any) { }

4. API Response Format
   Every response from Express must look the same way.

When it works
{ "success": true, "data": { ... } }

When it fails
{ "success": false, "error": "Something went wrong" }

When the user sends bad data
{ "success": false, "error": "Validation failed",
"fields": { "email": "Email is required" } }

Status codes
200: everything worked
201: new record was created
400: user sent bad data
401: not logged in or bad token
403: logged in but accessing someone else's data
404: record does not exist
500: something broke on our end

5. Error Handling
   Every route that touches the database needs a try and catch block.

export async function getJobs(req, res) {
try {
const jobs = await prisma.job.findMany({
where: { userId: req.user.id }
})
res.json({ success: true, data: jobs })
} catch (error) {
console.error('getJobs error:', error)
res.status(500).json({
success: false,
error: 'Failed to get jobs'
})
}
}

Do not do these things:
Do not send the real error to the frontend. Users should not see stack traces.
Do not return 200 when something went wrong.
Do not leave a catch block empty.

6. How Frontend Talks to Backend
   All fetch calls go through frontend/lib/api.ts.
   Do not call fetch() directly from a page or component.

// frontend/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL

export async function apiFetch(path, options?) {
const token = localStorage.getItem('token')
const res = await fetch(`${BASE}${path}`, {
headers: {
'Content-Type': 'application/json',
Authorization: `Bearer ${token}`
},
...options
})
return res.json()
}

How to use it:
const jobs = await apiFetch('/api/jobs')

const newJob = await apiFetch('/api/jobs', {
method: 'POST',
body: JSON.stringify({ title, company })
})

7. Git Rules

Branch names
One branch per story. Use this format:
feature/S1-010-user-registration
feature/S1-019-job-entity
fix/S1-014-middleware-bug

Commit messages
Keep them short. Use present tense.
add user registration route
fix ownership check status code
update job card to show stage

Before you open a PR
npm run lint passes
npm run build passes
npm run test passes
PR has a test evidence section
One teammate reviewed it
Do not push directly to main

8. Environment Variables
   Secret keys go in .env files. These files are never pushed to GitHub.

frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000

backend/.env
DATABASE_URL=postgresql://...
JWT_SECRET=make_this_long_and_random
OPENAI_API_KEY=sk-...
PORT=4000

The .env.example file has the key names but no real values. That file is pushed to GitHub.
When you clone the repo, copy .env.example to .env and fill in the values.

9. Using Claude for Code
   Using Claude is allowed. Just follow these rules.

Read the code before you put it in a PR. Do not paste without understanding it.
Add a note in the PR: Used Claude. Link to chat.
Write tests for AI code just like any other code.
If Claude breaks the rules in this doc, fix it before merging.
