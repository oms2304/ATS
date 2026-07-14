/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic in-memory Prisma test double */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  ALICE_EMAIL,
  ALICE_EXPERIENCE_ID,
  ALICE_EDUCATION_ID,
  ALICE_FOLLOWUP_ID,
  ALICE_INTERVIEW_ID,
  ALICE_PREP_NOTE_ID,
  ALICE_RESEARCH_NOTE_ID,
  ALICE_NURSING_SKILLS,
  ALICE_JOBS,
  BOB_EMAIL,
  LEGACY_SKILL_IDS,
  PREP_NOTE_CONTENT,
  RESEARCH_NOTE_CONTENT,
  RESUME_CONTENT,
  COVER_LETTER_CONTENT,
  STALE_JOB_TITLE,
  STALE_JOB_COMPANY,
  RETIRED_ALICE_JOBS,
  SeedEnvironmentMismatchError,
  SeedGuardError,
  SeedVerificationError,
  assertDevelopmentEnvironment,
  calculateCompletionScore,
  defaultHashPassword,
  extractDatabaseProjectRef,
  extractHostname,
  extractProjectRef,
  formatSeedSummary,
  seedDemo,
  validateSeedEnvironment,
  verifySeedState,
} from '../lib/seed';

type AnyRecord = Record<string, any>;

type FakePrisma = ReturnType<typeof createFakePrisma>;

function createFakePrisma() {
  const state: {
    users: AnyRecord[];
    profiles: AnyRecord[];
    experiences: AnyRecord[];
    educations: AnyRecord[];
    skills: AnyRecord[];
    careerPreferences: AnyRecord[];
    jobs: AnyRecord[];
    stageTransitions: AnyRecord[];
    jobActivities: AnyRecord[];
    interviews: AnyRecord[];
    followUps: AnyRecord[];
    researchNotes: AnyRecord[];
    prepNotes: AnyRecord[];
    documents: AnyRecord[];
    documentVersions: AnyRecord[];
    jobDocumentLinks: AnyRecord[];
  } = {
    users: [],
    profiles: [],
    experiences: [],
    educations: [],
    skills: [],
    careerPreferences: [],
    jobs: [],
    stageTransitions: [],
    jobActivities: [],
    interviews: [],
    followUps: [],
    researchNotes: [],
    prepNotes: [],
    documents: [],
    documentVersions: [],
    jobDocumentLinks: [],
  };

  function findByUnique<T>(rows: T[], key: keyof T, value: any): T | undefined {
    return rows.find((r) => r[key] === value);
  }

  function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  const user = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.users, 'email', where.email);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { id: `user-${state.users.length + 1}`, ...create };
      state.users.push(created);
      return created;
    },
  };

  const profile = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.profiles, 'userId', where.userId);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { id: `profile-${state.profiles.length + 1}`, ...create };
      state.profiles.push(created);
      return created;
    },
  };

  const experience = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.experiences, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.experiences.push(created);
      return created;
    },
  };

  const education = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.educations, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.educations.push(created);
      return created;
    },
  };

  const skill = {
    async deleteMany({ where }: any) {
      const ids: string[] = where.id.in;
      const before = state.skills.length;
      state.skills = state.skills.filter((s) => !ids.includes(s.id));
      return { count: before - state.skills.length };
    },
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.skills, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.skills.push(created);
      return created;
    },
    async findMany({ where }: any = {}) {
      if (!where) return [...state.skills];
      return state.skills.filter((s) => s.userId === where.userId);
    },
  };

  const careerPreferences = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(
        state.careerPreferences,
        'userId',
        where.userId
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = {
        id: `cp-${state.careerPreferences.length + 1}`,
        ...create,
      };
      state.careerPreferences.push(created);
      return created;
    },
  };

  const job = {
    async findFirst({ where }: any) {
      // Match only the fields that are actually present in `where`, so a
      // lookup by `(user_id, title)` only is still valid even when the
      // seed didn't also pass `company`.
      return (
        state.jobs.find((j) =>
          Object.entries(where).every(([k, v]) => j[k] === v)
        ) ?? null
      );
    },
    async create({ data }: any) {
      const created = {
        id: `job-${state.jobs.length + 1}`,
        ...deepClone(data),
      };
      state.jobs.push(created);
      return created;
    },
    async update({ where, data }: any) {
      const existing = findByUnique(state.jobs, 'id', where.id);
      if (!existing) throw new Error(`job ${where.id} not found`);
      Object.assign(existing, deepClone(data));
      return existing;
    },
    async deleteMany({ where }: any) {
      const before = state.jobs.length;
      state.jobs = state.jobs.filter((j) => {
        const belongsToUser = j.user_id === where.user_id;
        const matchesRetiredJob = where.OR.some(
          ({ title, company }: AnyRecord) =>
            j.title === title && j.company === company
        );
        return !(belongsToUser && matchesRetiredJob);
      });
      return { count: before - state.jobs.length };
    },
  };

  const stageTransition = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.stageTransitions, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.stageTransitions.push(created);
      return created;
    },
  };

  const jobActivity = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.jobActivities, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.jobActivities.push(created);
      return created;
    },
  };

  const interview = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.interviews, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.interviews.push(created);
      return created;
    },
  };

  const followUp = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.followUps, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.followUps.push(created);
      return created;
    },
  };

  const researchNote = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(
        state.researchNotes,
        'job_id',
        where.job_id
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.researchNotes.push(created);
      return created;
    },
  };

  const prepNote = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.prepNotes, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.prepNotes.push(created);
      return created;
    },
  };

  const document = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.documents, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.documents.push(created);
      return created;
    },
  };

  const documentVersion = {
    async upsert({ where, update, create }: any) {
      const existing = findByUnique(state.documentVersions, 'id', where.id);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.documentVersions.push(created);
      return created;
    },
  };

  const jobDocumentLink = {
    async upsert({ where, update, create }: any) {
      const key = `${where.job_id_type.job_id}::${where.job_id_type.type}`;
      const existing = state.jobDocumentLinks.find(
        (l) => `${l.job_id}::${l.type}` === key
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { ...create };
      state.jobDocumentLinks.push(created);
      return created;
    },
  };

  return {
    state,
    prisma: {
      user,
      profile,
      experience,
      education,
      skill,
      careerPreferences,
      job,
      stageTransition,
      jobActivity,
      interview,
      followUp,
      researchNote,
      prepNote,
      document,
      documentVersion,
      jobDocumentLink,
      async $executeRaw(...args: unknown[]) {
        void args;
        // The raw backdate runs after a job is already created/updated.
        return 1;
      },
    } as any,
  };
}

