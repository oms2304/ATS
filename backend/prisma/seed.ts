/// <reference types="node" />
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
});

const prisma = new PrismaClient({ adapter });

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

function calculateCompletionScore(profile: ProfileLike): number {
  const completed = BASELINE_FIELDS.filter(
    (field) =>
      profile[field] !== null &&
      profile[field] !== undefined &&
      profile[field] !== ''
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
    {
      id: 'seed-skill-react-alice',
      name: 'React',
      category: 'Frontend',
      proficiency: 'Intermediate',
    },
    {
      id: 'seed-skill-postgres-alice',
      name: 'PostgreSQL',
      category: 'Backend',
      proficiency: 'Advanced',
    },
    {
      id: 'seed-skill-triage-alice',
      name: 'Patient Triage',
      category: 'Clinical',
      proficiency: 'Expert',
    },
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
    where: {
      user_id: alice.id,
      title: 'Marketing Coordinator',
      company: 'BrandCo',
    },
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
      data: {
        document_id: resumeDoc.id,
        version_number: 1,
        content: resumeContent,
      },
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
      data: {
        document_id: coverDoc.id,
        version_number: 1,
        content: coverLetterContent,
      },
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
    where: {
      user_id: alice.id,
      title: 'Marketing Coordinator',
      company: 'BrandCo',
    },
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
        jobPostingBody: `Position: Home Health Nurse
Schedule: Full-time field-based role

CareFirst Home Health is seeking a Registered Nurse to deliver skilled, compassionate care to homebound patients in their residences. The Home Health Nurse manages an assigned caseload and works independently in the field while maintaining close communication with physicians, therapists, care coordinators, patients, and family caregivers.

The nurse completes comprehensive assessments; develops and updates individualized plans of care; provides wound care, medication management, disease monitoring, and patient education; and recognizes changes that require escalation. The role includes documenting each visit in the electronic health record, coordinating services with the interdisciplinary team, reinforcing safety and self-management guidance, and helping patients and families understand medications, warning signs, and follow-up instructions.

Successful candidates are comfortable working autonomously, organizing travel and visit schedules, building rapport in patients’ homes, and applying sound clinical judgment. Experience with home health, care coordination, chronic disease management, wound care, and family education is especially valuable.`,
        stage: 'Applied',
        updatedAt: staleDate,
      },
    });
  }
  // Guarantee the backdate regardless of Prisma @updatedAt behavior on create.
  await prisma.$executeRaw`UPDATE "Job" SET "updatedAt" = ${staleDate} WHERE id = ${staleJob.id}`;

  console.log('Seed complete:');
  console.log('  alice@demo.test / Password123');
  console.log(
    '    - Profile: 5/5 baseline fields + 1 Experience + 1 Education + 3 Skills + CareerPreferences'
  );
  console.log(
    `    - Jobs: ${aliceJobs.length + 1} (Interested, Applied, Interview, Offer, Rejected + 1 intentionally Stale)`
  );
  console.log(
    '    - Rejected job has 3 seeded StageTransitions and 3 JobActivity rows'
  );
  console.log(
    '    - Marketing Coordinator has 1 pre-seeded Interview + 1 FollowUp + 2 AI drafts'
  );
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
