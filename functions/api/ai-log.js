/** Global append-only AI audit log (KV). Sudo-only read via /var/log/ai.log in os.js */

export const AI_LOG_KV_KEY = 'global:ai.log';
const MAX_STORE_BYTES = 110_000;

export function truncate(str, max) {
  if (str == null || str === '') {
    return '';
  }
  const s = String(str);
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}… [truncated, was ${s.length} chars]`;
}

/** @param {any} env */
export async function appendAiLog(env, entry) {
  if (!env?.PORTFOLIO_OS) {
    return;
  }

  const ts = new Date().toISOString();
  const lines = [
    '────────────────────────────────────────────────────────────',
    `${ts}  source=${entry.source}  session=${entry.sessionId ?? 'anonymous'}  model=${entry.model ?? 'unknown'}`,
    `query:\n${truncate(entry.query, 4500)}`,
  ];

  if (entry.contextExcerpt) {
    lines.push(`context_excerpt:\n${truncate(entry.contextExcerpt, 4000)}`);
  }

  if (entry.error) {
    lines.push(`error:\n${truncate(entry.error, 800)}`);
  } else {
    lines.push(`response:\n${truncate(entry.response ?? '', 6500)}`);
  }

  lines.push('');

  const block = `${lines.join('\n')}\n`;

  try {
    const prev = (await env.PORTFOLIO_OS.get(AI_LOG_KV_KEY)) ?? '';
    let next = prev + block;
    if (next.length > MAX_STORE_BYTES) {
      next = next.slice(-Math.floor(MAX_STORE_BYTES * 0.92));
      next = `…[earlier entries truncated for KV size]\n\n${next}`;
    }
    await env.PORTFOLIO_OS.put(AI_LOG_KV_KEY, next);
  } catch {
    /* best-effort */
  }
}

export async function readAiLogText(env) {
  if (!env?.PORTFOLIO_OS) {
    return '(ai log unavailable: KV binding)';
  }
  const raw = await env.PORTFOLIO_OS.get(AI_LOG_KV_KEY);
  return raw && raw.length ? raw : '(no ai log entries yet)';
}
