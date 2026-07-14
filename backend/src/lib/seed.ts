import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const ALICE_EMAIL = 'alice@demo.test';
export const BOB_EMAIL = 'bob@demo.test';
export const DEMO_PASSWORD = 'Password123';

export const STALE_JOB_TITLE = 'Home Health Nurse';
export const STALE_JOB_COMPANY = 'CareFirst Home Health';

// This job was part of the older, larger Alice demo. Re-seeding removes only
// this exact Alice-owned row so existing demo databases converge on the
// smaller five-card board without touching unrelated development data.
export const RETIRED_ALICE_JOBS = [
  {
    title: 'Registered Nurse — Medical/Surgical',
    company: 'City Hospital',
  },
] as const;

export const LEGACY_SKILL_IDS = [
  'seed-skill-react-alice',
  'seed-skill-postgres-alice',
] as const;

export const ALICE_NURSING_SKILLS = [
  {
    id: 'seed-skill-triage-alice',
    name: 'Patient Triage',
    category: 'Clinical',
    proficiency: 'Expert',
  },
  {
    id: 'seed-skill-medication-administration-alice',
    name: 'Medication Administration',
    category: 'Clinical',
    proficiency: 'Expert',
  },
  {
    id: 'seed-skill-care-coordination-alice',
    name: 'Care Coordination',
    category: 'Clinical',
    proficiency: 'Advanced',
  },
] as const;

export const ALICE_EXPERIENCE_ID = 'seed-exp-city-hospital-alice';
export const ALICE_EDUCATION_ID = 'seed-edu-rutgers-alice';
export const ALICE_INTERVIEW_ID = 'seed-interview-phone-screen-alice';
export const ALICE_FOLLOWUP_ID = 'seed-followup-thank-you-alice';
export const ALICE_RESEARCH_NOTE_ID = 'seed-research-marketing-alice';
export const ALICE_PREP_NOTE_ID = 'seed-prep-talking-points-alice';

export const SEED_TARGET_ENV = 'SEED_TARGET';
export const ALLOW_DEMO_SEED_ENV = 'ALLOW_DEMO_SEED';
export const EXPECTED_DEV_PROJECT_REF_ENV = 'EXPECTED_DEV_SUPABASE_PROJECT_REF';
export const PRODUCTION_PROJECT_REF_ENV = 'PRODUCTION_SUPABASE_PROJECT_REF';
export const REQUIRED_SEED_TARGET = 'development';
export const REQUIRED_ALLOW_VALUE = 'true';

export class SeedGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedGuardError';
  }
}

export class SeedEnvironmentMismatchError extends Error {
  readonly hostname: string;
  readonly projectRef: string;
  constructor(hostname: string, projectRef: string, reason: string) {
    super(`Refusing to run demo seed: ${reason}.`);
    this.name = 'SeedEnvironmentMismatchError';
    this.hostname = hostname;
    this.projectRef = projectRef;
  }
}

export function validateSeedEnvironment(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env[SEED_TARGET_ENV] !== REQUIRED_SEED_TARGET) {
    throw new SeedGuardError(
      `Refusing to run seed: ${SEED_TARGET_ENV} must be set to "${REQUIRED_SEED_TARGET}" (got "${env[SEED_TARGET_ENV] ?? ''}").`
    );
  }
  if (env[ALLOW_DEMO_SEED_ENV] !== REQUIRED_ALLOW_VALUE) {
    throw new SeedGuardError(
      `Refusing to run seed: ${ALLOW_DEMO_SEED_ENV} must be set to "${REQUIRED_ALLOW_VALUE}".`
    );
  }
  const expectedDevRef = env[EXPECTED_DEV_PROJECT_REF_ENV]?.trim();
  const productionRef = env[PRODUCTION_PROJECT_REF_ENV]?.trim();
  if (!expectedDevRef) {
    throw new SeedGuardError(
      `Refusing to run seed: ${EXPECTED_DEV_PROJECT_REF_ENV} is required.`
    );
  }
  if (!productionRef) {
    throw new SeedGuardError(
      `Refusing to run seed: ${PRODUCTION_PROJECT_REF_ENV} is required.`
    );
  }
  if (expectedDevRef === productionRef) {
    throw new SeedGuardError(
      `Refusing to run seed: development and production project references must differ.`
    );
  }
}

export type SeedEnvironmentFingerprint = {
  hostname: string;
  projectRef: string;
};