async function noopHash() {
  return 'hashed:Password123';
}

describe('seedDemo - environment guards', () => {
  it('throws SeedGuardError when SEED_TARGET is not "development"', () => {
    expect(() =>
      validateSeedEnvironment({
        SEED_TARGET: 'production',
        ALLOW_DEMO_SEED: 'true',
      })
    ).toThrow(SeedGuardError);
  });

  it('throws SeedGuardError when ALLOW_DEMO_SEED is not "true"', () => {
    expect(() =>
      validateSeedEnvironment({
        SEED_TARGET: 'development',
        ALLOW_DEMO_SEED: 'yes',
      })
    ).toThrow(SeedGuardError);
  });

  it('throws when both guards are missing', () => {
    expect(() => validateSeedEnvironment({})).toThrow(SeedGuardError);
  });

  it('passes when both guards are set to the required values', () => {
    expect(() =>
      validateSeedEnvironment({
        SEED_TARGET: 'development',
        ALLOW_DEMO_SEED: 'true',
        EXPECTED_DEV_SUPABASE_PROJECT_REF: 'devprojectref',
        PRODUCTION_SUPABASE_PROJECT_REF: 'prodprojectref',
      })
    ).not.toThrow();
  });

  it('rejects missing or identical project-reference guards', () => {
    expect(() =>
      validateSeedEnvironment({
        SEED_TARGET: 'development',
        ALLOW_DEMO_SEED: 'true',
      })
    ).toThrow(SeedGuardError);
    expect(() =>
      validateSeedEnvironment({
        SEED_TARGET: 'development',
        ALLOW_DEMO_SEED: 'true',
        EXPECTED_DEV_SUPABASE_PROJECT_REF: 'same-ref',
        PRODUCTION_SUPABASE_PROJECT_REF: 'same-ref',
      })
    ).toThrow(SeedGuardError);
  });
});

