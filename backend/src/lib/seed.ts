import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const ALICE_EMAIL = 'alice@demo.test';
export const BOB_EMAIL = 'bob@demo.test';
export const DEMO_PASSWORD = 'Password123';

export const STALE_JOB_TITLE = 'Home Health Nurse';
export const STALE_JOB_COMPANY = 'CareFirst Home Health';

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
Compassionate, detail-oriented communicator with 6 years of experience
coordinating multi-stakeholder programs in fast-paced clinical and
team environments. Bringing the same coordination, empathy, and
follow-through that I bring to patient care to brand, marketing, and
event operations at BrandCo.

EXPERIENCE
City Hospital — Registered Nurse, Medical/Surgical
  - Coordinated care for a 24-bed unit, partnering with physicians and
    families to keep every patient on plan.
  - Mentored new staff and ran handoffs across three shifts.
  - Triaged fast-moving situations under tight deadlines.

EDUCATION
Nursing program with clinical rotations across Med/Surg, ICU, and
patient education.

SKILLS
Patient education, stakeholder coordination, written communication,
event-style scheduling, bilingual support.
`;

export const COVER_LETTER_CONTENT = `Dear Hiring Team,

I am excited to apply for the Marketing Coordinator role at BrandCo.
My background as a Registered Nurse at City Hospital has given me a
strong foundation in coordinating multi-stakeholder programs, writing
clear patient-facing materials, and keeping multiple workstreams on
schedule under tight deadlines.

In my current role I coordinate care for a 24-bed medical/surgical unit,
partnering with physicians, families, and ancillary teams to deliver a
consistent experience. The same habits — clear written communication,
calm triage of competing priorities, and disciplined follow-up — map
directly to coordinating multi-channel marketing campaigns and event
logistics in a consumer-brand environment.

I would welcome the chance to bring that coordination mindset to BrandCo
and to learn from your marketing team. Thank you for considering my
application.

Sincerely,
Alice Anderson
`;

export const RESEARCH_NOTE_CONTENT = `BrandCo is a growing consumer brand with integrated marketing campaigns
spanning social, creative, sales, and external partners. Public details
about the company's leadership and financials are limited; candidates
should verify current facts before an interview.

Role focus (inferred from the posting):
  - Coordinating campaign calendars, approvals, and deliverables
  - Drafting and publishing social content with light engagement reporting
  - Supporting event organization and keeping stakeholders aligned

Questions to research or ask in the interview:
  1. What does the marketing team org structure look like, and who would
     this role partner with day-to-day?
  2. Which channels (paid social, email, events) drive the most pipeline
     for BrandCo today, and how is that measured?
  3. How does the team balance evergreen brand work versus time-sensitive
     campaign launches?
  4. What does success look like in the first 90 days for this role?
`;

export const PREP_NOTE_CONTENT = `Talking points to weave into the interview:
  - Patient education and stakeholder coordination map directly to
    campaign coordination and clear written communication.
  - Mentoring new staff demonstrates the ability to ramp up a wider
    marketing team and run handoffs.
  - Triaging fast-moving situations under tight deadlines shows
    comfort with competing priorities and on-time delivery.
  - Bilingual support and family-facing communication transfer to
    customer-facing brand work.
`;

export const ALICE_JOBS: ReadonlyArray<{
  title: string;
  company: string;
  jobPostingBody: string;
  stage: 'Interested' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';
  recruiterNotes?: string;
  outcomeNote?: string;
}> = [
  {
    title: 'Registered Nurse — Medical/Surgical',
    company: 'City Hospital',
    jobPostingBody: `Position: Registered Nurse — Medical/Surgical
Schedule: Full-time nights; every third weekend

City Hospital is seeking a compassionate, detail-oriented Registered Nurse to join its 24-bed Medical/Surgical unit. The RN will provide direct bedside care for adult patients with acute medical and post-surgical needs while working closely with physicians, nursing assistants, pharmacists, case managers, and other members of the care team.

Key responsibilities include completing patient assessments, monitoring vital signs and changes in condition, administering medications and treatments, maintaining accurate electronic documentation, and updating individualized care plans. The nurse will coordinate admissions, transfers, and discharges; provide clear education to patients and family members; and ensure safe handoffs at the beginning and end of each shift.