export function assertDevelopmentEnvironment(
  databaseUrl: string | undefined,
  directUrl: string | undefined,
  supabaseUrl: string | undefined,
  expectedDevProjectRef: string | undefined,
  productionProjectRef: string | undefined
): SeedEnvironmentFingerprint {
  if (
    !databaseUrl ||
    !directUrl ||
    !supabaseUrl ||
    !expectedDevProjectRef ||
    !productionProjectRef
  ) {
    throw new SeedEnvironmentMismatchError(
      '',
      '',
      'all development URLs and project-reference guards are required'
    );
  }

  const hostname = extractHostname(databaseUrl);
  const databaseProjectRef = extractDatabaseProjectRef(databaseUrl);
  const directProjectRef = extractDatabaseProjectRef(directUrl);
  const supabaseProjectRef = extractProjectRef(supabaseUrl);
  const expected = expectedDevProjectRef.trim();
  const production = productionProjectRef.trim();

  if (
    !hostname ||
    !databaseProjectRef ||
    !directProjectRef ||
    !supabaseProjectRef
  ) {
    throw new SeedEnvironmentMismatchError(
      hostname,
      supabaseProjectRef,
      'one or more target URLs are malformed or do not contain a Supabase project reference'
    );
  }

  if (expected === production) {
    throw new SeedEnvironmentMismatchError(
      hostname,
      supabaseProjectRef,
      'development and production project references are identical'
    );
  }

  const resolvedRefs = [
    databaseProjectRef,
    directProjectRef,
    supabaseProjectRef,
  ];
  if (resolvedRefs.some((ref) => ref !== expected)) {
    throw new SeedEnvironmentMismatchError(
      hostname,
      supabaseProjectRef,
      'database, direct, and Supabase URLs do not all match the expected development project'
    );
  }

  if (resolvedRefs.some((ref) => ref === production)) {
    throw new SeedEnvironmentMismatchError(
      hostname,
      supabaseProjectRef,
      'the resolved target matches the production project'
    );
  }

  return { hostname, projectRef: supabaseProjectRef };
}

export function extractHostname(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
}

export function extractProjectRef(supabaseUrl: string): string {
  try {
    const host = new URL(supabaseUrl).hostname;
    const first = host.split('.')[0] ?? '';
    return first;
  } catch {
    return '';
  }
}

export function extractDatabaseProjectRef(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    const username = decodeURIComponent(url.username);
    if (username.startsWith('postgres.')) {
      return username.slice('postgres.'.length);
    }

    const hostParts = url.hostname.split('.');
    if (
      hostParts.length >= 4 &&
      hostParts[0] === 'db' &&
      hostParts[hostParts.length - 2] === 'supabase' &&
      hostParts[hostParts.length - 1] === 'co'
    ) {
      return hostParts[1] ?? '';
    }
    return '';
  } catch {
    return '';
  }
}

const BASELINE_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'location',
  'summary',
] as const;

type ProfileLike = Partial<
  Record<
    (typeof BASELINE_FIELDS)[number] | 'linkedIn',
    string | null | undefined
  >
>;

export function calculateCompletionScore(profile: ProfileLike): number {
  const completed = BASELINE_FIELDS.filter(
    (field) =>
      profile[field] !== null &&
      profile[field] !== undefined &&
      profile[field] !== ''
  ).length;
  return Math.round((completed / BASELINE_FIELDS.length) * 100);
}

export const RESUME_CONTENT = `ALICE ANDERSON
Newark, NJ  |  alice@demo.test  |  +1-555-010-2233

SUMMARY
Registered Nurse bringing six years of coordination, communication, and
deadline management experience to BrandCo's marketing team.

EXPERIENCE
City Hospital — Registered Nurse, Medical/Surgical
  - Coordinated care plans and handoffs across a 24-bed unit.
  - Created clear patient materials and mentored new staff.

EDUCATION
BSN, Rutgers University

SKILLS
Stakeholder coordination, written communication, scheduling, reporting
`;

export const COVER_LETTER_CONTENT = `Dear Hiring Team,

I am excited to apply for the Marketing Coordinator role at BrandCo. As a
Registered Nurse, I coordinate busy teams, write clear materials, and keep
time-sensitive work on schedule.

I would bring that same organization, calm prioritization, and follow-through
to campaign calendars, content coordination, and events. Thank you for your
consideration.

Sincerely,
Alice Anderson
`;

