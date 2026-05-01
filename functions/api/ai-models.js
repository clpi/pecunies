/**
 * Curated text/chat models for docs and parity with the terminal picker.
 * Keep in sync with `src/terminal/ai-models.ts` (WORKERS_AI_TEXT_MODELS).
 */
export const DEFAULT_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export const WORKERS_AI_TEXT_MODELS = [
  DEFAULT_AI_MODEL,
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-70b-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/mistralai/mistral-7b-instruct-v0.1",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/google/gemma-3-12b-it",
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/qwen/qwen1.5-14b-chat-awq",
  "@cf/qwen/qwen2.5-coder-32b-instruct",
  "@cf/qwen/qwen2.5-32b-instruct",
  "@cf/qwen/qwen2.5-72b-instruct",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/qwen/qwq-32b",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/openai/gpt-oss-20b",
  "@cf/openai/gpt-oss-120b",
  "@cf/microsoft/phi-2",
  "@cf/nvidia/nemotron-3-120b-a12b",
  "@cf/ibm-granite/granite-4.0-h-micro",
  "@cf/zai-org/glm-4.7-flash",
  "@cf/moonshotai/kimi-k2.5",
  "@cf/moonshotai/kimi-k2.6",
  "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
  "@hf/nousresearch/hermes-2-pro-mistral-7b",
];

/** @see `src/terminal/ai-models.ts` — models that may show reasoning; keep lists in sync. */
export const WORKERS_AI_THINKING_STYLE_MODEL_IDS = new Set([
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/qwen/qwq-32b",
]);

export function workersAiModelShowsThinkingExpandable(model) {
  if (typeof model !== "string") return false;
  return WORKERS_AI_THINKING_STYLE_MODEL_IDS.has(model.trim());
}

export function isValidWorkersAiModelId(model) {
  if (typeof model !== "string") return false;
  const value = model.trim();
  return /^@(cf|hf)\/[a-z0-9._-]+\/[a-z0-9._:-]+$/iu.test(value);
}

export function resolveChatModel(requested, configured, fallback) {
  const fb = String(fallback || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL;
  if (isValidWorkersAiModelId(requested)) return requested.trim();
  if (isValidWorkersAiModelId(configured)) return configured.trim();
  return isValidWorkersAiModelId(fb) ? fb : DEFAULT_AI_MODEL;
}
