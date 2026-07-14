import { describe, expect, it } from 'vitest';
import { validateStartupEnvironment } from '../lib/env';

describe('startup environment validation', () => {
  const valid = {
    DATABASE_URL: 'postgresql://localhost:5432/ats',
    JWT_SECRET: 'test-secret',
    FRONTEND_URL: 'http://localhost:3000',
  };

  it('accepts only the runtime variables required to boot the API', () => {
    expect(validateStartupEnvironment(valid)).toEqual(valid);
  });

  it('does not require migration, storage, AI, or email variables at boot', () => {
    expect(() => validateStartupEnvironment(valid)).not.toThrow();
  });

  it('reports missing variable names without values', () => {
    expect(() =>
      validateStartupEnvironment({ FRONTEND_URL: 'http://localhost:3000' })
    ).toThrow('DATABASE_URL, JWT_SECRET');
  });

  it('rejects an invalid frontend URL by variable name', () => {
    expect(() =>
      validateStartupEnvironment({ ...valid, FRONTEND_URL: 'not-a-url' })
    ).toThrow('FRONTEND_URL');
  });

  describe('in production', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      RESEND_API_KEY: 'resend-key',
      OPENAI_API_KEY: 'openai-key',
    };

    const without = (...names: string[]) => {
      const partial: Record<string, string> = { ...production };
      for (const name of names) delete partial[name];
      return partial;
    };

    it('accepts a fully configured production environment', () => {
      expect(() => validateStartupEnvironment(production)).not.toThrow();
    });

    it('requires storage and email configuration', () => {
      expect(() =>
        validateStartupEnvironment(
          without('SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY')
        )
      ).toThrow('SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY');
    });

    it('accepts OpenRouter as the sole AI provider', () => {
      expect(() =>
        validateStartupEnvironment({
          ...without('OPENAI_API_KEY'),
          OPENROUTER_API_KEY: 'openrouter-key',
        })
      ).not.toThrow();
    });

    it('requires at least one AI provider key', () => {
      expect(() =>
        validateStartupEnvironment(without('OPENAI_API_KEY'))
      ).toThrow('OPENAI_API_KEY or OPENROUTER_API_KEY');
    });

    it('never includes secret values in the failure message', () => {
      expect(() => validateStartupEnvironment(without('SUPABASE_URL'))).toThrow(
        /^Missing or invalid environment variables: SUPABASE_URL$/
      );
    });
  });
});
