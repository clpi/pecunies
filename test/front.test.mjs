import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { frontView } from '../src/front-routes.ts';

test('default Posts, two filters, About / Contact, and legacy deep links', () => {
  for (const p of ['/', '/posts', '/posts/', '/index.html']) assert.equal(frontView(p), 'posts');
  for (const p of ['/papers', '/papers/']) assert.equal(frontView(p), 'papers');
  for (const p of ['/about', '/contact', '/contact/']) assert.equal(frontView(p), 'about');
  for (const p of ['/post/example', '/projects', '/resume', '/api/posts']) assert.equal(frontView(p), 'legacy');
});

test('empty publication lists and link-only About surface', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/<nav /g) || []).length, 2);
  assert.match(html, /id="papers-list" aria-label="Generated papers" hidden><\/ul>/);
  assert.match(html, /id="posts-list" aria-label="Handwritten posts"><\/ul>/);
  const about = html.match(/<section id="about-view"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(about, /<p\b/);
  assert.equal((about.match(/<a /g) || []).length, 2);
});
