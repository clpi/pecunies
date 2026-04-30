import { assetPathToPostPath, deletePostFromStorage, postPathToAssetPath, syncPostToStorage } from './posts.js';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function unauthorized() {
  return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: jsonHeaders });
}

function validateToken(request, env) {
  const expected = String(env.POSTS_SYNC_TOKEN || '').trim();
  if (!expected) {
    return false;
  }
  const authHeader = String(request.headers.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return token && token === expected;
}

export async function onRequestPost({ request, env }) {
  if (!validateToken(request, env)) {
    return unauthorized();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400, headers: jsonHeaders });
  }

  const inputPosts = Array.isArray(body?.posts) ? body.posts : [];
  const prune = body?.prune === true;
  const canonicalMap = new Map();
  for (const item of inputPosts) {
    const rawPath = String(item?.path || '').trim();
    const markdown = String(item?.markdown || '');
    const canonicalPath = assetPathToPostPath(rawPath);
    if (!canonicalPath.startsWith('/posts/') || !canonicalPath.toLowerCase().endsWith('.md')) {
      continue;
    }
    canonicalMap.set(canonicalPath, markdown);
  }

  const synced = [];
  for (const [canonicalPath, markdown] of canonicalMap.entries()) {
    if (env.PORTFOLIO_OS) {
      const assetPath = postPathToAssetPath(canonicalPath);
      await env.PORTFOLIO_OS.put(`file:${canonicalPath}`, markdown);
      await env.PORTFOLIO_OS.put(`file:${assetPath}`, markdown);
    }
    await syncPostToStorage(env, canonicalPath, markdown);
    synced.push(canonicalPath);
  }

  let removed = [];
  if (prune && env.POSTS_DB) {
    const rows = await env.POSTS_DB.prepare('SELECT path FROM posts').all();
    const existing = Array.isArray(rows?.results) ? rows.results : [];
    for (const row of existing) {
      const existingPath = String(row?.path || '');
      if (existingPath.startsWith('/posts/') && !canonicalMap.has(existingPath)) {
        await deletePostFromStorage(env, existingPath);
        removed.push(existingPath);
      }
    }
  }

  return Response.json(
    {
      ok: true,
      syncedCount: synced.length,
      removedCount: removed.length,
      synced,
      removed,
    },
    { headers: jsonHeaders },
  );
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}