export const RESEARCH_NOTE_CONTENT = `BrandCo demo research
- Growing consumer brand with a small cross-functional marketing team.
- Role focus: campaign calendars, social content, reporting, and events.
- Ask: What should this role accomplish in its first 90 days?
`;

export const PREP_NOTE_CONTENT = `Talking points to weave into the interview:
  - Care coordination maps to campaign coordination.
  - Patient education demonstrates clear audience-focused writing.
  - Shift handoffs show reliable follow-through under deadlines.
`;

export const ALICE_JOBS: ReadonlyArray<{
  title: string;
  company: string;
  jobPostingBody: string;
  stage: 'Interested' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';
  deadlineDaysFromNow?: number;
  recruiterNotes?: string;
  outcomeNote?: string;
}> = [
  {
    title: 'Marketing Coordinator',
    company: 'BrandCo',
    jobPostingBody: `Position: Marketing Coordinator
Hybrid, full-time

Coordinate campaign calendars, content approvals, reporting, and events.
Strong writing, organization, and cross-team follow-through required.`,
    stage: 'Interview',
    deadlineDaysFromNow: 7,
    recruiterNotes: 'Jordan Lee · recruiter@brandco.test',
  },
  {
    title: 'Patient Educator',
    company: 'Riverside Clinic',
    jobPostingBody: `Position: Patient Educator
Weekday outpatient role creating clear materials and teaching patients about
care plans, medications, and follow-up.`,
    stage: 'Interested',
  },
  {
    title: 'Charge Nurse — ICU',
    company: 'Mercy Health',
    jobPostingBody: `Position: Charge Nurse — Intensive Care Unit
Lead night-shift staffing, patient flow, handoffs, and urgent clinical
escalations for a 12-nurse ICU team.`,
    stage: 'Offer',
    outcomeNote: 'Offer received; reviewing schedule and benefits.',
  },
  {
    title: 'Pediatric Nurse — Outpatient Clinic',
    company: 'Sunshine Pediatrics',
    jobPostingBody: `Position: Pediatric Nurse — Outpatient Clinic
Daytime clinic role supporting pediatric visits, triage, vaccines, family
education, and referrals.`,
    stage: 'Rejected',
    outcomeNote:
      'Position filled by an internal candidate after the final interview.',
  },
];

export const STALE_JOB_BODY = `Position: Home Health Nurse
Field-based role managing home visits, care plans, patient education, and
coordination with an interdisciplinary team.`;

export type SeedSummary = {
  users: number;
  profiles: number;
  experiences: number;
  educations: number;
  skills: number;
  careerPreferences: number;
  jobs: number;
  documents: number;
  documentVersions: number;
  jobDocumentLinks: number;
  interviews: number;
  followUps: number;
  researchNotes: number;
  prepNotes: number;
  stageTransitions: number;
  jobActivities: number;
  legacySkillsDeleted: number;
};

export class SeedVerificationError extends Error {
  constructor(message: string) {
    super(`Seed verification failed: ${message}`);
    this.name = 'SeedVerificationError';
  }
}

export type SeedDeps = {
  prisma: PrismaClient;
  hashPassword: (plain: string) => Promise<string>;
};