The ideal candidate is organized, calm under pressure, and committed to safe, patient-centered care. Strong clinical judgment, communication skills, teamwork, and the ability to prioritize several patient needs during a busy night shift are essential.`,
    stage: 'Applied',
  },
  {
    title: 'Marketing Coordinator',
    company: 'BrandCo',
    jobPostingBody: `Position: Marketing Coordinator
Schedule: Full-time, hybrid

BrandCo is looking for a Marketing Coordinator to support integrated campaigns for a growing consumer brand. This role works across marketing, creative, social media, sales, and external partners to keep campaigns organized, on schedule, and aligned with brand standards.

Responsibilities include maintaining campaign calendars, coordinating project timelines and approvals, preparing marketing materials, tracking deliverables, and helping organize promotional events. The coordinator will schedule and publish social content, monitor engagement, maintain campaign files and reporting dashboards, and help turn performance data into clear updates for the team.

The successful candidate is a strong written communicator with excellent organization and follow-through. Experience coordinating multiple workstreams, managing deadlines, and collaborating with different stakeholders is important. Familiarity with social-media platforms, spreadsheet reporting, presentation tools, and content-management workflows is preferred.`,
    stage: 'Interview',
  },
  {
    title: 'Patient Educator',
    company: 'Riverside Clinic',
    jobPostingBody: `Position: Patient Educator
Schedule: Full-time, weekday outpatient clinic

Riverside Clinic is seeking a Patient Educator to strengthen its chronic-disease management programs. The Patient Educator will help patients and caregivers understand diagnoses, medications, treatment plans, lifestyle recommendations, and the resources available to support long-term health.

This role develops clear, accessible education materials; delivers one-on-one and small-group teaching sessions; and works with nurses, providers, care coordinators, and social-service partners to identify barriers to care. Responsibilities also include documenting education provided, reinforcing discharge and follow-up instructions, collecting patient feedback, and updating materials to reflect current clinical guidance and clinic needs.

The ideal candidate communicates with empathy, adapts information for different levels of health literacy, and is comfortable building trust with diverse patient populations. Clinical experience, knowledge of chronic disease management, and strong written and presentation skills are valuable. Bilingual Spanish communication skills are a plus.`,
    stage: 'Interested',
  },
  {
    title: 'Charge Nurse — ICU',
    company: 'Mercy Health',
    jobPostingBody: `Position: Charge Nurse — Intensive Care Unit
Schedule: Full-time nights

Mercy Health is hiring an experienced Charge Nurse to lead a 12-nurse Intensive Care Unit team during the night shift. The Charge Nurse combines direct clinical expertise with operational leadership to ensure safe staffing, timely patient flow, clear communication, and consistent support for bedside nurses caring for critically ill patients.

Primary responsibilities include coordinating admissions, transfers, discharges, and bed placement; assigning staff based on acuity and skill mix; monitoring unit workload; and serving as a clinical resource when patients deteriorate or complex decisions are needed. The Charge Nurse will facilitate shift huddles and handoffs, collaborate with physicians and ancillary departments, address urgent staffing or workflow issues, and support compliance with safety, infection-prevention, and quality standards.

Candidates should have substantial critical-care nursing experience, strong assessment and escalation skills, and the confidence to guide a team in a high-acuity environment. The role requires sound judgment, respectful communication, and the ability to balance patient-care priorities with unit operations throughout the shift.`,
    stage: 'Offer',
  },
  {
    title: 'Pediatric Nurse — Outpatient Clinic',
    company: 'Sunshine Pediatrics',
    jobPostingBody: `Position: Pediatric Nurse — Outpatient Clinic
Schedule: Full-time days; no weekends

Sunshine Pediatrics is seeking a Pediatric Nurse to provide family-centered care in a busy outpatient setting. The nurse will support well-child visits, same-day appointments, chronic-condition follow-up, preventive care, and ongoing communication with parents and caregivers.

Responsibilities include obtaining histories and vital signs, performing telephone and in-person triage, administering vaccines and other ordered treatments, assisting providers during examinations and procedures, and documenting care in the electronic health record. The nurse will educate families about medications, growth and development, nutrition, immunization schedules, symptom monitoring, and home-care instructions. The role also helps coordinate referrals, follow-up appointments, and communication with schools or specialty providers when appropriate.

The ideal candidate enjoys working with children and families, communicates clearly and patiently, and can balance scheduled visits with urgent triage needs. Pediatric, primary-care, vaccine-administration, and patient-education experience are highly relevant.`,
    stage: 'Rejected',
    outcomeNote:
      'Rejected after final round, position filled by an internal candidate with more pediatric-specific experience.',
  },
];

export const STALE_JOB_BODY = `Position: Home Health Nurse
Schedule: Full-time field-based role

