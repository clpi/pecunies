import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost as onOsRequestPost } from '../functions/api/os.js';

function createKvStore() {
  const store = new Map();
  return {
    store,
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

async function runOsCommand(env, command, sessionId = 'test-session') {
  const request = new Request('https://pecunies.local/api/os', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, command }),
  });
  const response = await onOsRequestPost({ request, env });
  const payload = await response.json();
  return { response, payload };
}

test('new post supports quoted flags and markdown body', async () => {
  const env = {
    PORTFOLIO_OS: createKvStore(),
    PECUNIES_SUDO_PASSWD: 'test-pass',
  };
  const body = 'This is a markdown **test** __article__.';
  const cmd = `sudo test-pass new post --title="Markdown test" --tags="markdown,syntax,code,render" --description="A markdown test article" "${body}"`;
  const { response, payload } = await runOsCommand(env, cmd, 'quoted-session');

  assert.equal(response.status, 200);
  assert.match(payload.output, /^created \/posts\/\d{4}\/\d{2}\/\d{2}\/markdown-test\.md/m);

  const createdPath = payload.output.split('\n')[0].replace(/^created\s+/, '').trim();
  const markdown = await env.PORTFOLIO_OS.get(`file:${createdPath}`);
  assert.ok(markdown);
  assert.match(markdown, /title: "Markdown test"/);
  assert.match(markdown, /tags: markdown, syntax, code, render/);
  assert.match(markdown, /description: "A markdown test article"/);
  assert.match(markdown, /This is a markdown \*\*test\*\* __article__\./);
});

test('new post requires description', async () => {
  const env = {
    PORTFOLIO_OS: createKvStore(),
    PECUNIES_SUDO_PASSWD: 'test-pass',
  };
  const cmd = 'sudo test-pass new post --title="Missing Description" --tags="markdown,syntax" "Body only."';
  const { response, payload } = await runOsCommand(env, cmd, 'missing-description-session');

  assert.equal(response.status, 400);
  assert.equal(payload.output, 'new post: --description= is required');
});

test('new post creates deterministic duplicate slug suffix', async () => {
  const env = {
    PORTFOLIO_OS: createKvStore(),
    PECUNIES_SUDO_PASSWD: 'test-pass',
  };
  const first = await runOsCommand(
    env,
    'sudo test-pass new post --title="Duplicate Slug" --tags="markdown,syntax" --description="First" "Body one."',
    'duplicate-session',
  );
  const second = await runOsCommand(
    env,
    'sudo test-pass new post --title="Duplicate Slug" --tags="markdown,syntax" --description="Second" "Body two."',
    'duplicate-session',
  );

  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.match(first.payload.output, /\/duplicate-slug\.md/);
  assert.match(second.payload.output, /\/duplicate-slug-2\.md/);
});

test('new post denies unauthorized create with clear admin gate message', async () => {
  const env = {
    PORTFOLIO_OS: createKvStore(),
  };
  const cmd =
    'new post --title="Unauthorized" --tags="markdown,syntax" --description="Auth check" "Body content."';
  const { response, payload } = await runOsCommand(env, cmd, 'unauthorized-session');

  assert.equal(response.status, 403);
  assert.match(payload.output, /admin mode required for \/posts writes/i);
  assert.match(payload.output, /sudo new post/i);
});
