/// <reference types="node" />
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  assertDevelopmentEnvironment,
  defaultHashPassword,
  formatSeedSummary,
  seedDemo,
  validateSeedEnvironment,
  verifySeedState,
} from '../src/lib/seed';

async function main(): Promise<void> {
  validateSeedEnvironment(process.env);

  const fingerprint = assertDevelopmentEnvironment(
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.SUPABASE_URL,
    process.env.EXPECTED_DEV_SUPABASE_PROJECT_REF,
    process.env.PRODUCTION_SUPABASE_PROJECT_REF
  );

  // Print only the database hostname and Supabase project reference so the
  // operator can verify the target without leaking credentials.
  console.log(
    `[seed] target db host=${fingerprint.hostname || '<unknown>'} supabase ref=${fingerprint.projectRef || '<unknown>'}`
  );

  const adapter = new PrismaPg({
    connectionString: process.env.DIRECT_URL!,
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const writeSummary = await seedDemo({
      prisma,
      hashPassword: defaultHashPassword,
    });
    const observedSummary = await verifySeedState(
      prisma,
      writeSummary.legacySkillsDeleted
    );

    for (const line of formatSeedSummary(observedSummary)) {
      console.log(line);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function isMainEntrypoint(): boolean {
  // Allow the file to be required as a module by tests without auto-running
  // the seed. ts-node and node set `require.main` to this module when invoked
  // as the entrypoint (e.g. `npx prisma db seed` or `ts-node prisma/seed.ts`).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mainModule = require.main as { filename?: string } | undefined;
    const entry = mainModule?.filename ?? '';
    return entry.endsWith('prisma/seed.ts') || entry.endsWith('seed.ts');
  } catch {
    return false;
  }
}

if (isMainEntrypoint()) {
  main().catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  });
}
