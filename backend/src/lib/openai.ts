import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY;
const isOpenRouter = !!apiKey && apiKey.startsWith('sk-or-');

export const openai = new OpenAI({
  apiKey,
  baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
  timeout: 45_000,
  maxRetries: 1,
});

export const AI_MODEL =
  process.env.AI_MODEL ?? (isOpenRouter ? 'openai/gpt-4o' : 'gpt-4o');

export const RESUME_MODEL = AI_MODEL;
export const COVER_LETTER_MODEL = AI_MODEL;

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY);
}
