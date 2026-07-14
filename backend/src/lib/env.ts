import { z } from 'zod';

const startupEnvironmentSchema = z.object({
  DATABASE_URL: z.string().trim().min(1),
  JWT_SECRET: z.string().trim().min(1),
  FRONTEND_URL: z.string().trim().url(),
});

export type StartupEnvironment = z.infer<typeof startupEnvironmentSchema>;

// Storage, email, and a model provider are only hard requirements in production.
// Leaving them optional elsewhere lets tests and local runs boot without live
// credentials, which the rest of the code already degrades gracefully without.
const PRODUCTION_REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
] as const;

const AI_PROVIDER_KEYS = ['OPENAI_API_KEY', 'OPENROUTER_API_KEY'] as const;

export function validateStartupEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): StartupEnvironment {
  const parsed = startupEnvironmentSchema.safeParse(environment);

  // Only ever collect variable names -- values must never reach the logs.
  const missing = new Set<string>();
  if (!parsed.success) {
    for (const issue of parsed.error.issues) missing.add(String(issue.path[0]));
  }

  if (environment.NODE_ENV === 'production') {
    for (const name of PRODUCTION_REQUIRED) {
      if (!environment[name]?.trim()) missing.add(name);
    }
    if (!AI_PROVIDER_KEYS.some((name) => environment[name]?.trim())) {
      missing.add(AI_PROVIDER_KEYS.join(' or '));
    }
  }

  if (parsed.success && missing.size === 0) return parsed.data;

  throw new Error(
    `Missing or invalid environment variables: ${[...missing].join(', ')}`
  );
}
