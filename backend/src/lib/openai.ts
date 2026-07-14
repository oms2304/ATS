import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY;
const isOpenRouter = !!apiKey && apiKey.startsWith('sk-or-');

let client: OpenAI | undefined;
let clientApiKey: string | undefined;

export function getOpenAIClient() {
  const currentApiKey =
    process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!currentApiKey) {
    throw new Error('AI provider is not configured');
  }

  if (!client || clientApiKey !== currentApiKey) {
    client = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentApiKey.startsWith('sk-or-')
        ? 'https://openrouter.ai/api/v1'
        : undefined,
      timeout: 45_000,
      maxRetries: 1,
    });
    clientApiKey = currentApiKey;
  }

  return client;
}

export const AI_MODEL =
  process.env.AI_MODEL ?? (isOpenRouter ? 'openai/gpt-4o' : 'gpt-4o');

export const RESUME_MODEL = AI_MODEL;
export const COVER_LETTER_MODEL = AI_MODEL;

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY);
}