export function defaultHashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function seedDemo(
  deps: SeedDeps,
  options: { now?: () => Date } = {}
): Promise<SeedSummary> {
  const { prisma, hashPassword } = deps;
  const now = options.now ?? (() => new Date());
  const password = await hashPassword(DEMO_PASSWORD);

  const alice = await prisma.user.upsert({
    where: { email: ALICE_EMAIL },
    update: {
      password,
      is_verified: true,
      name: 'Alice Anderson',
    },
    create: {
      email: ALICE_EMAIL,
      name: 'Alice Anderson',
      password,
      is_verified: true,
    },
  });

  const aliceProfileData: ProfileLike = {
    firstName: 'Alice',
    lastName: 'Anderson',
    phone: '+1-555-010-2233',
    location: 'Newark, NJ',
    linkedIn: 'https://www.linkedin.com/in/alice-demo',
    summary:
      'Registered Nurse with six years of experience in patient education, team coordination, and calm prioritization.',
  };
  const aliceProfile = {
    userId: alice.id,
    firstName: aliceProfileData.firstName!,
    lastName: aliceProfileData.lastName!,
    phone: aliceProfileData.phone!,
    location: aliceProfileData.location!,
    linkedIn: aliceProfileData.linkedIn!,
    summary: aliceProfileData.summary!,
    completionScore: calculateCompletionScore(aliceProfileData),
  };

  await prisma.profile.upsert({
    where: { userId: alice.id },
    update: aliceProfile,
    create: aliceProfile,
  });

  // Deterministic id keeps the Experience row idempotent across re-seeds and
  // survives the broader shared-development database.
  await prisma.experience.upsert({
    where: { id: ALICE_EXPERIENCE_ID },
    update: {
      userId: alice.id,
      title: 'Registered Nurse — Medical/Surgical',
      company: 'City Hospital',
      startDate: new Date('2018-06-01'),
      endDate: null,
      isCurrent: true,
      description:
        'Coordinate patient care, mentor new staff, and lead clear shift handoffs.',
      order: 0,
    },
    create: {
      id: ALICE_EXPERIENCE_ID,
      userId: alice.id,
      title: 'Registered Nurse — Medical/Surgical',
      company: 'City Hospital',
      startDate: new Date('2018-06-01'),
      endDate: null,
      isCurrent: true,
      description:
        'Coordinate patient care, mentor new staff, and lead clear shift handoffs.',
      order: 0,
    },
  });

  await prisma.education.upsert({
    where: { id: ALICE_EDUCATION_ID },
    update: {
      userId: alice.id,
      school: 'Rutgers University',
      degree: 'BSN',
      fieldOfStudy: 'Nursing',
      startDate: new Date('2014-09-01'),
      endDate: new Date('2018-05-31'),
      isCurrent: false,
      gpa: '3.7',
      order: 0,
    },
    create: {
      id: ALICE_EDUCATION_ID,
      userId: alice.id,
      school: 'Rutgers University',
      degree: 'BSN',
      fieldOfStudy: 'Nursing',
      startDate: new Date('2014-09-01'),
      endDate: new Date('2018-05-31'),
      isCurrent: false,
      gpa: '3.7',
      order: 0,
    },
  });

  // Skill migration: delete exactly the two legacy React/PostgreSQL ids, then
  // upsert the three nursing skills. deleteMany returns a count so we can
  // report what changed; running it a second time is a no-op because the ids
  // are no longer present.
  const deleted = await prisma.skill.deleteMany({
    where: { id: { in: [...LEGACY_SKILL_IDS] } },
  });
  for (const s of ALICE_NURSING_SKILLS) {
    await prisma.skill.upsert({
      where: { id: s.id },
      update: {
        userId: alice.id,
        name: s.name,
        category: s.category,
        proficiency: s.proficiency,
        order: 0,
      },
      create: {
        id: s.id,
        userId: alice.id,
        name: s.name,
        category: s.category,
        proficiency: s.proficiency,
        order: 0,
      },
    });
  }

  await prisma.careerPreferences.upsert({
    where: { userId: alice.id },
    update: {
      targetRoles: ['Patient Educator', 'Nurse Coordinator'],
      preferredLocations: ['Newark, NJ'],
      workMode: 'Hybrid',
      salaryMin: 75000,
      salaryMax: 110000,
    },
    create: {
      userId: alice.id,
      targetRoles: ['Patient Educator', 'Nurse Coordinator'],
      preferredLocations: ['Newark, NJ'],
      workMode: 'Hybrid',
      salaryMin: 75000,
      salaryMax: 110000,
    },
  });

  await prisma.job.deleteMany({
    where: {
      user_id: alice.id,
      OR: RETIRED_ALICE_JOBS.map(({ title, company }) => ({ title, company })),
    },
  });

  for (const job of ALICE_JOBS) {
    const existing = await prisma.job.findFirst({
      where: { user_id: alice.id, title: job.title, company: job.company },
    });
    const data = {
      user_id: alice.id,
      title: job.title,
      company: job.company,
      jobPostingBody: job.jobPostingBody,
      stage: job.stage,
      deadline:
        job.deadlineDaysFromNow === undefined
          ? null
          : new Date(
              now().getTime() + job.deadlineDaysFromNow * 24 * 60 * 60 * 1000
            ),
      recruiterNotes: job.recruiterNotes ?? null,
      outcomeNote: job.outcomeNote ?? null,
      archivedAt: null,
    };
    if (!existing) {
      await prisma.job.create({ data });
    } else {
      // Update existing row to restore canonical state, including any
      // canonical recruiterNotes / outcomeNote.
      await prisma.job.update({ where: { id: existing.id }, data });
    }
  }

  // Pre-seed a StageTransition + JobActivity history on the Rejected job so the
  // timeline already shows a realistic progression and the C16 outcome is visible
  // on first load. Deterministic ids make this idempotent across re-seeds.
  const rejectedJob = await prisma.job.findFirst({
    where: { user_id: alice.id, title: 'Pediatric Nurse — Outpatient Clinic' },
  });
  if (rejectedJob) {
    const transitions = [
      { suffix: '1', fromStage: 'Interested', toStage: 'Applied' },
      { suffix: '2', fromStage: 'Applied', toStage: 'Interview' },
      { suffix: '3', fromStage: 'Interview', toStage: 'Rejected' },
    ];
    for (const t of transitions) {
      await prisma.stageTransition.upsert({
        where: { id: `seed-stage-${rejectedJob.id}-${t.suffix}` },
        update: {
          job_id: rejectedJob.id,
          fromStage: t.fromStage,
          toStage: t.toStage,
        },
        create: {
          id: `seed-stage-${rejectedJob.id}-${t.suffix}`,
          job_id: rejectedJob.id,
          fromStage: t.fromStage,
          toStage: t.toStage,
        },
      });
      await prisma.jobActivity.upsert({
        where: { id: `seed-activity-${rejectedJob.id}-${t.suffix}` },
        update: {
          job_id: rejectedJob.id,
          type: 'stage_change',
          note: `Stage changed from ${t.fromStage} to ${t.toStage}`,
        },
        create: {
          id: `seed-activity-${rejectedJob.id}-${t.suffix}`,
          job_id: rejectedJob.id,
          type: 'stage_change',
          note: `Stage changed from ${t.fromStage} to ${t.toStage}`,
        },
      });
    }
  }

  const bob = await prisma.user.upsert({
    where: { email: BOB_EMAIL },
    update: {
      password,
      is_verified: true,
      name: 'Bob Bennett',
    },
    create: {
      email: BOB_EMAIL,
      name: 'Bob Bennett',
      password,
      is_verified: true,
    },
  });

  const bobProfile = {
    userId: bob.id,
    firstName: 'Bob',
    lastName: 'Bennett',
    phone: null,
    location: null,
    linkedIn: null,
    summary: null,
    completionScore: 0,
  };

  await prisma.profile.upsert({
    where: { userId: bob.id },
    update: bobProfile,
    create: bobProfile,
  });

  // Pre-seeded AI drafts so C20-C22 are demo-ready even if OpenAI is flaky.
  // Two drafts are attached to Alice's "Marketing Coordinator" job:
  //   - a tailored resume
  //   - a tailored cover letter
  const marketingJob = await prisma.job.findFirst({
    where: {
      user_id: alice.id,
      title: 'Marketing Coordinator',
      company: 'BrandCo',
    },
  });

  if (marketingJob) {
    const resumeDoc = await prisma.document.upsert({
      where: { id: `seed-resume-${marketingJob.id}` },
      update: {
        user_id: alice.id,
        type: 'resume',
        title: 'BrandCo Resume',
        status: 'active',
        tags: ['demo', 'brandco'],
        archivedAt: null,
      },
      create: {
        id: `seed-resume-${marketingJob.id}`,
        user_id: alice.id,
        type: 'resume',
        title: 'BrandCo Resume',
        status: 'active',
        tags: ['demo', 'brandco'],
        archivedAt: null,
      },
    });
    const resumeVersion = await prisma.documentVersion.upsert({
      where: { id: `seed-resume-ver-${marketingJob.id}` },
      update: {
        document_id: resumeDoc.id,
        version_number: 1,
        content: RESUME_CONTENT,
        label: 'Initial draft',
        fileUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        is_archived: false,
      },
      create: {
        id: `seed-resume-ver-${marketingJob.id}`,
        document_id: resumeDoc.id,
        version_number: 1,
        content: RESUME_CONTENT,
        label: 'Initial draft',
        fileUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        is_archived: false,
      },
    });

    const coverDoc = await prisma.document.upsert({
      where: { id: `seed-cover-${marketingJob.id}` },
      update: {
        user_id: alice.id,
        type: 'cover_letter',
        title: 'BrandCo Cover Letter',
        status: 'active',
        tags: ['demo', 'brandco'],
        archivedAt: null,
      },
      create: {
        id: `seed-cover-${marketingJob.id}`,
        user_id: alice.id,
        type: 'cover_letter',
        title: 'BrandCo Cover Letter',
        status: 'active',
        tags: ['demo', 'brandco'],
        archivedAt: null,
      },
    });
    const coverVersion = await prisma.documentVersion.upsert({
      where: { id: `seed-cover-ver-${marketingJob.id}` },
      update: {
        document_id: coverDoc.id,
        version_number: 1,
        content: COVER_LETTER_CONTENT,
        label: 'Initial draft',
        fileUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        is_archived: false,
      },
      create: {
        id: `seed-cover-ver-${marketingJob.id}`,
        document_id: coverDoc.id,
        version_number: 1,
        content: COVER_LETTER_CONTENT,
        label: 'Initial draft',
        fileUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        is_archived: false,
      },
    });

    await prisma.jobDocumentLink.upsert({
      where: { job_id_type: { job_id: marketingJob.id, type: 'resume' } },
      update: {
        document_id: resumeDoc.id,
        document_version_id: resumeVersion.id,
      },
      create: {
        job_id: marketingJob.id,
        document_id: resumeDoc.id,
        document_version_id: resumeVersion.id,
        type: 'resume',
      },
    });
    await prisma.jobDocumentLink.upsert({
      where: { job_id_type: { job_id: marketingJob.id, type: 'cover_letter' } },
      update: {
        document_id: coverDoc.id,
        document_version_id: coverVersion.id,
      },
      create: {
        job_id: marketingJob.id,
        document_id: coverDoc.id,
        document_version_id: coverVersion.id,
        type: 'cover_letter',
      },
    });
  }

  // Pre-seed one Interview and one FollowUp on Marketing Coordinator so the
  // timeline already has anchor rows for the C14/C15 demos. Deterministic ids
  // make this idempotent across re-seeds.
  const marketingJobForActivity = await prisma.job.findFirst({
    where: {
      user_id: alice.id,
      title: 'Marketing Coordinator',
      company: 'BrandCo',
    },
  });

  if (marketingJobForActivity) {
    const baseDate = now();
    const interviewDate = new Date(baseDate);
    interviewDate.setDate(interviewDate.getDate() - 2);

    await prisma.interview.upsert({
      where: { id: ALICE_INTERVIEW_ID },
      update: {
        job_id: marketingJobForActivity.id,
        roundType: 'Phone Screen',
        date: interviewDate,
        notes: 'Recruiter screen complete; salary range confirmed.',
      },
      create: {
        id: ALICE_INTERVIEW_ID,
        job_id: marketingJobForActivity.id,
        roundType: 'Phone Screen',
        date: interviewDate,
        notes: 'Recruiter screen complete; salary range confirmed.',
      },
    });

    const followUpDue = new Date(baseDate);
    followUpDue.setDate(followUpDue.getDate() + 1);

    await prisma.followUp.upsert({
      where: { id: ALICE_FOLLOWUP_ID },
      update: {
        job_id: marketingJobForActivity.id,
        title: 'Send thank-you email',
        dueDate: followUpDue,
        completed: false,
      },
      create: {
        id: ALICE_FOLLOWUP_ID,
        job_id: marketingJobForActivity.id,
        title: 'Send thank-you email',
        dueDate: followUpDue,
        completed: false,
      },
    });
  }

  // Pre-seed a deterministic ResearchNote on the Marketing Coordinator job so
  // the Research Notes section is demo-ready on first load.
  if (marketingJob) {
    await prisma.researchNote.upsert({
      where: { job_id: marketingJob.id },
      update: {
        content: RESEARCH_NOTE_CONTENT,
      },
      create: {
        id: ALICE_RESEARCH_NOTE_ID,
        job_id: marketingJob.id,
        content: RESEARCH_NOTE_CONTENT,
      },
    });

    // Pre-seed a deterministic PrepNote on the Marketing Coordinator job so
    // the Interview Prep Notes section is demo-ready on first load.
    await prisma.prepNote.upsert({
      where: { id: ALICE_PREP_NOTE_ID },
      update: {
        job_id: marketingJob.id,
        category: 'talking_points',
        content: PREP_NOTE_CONTENT,
      },
      create: {
        id: ALICE_PREP_NOTE_ID,
        job_id: marketingJob.id,
        category: 'talking_points',
        content: PREP_NOTE_CONTENT,
      },
    });
  }

  // Seed one deliberately STALE job so the orange "Stale" badge (7+ days since
  // updatedAt) is demo-ready on first load. Backdate updatedAt ~10 days. Stage
  // is not Rejected and the job is not archived, so isStale resolves true in
  // frontend/components/ui/job-card.tsx. The job is located by (alice, title,
  // company) so re-seeding is idempotent without introducing a deterministic id.
  const baseDate = now();
  const staleDate = new Date(baseDate);
  staleDate.setDate(staleDate.getDate() - 10);

  const existingStale = await prisma.job.findFirst({
    where: {
      user_id: alice.id,
      title: STALE_JOB_TITLE,
      company: STALE_JOB_COMPANY,
    },
  });
  if (!existingStale) {
    await prisma.job.create({
      data: {
        user_id: alice.id,
        title: STALE_JOB_TITLE,
        company: STALE_JOB_COMPANY,
        jobPostingBody: STALE_JOB_BODY,
        stage: 'Applied',
        deadline: null,
        recruiterNotes: null,
        outcomeNote: null,
        archivedAt: null,
      },
    });
  } else {
    await prisma.job.update({
      where: { id: existingStale.id },
      data: {
        user_id: alice.id,
        title: STALE_JOB_TITLE,
        company: STALE_JOB_COMPANY,
        jobPostingBody: STALE_JOB_BODY,
        stage: 'Applied',
        deadline: null,
        recruiterNotes: null,
        outcomeNote: null,
        archivedAt: null,
      },
    });
  }

  const staleJob = await prisma.job.findFirst({
    where: {
      user_id: alice.id,
      title: STALE_JOB_TITLE,
      company: STALE_JOB_COMPANY,
    },
  });
  if (staleJob) {
    // Guarantee the backdate regardless of Prisma @updatedAt behavior on create.
    await prisma.$executeRaw`UPDATE "Job" SET "updatedAt" = ${staleDate} WHERE id = ${staleJob.id}`;
  }

  return {
    users: 2,
    profiles: 2,
    experiences: 1,
    educations: 1,
    skills: ALICE_NURSING_SKILLS.length,
    careerPreferences: 1,
    jobs: ALICE_JOBS.length + 1,
    documents: 2,
    documentVersions: 2,
    jobDocumentLinks: 2,
    interviews: 1,
    followUps: 1,
    researchNotes: 1,
    prepNotes: 1,
    stageTransitions: 3,
    jobActivities: 3,
    legacySkillsDeleted: deleted.count,
  };
}

