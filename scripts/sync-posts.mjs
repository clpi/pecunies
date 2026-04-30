import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const assetsRoot = path.join(repoRoot, 'assets', 'posts');
const endpoint = process.env.POST_SYNC_ENDPOINT;
const token = process.env.POST_SYNC_TOKEN;

if (!endpoint || !token) {
  console.error('Missing POST_SYNC_ENDPOINT or POST_SYNC_TOKEN environment variables.');
  process.exit(1);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(abs)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(abs);
    }
  }
  return files;
}

function toAssetPath(absPath) {
  const rel = path.relative(repoRoot, absPath).split(path.sep).join('/');
  return `/${rel}`;
}

async function main() {
  const files = await walk(assetsRoot);
  const posts = [];
  for (const file of files) {
    posts.push({
      path: toAssetPath(file),
      markdown: await readFile(file, 'utf8'),
    });
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ posts, prune: true }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`Sync failed (${res.status}):`, data ?? '(no response body)');
    process.exit(1);
  }
  console.log(`Synced ${data?.syncedCount ?? posts.length} posts. Removed ${data?.removedCount ?? 0}.`);
}

await main();
