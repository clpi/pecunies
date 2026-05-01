/**
 * Curated text/chat models for the session identity picker.
 * Keep in sync with `functions/api/ai-models.js` (WORKERS_AI_TEXT_MODELS).
 */
export const DEFAULT_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export const WORKERS_AI_TEXT_MODELS = [
  DEFAULT_AI_MODEL,
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/mistralai/mistral-7b-instruct-v0.1',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/google/gemma-3-12b-it',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen1.5-14b-chat-awq',
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/qwen/qwen2.5-32b-instruct',
  '@cf/qwen/qwen2.5-72b-instruct',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/qwen/qwq-32b',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/openai/gpt-oss-20b',
  '@cf/openai/gpt-oss-120b',
  '@cf/microsoft/phi-2',
  '@cf/nvidia/nemotron-3-120b-a12b',
  '@cf/ibm-granite/granite-4.0-h-micro',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/moonshotai/kimi-k2.5',
  '@cf/moonshotai/kimi-k2.6',
  '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
  '@hf/nousresearch/hermes-2-pro-mistral-7b',
] as const;

/**
 * Models that may emit visible reasoning/thinking traces in chat.
 * Only these show the expandable “thinking” strip under AI replies; plain instruct models do not.
 */
export const WORKERS_AI_THINKING_STYLE_MODEL_IDS: ReadonlySet<string> = new Set([
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/qwen/qwq-32b',
]);

export function workersAiModelShowsThinkingExpandable(model: string | undefined): boolean {
  if (!model || typeof model !== 'string') return false;
  return WORKERS_AI_THINKING_STYLE_MODEL_IDS.has(model.trim());
}

export function formatWorkersAiModelLabel(model: string | undefined): string {
  const raw = String(model || '').trim();
  if (!raw) return '';
  const tail = raw.split('/').pop() || raw;
  const cleaned = tail
    .split('-')
    .map((part) => {
      const token = part.trim().toLowerCase();
      return /^[a-z]+\d+(\.\d+)*$/i.test(token) ? token.replace(/\d.*$/g, '') : token;
    })
    .filter((token) => {
      if (!token) return false;
      if (/^\d+(\.\d+)*$/.test(token)) return false;
      if (/^\d+(\.\d+)?[bm]$/.test(token)) return false;
      if (/^a\d+b$/.test(token)) return false;
      if (/^fp\d+$/.test(token)) return false;
      if (/^v\d+(\.\d+)*$/.test(token)) return false;
      if (['instruct', 'chat', 'it', 'awq', 'fast', 'distill', 'micro'].includes(token)) return false;
      if (token.length < 2) return false;
      return true;
    })
    .join(' ')
    .trim();
  const label = cleaned || tail;
  return label
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Accept Workers AI / Workers AI Hugging Face gateway model ids (not a guarantee the account has access). */
export function isValidWorkersAiModelId(model: string): boolean {
  if (typeof model !== 'string') return false;
  const value = model.trim();
  return /^@(cf|hf)\/[a-z0-9._-]+\/[a-z0-9._:-]+$/iu.test(value);
}