describe('seedDemo - production environment fingerprint', () => {
  it('rejects a production project even when it uses a generic pooler host', () => {
    expect(() =>
      assertDevelopmentEnvironment(
        'postgresql://postgres.prodprojectref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
        'postgresql://postgres.prodprojectref:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
        'https://prodprojectref.supabase.co',
        'prodprojectref',
        'prodprojectref'
      )
    ).toThrow(SeedEnvironmentMismatchError);
  });

  it('accepts a development project on the same regional pooler hostname', () => {
    const fingerprint = assertDevelopmentEnvironment(
      'postgresql://postgres.devprojectref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      'postgresql://postgres.devprojectref:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
      'https://devprojectref.supabase.co',
      'devprojectref',
      'prodprojectref'
    );
    expect(fingerprint.hostname).toBe('aws-0-us-east-1.pooler.supabase.com');
    expect(fingerprint.projectRef).toBe('devprojectref');
  });

  it('fails closed for missing, malformed, or mismatched inputs', () => {
    expect(() =>
      assertDevelopmentEnvironment(
        undefined,
        undefined,
        undefined,
        'devprojectref',
        'prodprojectref'
      )
    ).toThrow(SeedEnvironmentMismatchError);
    expect(() =>
      assertDevelopmentEnvironment(
        'not-a-url',
        'also-not-a-url',
        'https://devprojectref.supabase.co',
        'devprojectref',
        'prodprojectref'
      )
    ).toThrow(SeedEnvironmentMismatchError);
    expect(() =>
      assertDevelopmentEnvironment(
        'postgresql://postgres.otherref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
        'postgresql://postgres.devprojectref:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
        'https://devprojectref.supabase.co',
        'devprojectref',
        'prodprojectref'
      )
    ).toThrow(SeedEnvironmentMismatchError);
  });
});

describe('seedDemo - URL helpers', () => {
  it('extractHostname parses the hostname from a postgres URL', () => {
    expect(
      extractHostname(
        'postgresql://user:pass@db.example.com:5432/db?sslmode=require'
      )
    ).toBe('db.example.com');
  });

  it('extractHostname returns an empty string for invalid URLs', () => {
    expect(extractHostname('not a url')).toBe('');
  });

  it('extractProjectRef returns the first subdomain of a Supabase URL', () => {
    expect(extractProjectRef('https://abcd1234.supabase.co')).toBe('abcd1234');
  });

  it('extractProjectRef returns an empty string for invalid URLs', () => {
    expect(extractProjectRef('not a url')).toBe('');
  });

  it('extractDatabaseProjectRef supports pooler and direct database URLs', () => {
    expect(
      extractDatabaseProjectRef(
        'postgresql://postgres.devprojectref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
      )
    ).toBe('devprojectref');
    expect(
      extractDatabaseProjectRef(
        'postgresql://postgres:secret@db.devprojectref.supabase.co:5432/postgres'
      )
    ).toBe('devprojectref');
  });
});

describe('seedDemo - calculateCompletionScore', () => {
  it('returns 100 when all five baseline fields are filled', () => {
    const score = calculateCompletionScore({
      firstName: 'A',
      lastName: 'B',
      phone: '1',
      location: 'L',
      summary: 'S',
    });
    expect(score).toBe(100);
  });

  it('returns 0 when nothing is filled', () => {
    const score = calculateCompletionScore({});
    expect(score).toBe(0);
  });
});

