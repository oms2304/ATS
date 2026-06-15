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

  console.log('Seed complete:');
  console.log(`  alice@demo.test / Password123 (verified, full profile, ${aliceJobs.length} jobs)`);
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
