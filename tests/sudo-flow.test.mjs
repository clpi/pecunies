import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost as onOsRequestPost } from '../functions/api/os.js';

function createKvStore() {
  const store = new Map();
  return {
    async get(key, opts = {}) {
      if (!store.has(key)) return null;
      const value = store.get(key);
      if (opts?.type === 'json') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '' } = {}) {
      const keys = Array.from(store.keys())
        .filter((name) => name.startsWith(prefix))
        .sort()
        .map((name) => ({ name }));
      return { keys, cursor: undefined };
    },
  };
}

async function runOsCommand(env, command, sessionId = 'sudo-test-session') {
  const request = new Request('https://pecunies.local/api/os', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, command }),
  });
  const response = await onOsRequestPost({ request, env });
  const payload = await response.json();
  return { response, payload };
}

test('sudo prompts for six-letter commands instead of treating them as passwords', async () => {
  const env = {
    PORTFOLIO_OS: createKvStore(),
    PECUNIES_SUDO_PASSWD: 'PECUnies797++',
  };

  const { response, payload } = await runOsCommand(env, 'sudo delete foo');

  assert.equal(response.status, 200);
  assert.equal(payload.output, '[sudo] password for guest:');
});

test('inline sudo password still works when it matches the configured password', async () => {
  const env = {
    PORTFOLIO_OS: createKvStore(),
    PECUNIES_SUDO_PASSWD: 'PECUnies797++',
  };

  const { response, payload } = await runOsCommand(
    env,
    'sudo PECUnies797++ ls /etc',
  );

  assert.equal(response.status, 200);
  assert.match(String(payload.output), /themes\//);
});

test('sudo history keeps the command name when auth is prompted separately', async () => {
  const env = {
    PORTFOLIO_OS: createKvStore(),
    PECUNIES_SUDO_PASSWD: 'PECUnies797++',
  };

  await runOsCommand(env, 'sudo ls /etc', 'sudo-history-session');
  await runOsCommand(env, 'PECUnies797++', 'sudo-history-session');
  const history = await runOsCommand(env, 'history', 'sudo-history-session');

  assert.equal(history.response.status, 200);
  assert.match(String(history.payload.output), /sudo ls \/etc/);
  assert.doesNotMatch(String(history.payload.output), /sudo \*{8} \/etc/);
});