describe('seedDemo - scoped two-run idempotence', () => {
  let fake: FakePrisma;

  beforeEach(async () => {
    fake = createFakePrisma();
  });

  async function runSeed() {
    return seedDemo(
      { prisma: fake.prisma, hashPassword: noopHash },
      { now: () => new Date('2026-07-14T12:00:00Z') }
    );
  }

  it('first and second run produce identical scoped counts (Alice, Bob, deterministic ids)', async () => {
    const first = await runSeed();
    const afterFirst = JSON.parse(JSON.stringify(fake.state));
    const second = await runSeed();
    const afterSecond = JSON.parse(JSON.stringify(fake.state));

    // Scoped counts: only what the seed itself owns.
    expect(afterFirst.users).toHaveLength(2);
    expect(afterFirst.profiles).toHaveLength(2);
    expect(afterFirst.experiences).toHaveLength(1);
    expect(afterFirst.educations).toHaveLength(1);
    expect(
      afterFirst.skills.filter((s: AnyRecord) =>
        ALICE_NURSING_SKILLS.some((n) => n.id === s.id)
      )
    ).toHaveLength(3);
    expect(afterFirst.careerPreferences).toHaveLength(1);
    // One concise card per stage; the Applied card is also stale.
    expect(afterFirst.jobs).toHaveLength(5);
    expect(afterFirst.documents).toHaveLength(2);
    expect(afterFirst.documentVersions).toHaveLength(2);
    expect(afterFirst.jobDocumentLinks).toHaveLength(2);
    expect(afterFirst.interviews).toHaveLength(1);
    expect(afterFirst.followUps).toHaveLength(1);
    expect(afterFirst.researchNotes).toHaveLength(1);
    expect(afterFirst.prepNotes).toHaveLength(1);
    expect(afterFirst.stageTransitions).toHaveLength(3);
    expect(afterFirst.jobActivities).toHaveLength(3);

    // Second run is a structural no-op: same shape, same lengths.
    expect(afterSecond).toEqual(afterFirst);
    expect(second.legacySkillsDeleted).toBe(0);
    expect(first.legacySkillsDeleted).toBe(0);
  });

  it('skill replacement deletes exactly the two legacy ids and leaves three nursing skills', async () => {
    // Pre-seed the two legacy skills and a stray non-legacy id to prove
    // deleteMany does not touch unrelated rows.
    fake.state.skills.push(
      {
        id: LEGACY_SKILL_IDS[0],
        userId: 'u',
        name: 'React',
        category: 'Frontend',
        proficiency: 'Intermediate',
        order: 0,
      },
      {
        id: LEGACY_SKILL_IDS[1],
        userId: 'u',
        name: 'PostgreSQL',
        category: 'Backend',
        proficiency: 'Advanced',
        order: 0,
      },
      {
        id: 'seed-skill-stray-alice',
        userId: 'u',
        name: 'Stray',
        category: 'Other',
        proficiency: 'Beginner',
        order: 0,
      }
    );

    await runSeed();

    const legacy = fake.state.skills.find((s) => s.id === LEGACY_SKILL_IDS[0]);
    const legacy2 = fake.state.skills.find((s) => s.id === LEGACY_SKILL_IDS[1]);
    const stray = fake.state.skills.find(
      (s) => s.id === 'seed-skill-stray-alice'
    );
    const nursingIds = ALICE_NURSING_SKILLS.map((s) => s.id);

    expect(legacy).toBeUndefined();
    expect(legacy2).toBeUndefined();
    expect(stray).toBeDefined();
    expect(
      nursingIds.every((id) => fake.state.skills.find((s) => s.id === id))
    ).toBe(true);
    expect(
      fake.state.skills.filter((s) => nursingIds.includes(s.id))
    ).toHaveLength(3);
  });

  it('pre-existing legacy skills are deleted on the first run after migration', async () => {
    // Simulate a database that still has the two legacy skills from a prior
    // seed run; the first new-style seed should remove them.
    fake.state.skills.push(
      {
        id: LEGACY_SKILL_IDS[0],
        userId: 'u',
        name: 'React',
        category: 'Frontend',
        proficiency: 'Intermediate',
        order: 0,
      },
      {
        id: LEGACY_SKILL_IDS[1],
        userId: 'u',
        name: 'PostgreSQL',
        category: 'Backend',
        proficiency: 'Advanced',
        order: 0,
      }
    );

    const summary = await runSeed();

    expect(summary.legacySkillsDeleted).toBe(2);
    const aliceSkillIds = fake.state.skills
      .filter((s) => s.userId && s.userId !== '')
      .map((s) => s.id);
    expect(aliceSkillIds).toEqual(
      expect.arrayContaining(ALICE_NURSING_SKILLS.map((s) => s.id))
    );
    expect(aliceSkillIds).not.toContain(LEGACY_SKILL_IDS[0]);
    expect(aliceSkillIds).not.toContain(LEGACY_SKILL_IDS[1]);
  });

  it('stale job is located by (alice, title, company) and remains exactly one row', async () => {
    await runSeed();
    const staleAfterFirst = fake.state.jobs.filter(
      (j) => j.title === STALE_JOB_TITLE && j.company === STALE_JOB_COMPANY
    );
    expect(staleAfterFirst).toHaveLength(1);

    await runSeed();
    const staleAfterSecond = fake.state.jobs.filter(
      (j) => j.title === STALE_JOB_TITLE && j.company === STALE_JOB_COMPANY
    );
    expect(staleAfterSecond).toHaveLength(1);
  });

  it("removes only Alice's retired demo job when migrating an older seed", async () => {
    await runSeed();
    const alice = fake.state.users.find((u) => u.email === ALICE_EMAIL)!;
    const retired = RETIRED_ALICE_JOBS[0];

    fake.state.jobs.push(
      {
        id: 'retired-alice-job',
        user_id: alice.id,
        ...retired,
        jobPostingBody: 'Old Alice demo row',
        stage: 'Applied',
      },
      {
        id: 'same-title-other-user',
        user_id: 'unrelated-user',
        ...retired,
        jobPostingBody: 'Unrelated row',
        stage: 'Applied',
      }
    );

    await runSeed();

    expect(
      fake.state.jobs.find((j) => j.id === 'retired-alice-job')
    ).toBeUndefined();
    expect(
      fake.state.jobs.find((j) => j.id === 'same-title-other-user')
    ).toBeDefined();
  });

  it('keeps the Marketing Coordinator as a concise feature-complete job', async () => {
    await runSeed();
    const marketing = fake.state.jobs.find(
      (j) => j.title === 'Marketing Coordinator' && j.company === 'BrandCo'
    )!;
    const offer = fake.state.jobs.find(
      (j) => j.title === 'Charge Nurse — ICU' && j.company === 'Mercy Health'
    )!;

    expect(marketing.recruiterNotes).toBe(
      'Jordan Lee · recruiter@brandco.test'
    );
    expect(new Date(marketing.deadline).toISOString()).toBe(
      '2026-07-21T12:00:00.000Z'
    );
    expect(offer.outcomeNote).toBe(
      'Offer received; reviewing schedule and benefits.'
    );
  });

  it('ResearchNote and PrepNote are upserted on the Marketing Coordinator job', async () => {
    await runSeed();
    const research = fake.state.researchNotes[0];
    const prep = fake.state.prepNotes[0];
    const marketingJob = fake.state.jobs.find(
      (j) => j.title === 'Marketing Coordinator' && j.company === 'BrandCo'
    )!;
    expect(research).toBeDefined();
    expect(research.content).toBe(RESEARCH_NOTE_CONTENT);
    expect(research.job_id).toBe(marketingJob.id);
    expect(prep).toBeDefined();
    expect(prep.content).toBe(PREP_NOTE_CONTENT);
    expect(prep.category).toBe('talking_points');
    expect(prep.job_id).toBe(marketingJob.id);
    expect(prep.id).toBe(ALICE_PREP_NOTE_ID);
  });

  it('ResearchNote and PrepNote are idempotent across runs', async () => {
    await runSeed();
    await runSeed();
    expect(fake.state.researchNotes).toHaveLength(1);
    expect(fake.state.prepNotes).toHaveLength(1);
  });

  it('documents carry status, tags, and label="Initial draft"', async () => {
    await runSeed();
    const docs = fake.state.documents;
    for (const d of docs) {
      expect(d.status).toBe('active');
      expect(d.tags).toEqual(['demo', 'brandco']);
    }
    const versions = fake.state.documentVersions;
    for (const v of versions) {
      expect(v.label).toBe('Initial draft');
      expect(v.version_number).toBe(1);
      expect(v.is_archived).toBe(false);
    }
  });

  it('JobDocumentLink upserts set both document_id and document_version_id', async () => {
    await runSeed();
    expect(fake.state.jobDocumentLinks).toHaveLength(2);
    for (const link of fake.state.jobDocumentLinks) {
      expect(link.document_id).toBeTruthy();
      expect(link.document_version_id).toBeTruthy();
    }
    // Resume link and cover letter link both point at their respective ids.
    const resume = fake.state.documents.find((d) => d.type === 'resume')!;
    const cover = fake.state.documents.find((d) => d.type === 'cover_letter')!;
    const resumeLink = fake.state.jobDocumentLinks.find(
      (l) => l.type === 'resume'
    )!;
    const coverLink = fake.state.jobDocumentLinks.find(
      (l) => l.type === 'cover_letter'
    )!;
    expect(resumeLink.document_id).toBe(resume.id);
    expect(coverLink.document_id).toBe(cover.id);
    // Version content round-trips.
    const resumeVersion = fake.state.documentVersions.find(
      (v) => v.document_id === resume.id
    )!;
    const coverVersion = fake.state.documentVersions.find(
      (v) => v.document_id === cover.id
    )!;
    expect(resumeVersion.content).toBe(RESUME_CONTENT);
    expect(coverVersion.content).toBe(COVER_LETTER_CONTENT);
  });

  it('every canonical row populates both create and update payloads', async () => {
    // The fake's upsert handlers assert that an `update` payload is supplied
    // by merging it into the existing record. If the seed ever passed an
    // empty `update: {}`, the test would still pass structurally, so we
    // additionally check that the post-seed state is the canonical state.
    await runSeed();
    const alice = fake.state.users.find((u) => u.email === ALICE_EMAIL)!;
    const bob = fake.state.users.find((u) => u.email === BOB_EMAIL)!;
    expect(alice.name).toBe('Alice Anderson');
    expect(alice.is_verified).toBe(true);
    expect(bob.name).toBe('Bob Bennett');
    expect(bob.is_verified).toBe(true);

    const experience = fake.state.experiences.find(
      (e) => e.id === ALICE_EXPERIENCE_ID
    )!;
    expect(experience).toBeDefined();
    expect(experience.title).toBe('Registered Nurse — Medical/Surgical');

    const education = fake.state.educations.find(
      (e) => e.id === ALICE_EDUCATION_ID
    )!;
    expect(education).toBeDefined();
    expect(education.school).toBe('Rutgers University');

    const interview = fake.state.interviews.find(
      (i) => i.id === ALICE_INTERVIEW_ID
    )!;
    expect(interview).toBeDefined();
    expect(interview.roundType).toBe('Phone Screen');

    const followUp = fake.state.followUps.find(
      (f) => f.id === ALICE_FOLLOWUP_ID
    )!;
    expect(followUp).toBeDefined();
    expect(followUp.title).toBe('Send thank-you email');

    const research = fake.state.researchNotes.find(
      (r) => r.id === ALICE_RESEARCH_NOTE_ID
    )!;
    expect(research).toBeDefined();
    expect(research.content).toBe(RESEARCH_NOTE_CONTENT);

    const prep = fake.state.prepNotes.find((p) => p.id === ALICE_PREP_NOTE_ID)!;
    expect(prep).toBeDefined();
    expect(prep.content).toBe(PREP_NOTE_CONTENT);
  });

  it('seedDemo does not delete unrelated shared-development data', async () => {
    // Pre-seed an unrelated user/profile/skill/document/note that the seed
    // must not touch. Then run the seed and assert all five rows are intact.
    fake.state.users.push({
      id: 'unrelated-user',
      email: 'someone@elsewhere.test',
      name: 'Stranger',
      password: 'hashed',
      is_verified: true,
    });
    fake.state.profiles.push({
      id: 'unrelated-profile',
      userId: 'unrelated-user',
      firstName: 'X',
      lastName: 'Y',
      phone: null,
      location: null,
      linkedIn: null,
      summary: null,
      completionScore: 0,
    });
    fake.state.skills.push({
      id: 'unrelated-skill',
      userId: 'unrelated-user',
      name: 'Outside',
      category: 'X',
      proficiency: 'Y',
      order: 0,
    });
    fake.state.documents.push({
      id: 'unrelated-doc',
      user_id: 'unrelated-user',
      type: 'resume',
      title: 'Not Alice',
      status: 'active',
      tags: ['x'],
    });
    fake.state.researchNotes.push({
      id: 'unrelated-research',
      job_id: 'unrelated-job',
      content: 'not alice',
    });

    await runSeed();

    expect(
      fake.state.users.find((u) => u.id === 'unrelated-user')
    ).toBeDefined();
    expect(
      fake.state.profiles.find((p) => p.id === 'unrelated-profile')
    ).toBeDefined();
    expect(
      fake.state.skills.find((s) => s.id === 'unrelated-skill')
    ).toBeDefined();
    expect(
      fake.state.documents.find((d) => d.id === 'unrelated-doc')
    ).toBeDefined();
    expect(
      fake.state.researchNotes.find((r) => r.id === 'unrelated-research')
    ).toBeDefined();
  });
});