function requireObservedCount(
  label: string,
  actual: number,
  expected: number
): void {
  if (actual !== expected) {
    throw new SeedVerificationError(
      `${label} expected ${expected}, observed ${actual}`
    );
  }
}

export async function verifySeedState(
  prisma: PrismaClient,
  legacySkillsDeleted = 0
): Promise<SeedSummary> {
  const alice = await prisma.user.findUnique({
    where: { email: ALICE_EMAIL },
    select: { id: true },
  });
  const bob = await prisma.user.findUnique({
    where: { email: BOB_EMAIL },
    select: { id: true },
  });
  if (!alice || !bob) {
    throw new SeedVerificationError('Alice and Bob must both exist');
  }

  const canonicalJobs = [
    ...ALICE_JOBS.map(({ title, company }) => ({ title, company })),
    { title: STALE_JOB_TITLE, company: STALE_JOB_COMPANY },
  ];
  const jobs = await prisma.job.findMany({
    where: {
      user_id: alice.id,
      OR: canonicalJobs,
    },
    select: { id: true, title: true, company: true },
  });
  for (const expectedJob of canonicalJobs) {
    const matches = jobs.filter(
      (job) =>
        job.title === expectedJob.title && job.company === expectedJob.company
    );
    requireObservedCount(
      `${expectedJob.title} at ${expectedJob.company}`,
      matches.length,
      1
    );
  }

  const marketingJob = jobs.find(
    (job) => job.title === 'Marketing Coordinator' && job.company === 'BrandCo'
  );
  const rejectedJob = jobs.find(
    (job) => job.title === 'Pediatric Nurse — Outpatient Clinic'
  );
  if (!marketingJob || !rejectedJob) {
    throw new SeedVerificationError(
      'Marketing Coordinator and rejected pediatric jobs must exist'
    );
  }

  const resumeDocumentId = `seed-resume-${marketingJob.id}`;
  const coverDocumentId = `seed-cover-${marketingJob.id}`;
  const resumeVersionId = `seed-resume-ver-${marketingJob.id}`;
  const coverVersionId = `seed-cover-ver-${marketingJob.id}`;
  const transitionIds = ['1', '2', '3'].map(
    (suffix) => `seed-stage-${rejectedJob.id}-${suffix}`
  );
  const activityIds = ['1', '2', '3'].map(
    (suffix) => `seed-activity-${rejectedJob.id}-${suffix}`
  );

  const [
    users,
    profiles,
    experiences,
    educations,
    skills,
    legacySkills,
    careerPreferences,
    documents,
    documentVersions,
    jobDocumentLinks,
    interviews,
    followUps,
    researchNotes,
    prepNotes,
    stageTransitions,
    jobActivities,
  ] = await Promise.all([
    prisma.user.count({
      where: { email: { in: [ALICE_EMAIL, BOB_EMAIL] } },
    }),
    prisma.profile.count({
      where: { userId: { in: [alice.id, bob.id] } },
    }),
    prisma.experience.count({ where: { id: ALICE_EXPERIENCE_ID } }),
    prisma.education.count({ where: { id: ALICE_EDUCATION_ID } }),
    prisma.skill.count({
      where: {
        userId: alice.id,
        id: { in: ALICE_NURSING_SKILLS.map(({ id }) => id) },
      },
    }),
    prisma.skill.count({ where: { id: { in: [...LEGACY_SKILL_IDS] } } }),
    prisma.careerPreferences.count({ where: { userId: alice.id } }),
    prisma.document.count({
      where: { id: { in: [resumeDocumentId, coverDocumentId] } },
    }),
    prisma.documentVersion.count({
      where: { id: { in: [resumeVersionId, coverVersionId] } },
    }),
    prisma.jobDocumentLink.count({
      where: {
        job_id: marketingJob.id,
        type: { in: ['resume', 'cover_letter'] },
      },
    }),
    prisma.interview.count({ where: { id: ALICE_INTERVIEW_ID } }),
    prisma.followUp.count({ where: { id: ALICE_FOLLOWUP_ID } }),
    prisma.researchNote.count({ where: { job_id: marketingJob.id } }),
    prisma.prepNote.count({ where: { id: ALICE_PREP_NOTE_ID } }),
    prisma.stageTransition.count({ where: { id: { in: transitionIds } } }),
    prisma.jobActivity.count({ where: { id: { in: activityIds } } }),
  ]);

  const summary: SeedSummary = {
    users,
    profiles,
    experiences,
    educations,
    skills,
    careerPreferences,
    jobs: jobs.length,
    documents,
    documentVersions,
    jobDocumentLinks,
    interviews,
    followUps,
    researchNotes,
    prepNotes,
    stageTransitions,
    jobActivities,
    legacySkillsDeleted,
  };

  const expectedCounts: Omit<SeedSummary, 'legacySkillsDeleted'> = {
    users: 2,
    profiles: 2,
    experiences: 1,
    educations: 1,
    skills: 3,
    careerPreferences: 1,
    jobs: 5,
    documents: 2,
    documentVersions: 2,
    jobDocumentLinks: 2,
    interviews: 1,
    followUps: 1,
    researchNotes: 1,
    prepNotes: 1,
    stageTransitions: 3,
    jobActivities: 3,
  };
  for (const [label, expected] of Object.entries(expectedCounts)) {
    requireObservedCount(
      label,
      summary[label as keyof typeof expectedCounts],
      expected
    );
  }
  requireObservedCount('legacy skills', legacySkills, 0);

  return summary;
}

export function formatSeedSummary(summary: SeedSummary): string[] {
  return [
    'Seed complete:',
    `  ${ALICE_EMAIL} / ${DEMO_PASSWORD}`,
    '    - Profile: 5/5 baseline fields + 1 Experience + 1 Education + 3 Skills + CareerPreferences',
    `    - Jobs: ${summary.jobs} (one per stage; Applied is intentionally Stale)`,
    '    - Rejected job has 3 seeded StageTransitions and 3 JobActivity rows',
    '    - Marketing Coordinator is the feature hub: deadline, recruiter, Interview, FollowUp, 2 AI drafts, ResearchNote, and PrepNote',
    `    - Legacy React/PostgreSQL skills removed: ${summary.legacySkillsDeleted}`,
    `  ${BOB_EMAIL}   / ${DEMO_PASSWORD} (verified, minimal profile)`,
  ];
}
