/// <reference types="node" />
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
});

const prisma = new PrismaClient({ adapter });

const BASELINE_FIELDS = ['firstName', 'lastName', 'phone', 'location', 'summary'] as const;

type ProfileLike = Partial<
  Record<(typeof BASELINE_FIELDS)[number] | 'linkedIn', string | null | undefined>
>;

function calculateCompletionScore(profile: ProfileLike): number {
  const completed = BASELINE_FIELDS.filter(
    (field) => profile[field] !== null && profile[field] !== undefined && profile[field] !== ''
  ).length;
  return Math.round((completed / BASELINE_FIELDS.length) * 100);
}

async function main() {
  const password = await bcrypt.hash('Password123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@demo.test' },
    update: {
      password,
      is_verified: true,
      name: 'Alice Anderson',
    },
    create: {
      email: 'alice@demo.test',
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

  // Pre-populate Alice's Sprint 2 profile sections so C04/C17 read "all 6
  // sections pre-populated" on first load. Deterministic IDs make this
  // idempotent across re-seeds.
  await prisma.experience.upsert({
    where: { id: 'seed-exp-city-hospital-alice' },
    update: {},
    create: {
      id: 'seed-exp-city-hospital-alice',
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
    where: { id: 'seed-edu-rutgers-alice' },
    update: {},
    create: {
      id: 'seed-edu-rutgers-alice',
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

  const seedSkills = [
    { id: 'seed-skill-react-alice',    name: 'React',          category: 'Frontend', proficiency: 'Intermediate' },
    { id: 'seed-skill-postgres-alice', name: 'PostgreSQL',     category: 'Backend',  proficiency: 'Advanced' },
    { id: 'seed-skill-triage-alice',   name: 'Patient Triage', category: 'Clinical', proficiency: 'Expert' },
  ];
  for (const s of seedSkills) {
    await prisma.skill.upsert({
      where: { id: s.id },
      update: { category: s.category, proficiency: s.proficiency },
      create: { ...s, userId: alice.id, order: 0 },
    });
  }

  await prisma.careerPreferences.upsert({
    where: { userId: alice.id },
    update: {},
    create: {
      userId: alice.id,
      targetRoles: ['Registered Nurse', 'Charge Nurse', 'Patient Educator'],
      preferredLocations: ['Newark, NJ', 'Remote'],
      workMode: 'Hybrid',
      salaryMin: 75000,
      salaryMax: 110000,
    },
  });

  const aliceJobs = [
    {
      title: 'Registered Nurse — Medical/Surgical',
      company: 'City Hospital',
      jobPostingBody:
        'Provide direct patient care on a 24-bed medical/surgical unit. Administer medications, monitor vitals, coordinate with physicians and family members. Night shift, every third weekend.',
      stage: 'Applied',
    },
    {
      title: 'Marketing Coordinator',
      company: 'BrandCo',
      jobPostingBody:
        'Coordinate multi-channel marketing campaigns, manage social media calendars, and support event logistics for a mid-sized consumer brand.',
      stage: 'Interview',
    },
    {
      title: 'Patient Educator',
      company: 'Riverside Clinic',
      jobPostingBody:
        'Develop and deliver patient education materials for chronic disease management programs. Bilingual Spanish a plus.',
      stage: 'Interested',
    },
    {
      title: 'Charge Nurse — ICU',
      company: 'Mercy Health',
      jobPostingBody:
        'Lead the night shift ICU team of 12 nurses, coordinate admissions and discharges, and serve as a clinical resource for bedside staff.',
      stage: 'Offer',
    },
    {
      title: 'Pediatric Nurse — Outpatient Clinic',
      company: 'Sunshine Pediatrics',
      jobPostingBody:
        'Provide primary care nursing for pediatric patients in a busy outpatient setting. Administer vaccines, perform triage, and educate families on chronic conditions. Day shift, no weekends.',
      stage: 'Rejected',
      outcomeNote:
        'Rejected after final round, position filled by an internal candidate with more pediatric-specific experience.',
    },
  ];

  for (const job of aliceJobs) {
    const existing = await prisma.job.findFirst({
      where: { user_id: alice.id, title: job.title, company: job.company },
    });
    if (!existing) {
      await prisma.job.create({
        data: {
          user_id: alice.id,
          title: job.title,
          company: job.company,
          jobPostingBody: job.jobPostingBody,
          stage: job.stage,
        },
      });
    }
  }

  // Pre-seed a StageTransition + JobActivity history on the Rejected job so the
  // timeline already shows a realistic progression and the C16 outcome is visible
  // on first load. Deterministic IDs make this idempotent across re-seeds.
  const rejectedJob = await prisma.job.findFirst({
    where: { user_id: alice.id, title: 'Pediatric Nurse — Outpatient Clinic' },
  });
  if (rejectedJob) {
    await prisma.stageTransition.upsert({
      where: { id: `seed-stage-${rejectedJob.id}-1` },
      update: {},
      create: {
        id: `seed-stage-${rejectedJob.id}-1`,
        job_id: rejectedJob.id,
        fromStage: 'Interested',
        toStage: 'Applied',
      },
    });
    await prisma.stageTransition.upsert({
      where: { id: `seed-stage-${rejectedJob.id}-2` },
      update: {},
      create: {
        id: `seed-stage-${rejectedJob.id}-2`,
        job_id: rejectedJob.id,
        fromStage: 'Applied',
        toStage: 'Interview',
      },
    });
    await prisma.stageTransition.upsert({
      where: { id: `seed-stage-${rejectedJob.id}-3` },
      update: {},
      create: {
        id: `seed-stage-${rejectedJob.id}-3`,
        job_id: rejectedJob.id,
        fromStage: 'Interview',
        toStage: 'Rejected',
      },
    });
    await prisma.jobActivity.upsert({
      where: { id: `seed-activity-${rejectedJob.id}-1` },
      update: {},
      create: {
        id: `seed-activity-${rejectedJob.id}-1`,
        job_id: rejectedJob.id,
        type: 'stage_change',
        note: 'Stage changed from Interested to Applied',
      },
    });
    await prisma.jobActivity.upsert({
      where: { id: `seed-activity-${rejectedJob.id}-2` },
      update: {},
      create: {
        id: `seed-activity-${rejectedJob.id}-2`,
        job_id: rejectedJob.id,
        type: 'stage_change',
        note: 'Stage changed from Applied to Interview',
      },
    });
    await prisma.jobActivity.upsert({
      where: { id: `seed-activity-${rejectedJob.id}-3` },
      update: {},
      create: {
        id: `seed-activity-${rejectedJob.id}-3`,
        job_id: rejectedJob.id,
        type: 'stage_change',
        note: 'Stage changed from Interview to Rejected',
      },
    });
  }

  const bob = await prisma.user.upsert({
    where: { email: 'bob@demo.test' },
    update: {
      password,
      is_verified: true,
      name: 'Bob Bennett',
    },
    create: {
      email: 'bob@demo.test',
      name: 'Bob Bennett',
      password,
      is_verified: true,
    },
  });

  const bobProfileData: ProfileLike = {
    firstName: 'Bob',
    lastName: 'Bennett',
    phone: '',
    location: '',
    linkedIn: '',
    summary: '',
  };
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
    where: { user_id: alice.id, title: 'Marketing Coordinator', company: 'BrandCo' },
  });

  if (marketingJob) {
    const resumeContent = `ALICE ANDERSON
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

    const coverLetterContent = `Dear Hiring Team,

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

    const resumeDoc = await prisma.document.upsert({
      where: { id: `seed-resume-${marketingJob.id}` },
      update: { title: 'Resume — Marketing Coordinator (BrandCo)' },
      create: {
        id: `seed-resume-${marketingJob.id}`,
        user_id: alice.id,
        type: 'resume',
        title: 'Resume — Marketing Coordinator (BrandCo)',
      },
    });
    const resumeVersion = await prisma.documentVersion.create({
      data: { document_id: resumeDoc.id, version_number: 1, content: resumeContent },
    });

    const coverDoc = await prisma.document.upsert({
      where: { id: `seed-cover-${marketingJob.id}` },
      update: { title: 'Cover Letter — Marketing Coordinator (BrandCo)' },
      create: {
        id: `seed-cover-${marketingJob.id}`,
        user_id: alice.id,
        type: 'cover_letter',
        title: 'Cover Letter — Marketing Coordinator (BrandCo)',
      },
    });
    const coverVersion = await prisma.documentVersion.create({
      data: { document_id: coverDoc.id, version_number: 1, content: coverLetterContent },
    });

    await prisma.jobDocumentLink.upsert({
      where: { job_id_type: { job_id: marketingJob.id, type: 'resume' } },
      update: { document_version_id: resumeVersion.id },
      create: {
        job_id: marketingJob.id,
        document_id: resumeDoc.id,
        document_version_id: resumeVersion.id,
        type: 'resume',
      },
    });
    await prisma.jobDocumentLink.upsert({
      where: { job_id_type: { job_id: marketingJob.id, type: 'cover_letter' } },
      update: { document_version_id: coverVersion.id },
      create: {
        job_id: marketingJob.id,
        document_id: coverDoc.id,
        document_version_id: coverVersion.id,
        type: 'cover_letter',
      },
    });
  }

  // Pre-seed one Interview and one FollowUp on Marketing Coordinator so the
  // timeline already has anchor rows for the C14/C15 demos. Deterministic IDs
  // make this idempotent across re-seeds.
  const marketingJobForActivity = await prisma.job.findFirst({
    where: { user_id: alice.id, title: 'Marketing Coordinator', company: 'BrandCo' },
  });

  if (marketingJobForActivity) {
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() - 2);

    await prisma.interview.upsert({
      where: { id: 'seed-interview-phone-screen-alice' },
      update: {},
      create: {
        id: 'seed-interview-phone-screen-alice',
        job_id: marketingJobForActivity.id,
        roundType: 'Phone Screen',
        date: interviewDate,
        notes: 'Initial recruiter call — confirmed interest and salary range.',
      },
    });

    const followUpDue = new Date();
    followUpDue.setDate(followUpDue.getDate() + 1);

    await prisma.followUp.upsert({
      where: { id: 'seed-followup-thank-you-alice' },
      update: {},
      create: {
        id: 'seed-followup-thank-you-alice',
        job_id: marketingJobForActivity.id,
        title: 'Send thank-you email after phone screen',
        dueDate: followUpDue,
        completed: false,
      },
    });
  }

  // Seed one deliberately STALE job so the orange "Stale" badge (7+ days since
  // updatedAt) is demo-ready on first load. Backdate updatedAt ~10 days. Stage is
  // not Rejected and the job is not archived, so isStale resolves true in
  // frontend/components/ui/job-card.tsx.
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - 10);

  const STALE_TITLE = 'Home Health Nurse';
  const STALE_COMPANY = 'CareFirst Home Health';
  let staleJob = await prisma.job.findFirst({
    where: { user_id: alice.id, title: STALE_TITLE, company: STALE_COMPANY },
  });
  if (!staleJob) {
    staleJob = await prisma.job.create({
      data: {
        user_id: alice.id,
        title: STALE_TITLE,
        company: STALE_COMPANY,
        jobPostingBody:
          'Deliver in-home nursing care to homebound patients: wound care, ' +
          'medication management, and family education. Applied two weeks ago, ' +
          'no response yet.',
        stage: 'Applied',
        updatedAt: staleDate,
      },
    });
  }
  // Guarantee the backdate regardless of Prisma @updatedAt behavior on create.
  await prisma.$executeRaw`UPDATE "Job" SET "updatedAt" = ${staleDate} WHERE id = ${staleJob.id}`;

  console.log('Seed complete:');
  console.log('  alice@demo.test / Password123');
  console.log('    - Profile: 5/5 baseline fields + 1 Experience + 1 Education + 3 Skills + CareerPreferences');
  console.log(`    - Jobs: ${aliceJobs.length + 1} (Interested, Applied, Interview, Offer, Rejected + 1 intentionally Stale)`);
  console.log('    - Rejected job has 3 seeded StageTransitions and 3 JobActivity rows');
  console.log('    - Marketing Coordinator has 1 pre-seeded Interview + 1 FollowUp + 2 AI drafts');
  console.log('  bob@demo.test   / Password123 (verified, minimal profile)');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