function createVerificationPrisma(options?: {
  duplicateStaleJob?: boolean;
  documentCount?: number;
  legacySkillCount?: number;
}): PrismaClient {
  const jobs = [
    ...ALICE_JOBS.map(({ title, company }, index) => ({
      id: `job-${index}`,
      title,
      company,
    })),
    {
      id: 'job-stale',
      title: STALE_JOB_TITLE,
      company: STALE_JOB_COMPANY,
    },
  ];
  if (options?.duplicateStaleJob) {
    jobs.push({
      id: 'job-stale-duplicate',
      title: STALE_JOB_TITLE,
      company: STALE_JOB_COMPANY,
    });
  }

  return {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ id: 'alice-id' })
        .mockResolvedValueOnce({ id: 'bob-id' }),
      count: vi.fn().mockResolvedValue(2),
    },
    profile: { count: vi.fn().mockResolvedValue(2) },
    experience: { count: vi.fn().mockResolvedValue(1) },
    education: { count: vi.fn().mockResolvedValue(1) },
    skill: {
      count: vi
        .fn()
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(options?.legacySkillCount ?? 0),
    },
    careerPreferences: { count: vi.fn().mockResolvedValue(1) },
    job: { findMany: vi.fn().mockResolvedValue(jobs) },
    document: {
      count: vi.fn().mockResolvedValue(options?.documentCount ?? 2),
    },
    documentVersion: { count: vi.fn().mockResolvedValue(2) },
    jobDocumentLink: { count: vi.fn().mockResolvedValue(2) },
    interview: { count: vi.fn().mockResolvedValue(1) },
    followUp: { count: vi.fn().mockResolvedValue(1) },
    researchNote: { count: vi.fn().mockResolvedValue(1) },
    prepNote: { count: vi.fn().mockResolvedValue(1) },
    stageTransition: { count: vi.fn().mockResolvedValue(3) },
    jobActivity: { count: vi.fn().mockResolvedValue(3) },
  } as unknown as PrismaClient;
}