CareFirst Home Health is seeking a Registered Nurse to deliver skilled, compassionate care to homebound patients in their residences. The Home Health Nurse manages an assigned caseload and works independently in the field while maintaining close communication with physicians, therapists, care coordinators, patients, and family caregivers.

The nurse completes comprehensive assessments; develops and updates individualized plans of care; provides wound care, medication management, disease monitoring, and patient education; and recognizes changes that require escalation. The role includes documenting each visit in the electronic health record, coordinating services with the interdisciplinary team, reinforcing safety and self-management guidance, and helping patients and families understand medications, warning signs, and follow-up instructions.

Successful candidates are comfortable working autonomously, organizing travel and visit schedules, building rapport in patients’ homes, and applying sound clinical judgment. Experience with home health, care coordination, chronic disease management, wound care, and family education is especially valuable.`;

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
      'Compassionate Registered Nurse with 6 years of experience in acute care, patient education, and interdisciplinary coordination. Skilled at triaging fast-paced clinical environments and mentoring new staff.',
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
        'Provide direct patient care on a 24-bed medical/surgical unit. Mentor new staff and run shift handoffs across three shifts.',
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
        'Provide direct patient care on a 24-bed medical/surgical unit. Mentor new staff and run shift handoffs across three shifts.',
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
      targetRoles: ['Registered Nurse', 'Charge Nurse', 'Patient Educator'],
      preferredLocations: ['Newark, NJ', 'Remote'],
      workMode: 'Hybrid',
      salaryMin: 75000,
      salaryMax: 110000,
    },
    create: {
      userId: alice.id,
      targetRoles: ['Registered Nurse', 'Charge Nurse', 'Patient Educator'],
      preferredLocations: ['Newark, NJ', 'Remote'],
      workMode: 'Hybrid',
      salaryMin: 75000,
      salaryMax: 110000,
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
      recruiterNotes: job.recruiterNotes ?? null,
      outcomeNote: job.outcomeNote ?? null,
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
        title: 'Resume — Marketing Coordinator (BrandCo)',
        status: 'active',
        tags: ['demo', 'brandco'],
        archivedAt: null,
      },
      create: {
        id: `seed-resume-${marketingJob.id}`,
        user_id: alice.id,
        type: 'resume',
        title: 'Resume — Marketing Coordinator (BrandCo)',
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
        title: 'Cover Letter — Marketing Coordinator (BrandCo)',
        status: 'active',
        tags: ['demo', 'brandco'],
        archivedAt: null,
      },
      create: {
        id: `seed-cover-${marketingJob.id}`,
        user_id: alice.id,
        type: 'cover_letter',
        title: 'Cover Letter — Marketing Coordinator (BrandCo)',
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
        notes: 'Initial recruiter call — confirmed interest and salary range.',
      },
      create: {
        id: ALICE_INTERVIEW_ID,
        job_id: marketingJobForActivity.id,
        roundType: 'Phone Screen',
        date: interviewDate,
        notes: 'Initial recruiter call — confirmed interest and salary range.',
      },
    });

    const followUpDue = new Date(baseDate);
    followUpDue.setDate(followUpDue.getDate() + 1);

    await prisma.followUp.upsert({
      where: { id: ALICE_FOLLOWUP_ID },
      update: {
        job_id: marketingJobForActivity.id,
        title: 'Send thank-you email after phone screen',
        dueDate: followUpDue,
        completed: false,
      },
      create: {
        id: ALICE_FOLLOWUP_ID,
        job_id: marketingJobForActivity.id,
        title: 'Send thank-you email after phone screen',
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
    jobs: 6,
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
    `    - Jobs: ${summary.jobs} (Interested, Applied, Interview, Offer, Rejected + 1 intentionally Stale)`,
    '    - Rejected job has 3 seeded StageTransitions and 3 JobActivity rows',
    '    - Marketing Coordinator has 1 pre-seeded Interview + 1 FollowUp + 2 AI drafts + 1 ResearchNote + 1 PrepNote',
    `    - Legacy React/PostgreSQL skills removed: ${summary.legacySkillsDeleted}`,
    `  ${BOB_EMAIL}   / ${DEMO_PASSWORD} (verified, minimal profile)`,
  ];
}