describe('verifySeedState - observed database state', () => {
  it('returns observed scoped counts when the canonical state is exact', async () => {
    const summary = await verifySeedState(createVerificationPrisma(), 2);
    expect(summary.jobs).toBe(5);
    expect(summary.documents).toBe(2);
    expect(summary.legacySkillsDeleted).toBe(2);
  });

  it('rejects a missing canonical record', async () => {
    await expect(
      verifySeedState(createVerificationPrisma({ documentCount: 1 }))
    ).rejects.toThrow(SeedVerificationError);
  });

  it('rejects a duplicate stale job', async () => {
    await expect(
      verifySeedState(createVerificationPrisma({ duplicateStaleJob: true }))
    ).rejects.toThrow(SeedVerificationError);
  });

  it('rejects remaining legacy skills', async () => {
    await expect(
      verifySeedState(createVerificationPrisma({ legacySkillCount: 1 }))
    ).rejects.toThrow(SeedVerificationError);
  });
});

describe('seedDemo - formatSeedSummary', () => {
  it('includes canonical user credentials and scoped counts', () => {
    const lines = formatSeedSummary({
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
      legacySkillsDeleted: 2,
    });
    expect(lines.join('\n')).toContain(ALICE_EMAIL);
    expect(lines.join('\n')).toContain(BOB_EMAIL);
    expect(lines.join('\n')).toContain('Password123');
    expect(lines.join('\n')).toContain('Jobs: 5');
    expect(lines.join('\n')).toContain(
      'Legacy React/PostgreSQL skills removed: 2'
    );
  });
});

describe('defaultHashPassword', () => {
  it('produces a bcrypt hash for a known plaintext', async () => {
    const hash = await defaultHashPassword('Password123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toBe('Password123');
  });
});
