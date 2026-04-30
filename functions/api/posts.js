const STATIC_ASSET_POSTS = {
  '/assets/posts/2026/04/29/terminal-portfolio-changelog.md': `---
title: Terminal Portfolio Changelog
date: 2026-04-29
tags: writing, content, terminal
description: Changelog and notes for the terminal-native portfolio writing system.
---

# Terminal Portfolio Changelog

Initial post placeholder for the terminal-native writing system. Posts are markdown files under \`/posts\`; creating, editing, or removing them requires sudo privileges.`,
};

export function assetPathToPostPath(path) {
  const normalized = String(path || '').trim();
  return normalized.startsWith('/assets/posts/') ? normalized.replace(/^\/assets/, '') : normalized;
}

export function postPathToAssetPath(path) {
  const normalized = String(path || '').trim();
  return normalized.startsWith('/posts/') ? `/assets${normalized}` : normalized;
}

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const R2_POST_PREFIX = 'posts/markdown';
const R2_ASSET_PREFIX = 'posts/assets';
const R2_SNAPSHOT_PREFIX = 'posts/snapshots';

function postsDb(env) {
  return env.POSTS_DB || env.DB || null;
}

function postsBucket(env) {
  return env.POSTS_BUCKET || env.POSTS || null;
}

/**
 * Parse optional YAML-like frontmatter (--- blocks).
 * @returns {{ body: string, meta: Record<string, string> }}
 */
export function parseFrontmatter(markdown) {
  if (!markdown || typeof markdown !== 'string' || !markdown.startsWith('---')) {
    return { body: markdown || '', meta: {} };
  }
  const end = markdown.indexOf('\n---', 3);
  if (end < 0) {
    return { body: markdown, meta: {} };
  }
  const raw = markdown.slice(3, end).trim();
  const body = markdown.slice(end + 4).trim();
  const meta = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) {
      continue;
    }
    const k = m[1].toLowerCase();
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[k] = v;
  }
  return { body, meta };
}

/** /posts/YYYY/MM/DD/file.md → ISO date or null */
export function dateFromPostPath(path) {
  const m = path.match(/^\/posts\/(\d{4})\/(\d{2})\/(\d{2})\/[^/]+\.md$/);
  if (!m) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function tagsFromMeta(meta) {
  if (!meta || !meta.tags) {
    return [];
  }
  return String(meta.tags)
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function slugFromPath(path) {
  const base = path.split('/').pop() || path;
  return base.replace(/\.md$/i, '') || base;
}

function assetRefsFromMarkdown(markdown) {
  const refs = new Set();
  const body = String(markdown || '');
  const imageRe = /!\[[^\]]*]\(([^)]+)\)/g;
  const linkRe = /\[[^\]]+]\(([^)]+)\)/g;
  for (const re of [imageRe, linkRe]) {
    let m;
    while ((m = re.exec(body))) {
      const raw = String(m[1] || '').trim();
      if (!raw || /^https?:\/\//i.test(raw)) {
        continue;
      }
      refs.add(raw.replace(/^\.?\//, ''));
    }
  }
  return Array.from(refs);
}

export async function ensureContentInfra(env) {
  const db = postsDb(env);
  if (!db) {
    return;
  }
  const stmts = [
    `CREATE TABLE IF NOT EXISTS posts (
      path TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      published TEXT NOT NULL,
      updated TEXT NOT NULL,
      description TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      body_text TEXT NOT NULL,
      featured_asset TEXT,
      r2_markdown_key TEXT,
      r2_snapshot_key TEXT,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS post_tags (
      post_path TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (post_path, tag)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag)`,
    `CREATE TABLE IF NOT EXISTS post_search (
      post_path TEXT PRIMARY KEY,
      searchable_text TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS post_metrics (
      post_path TEXT PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0,
      reactions INTEGER NOT NULL DEFAULT 0,
      messages INTEGER NOT NULL DEFAULT 0,
      bookings INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS post_reactions (
      post_path TEXT NOT NULL,
      reaction TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (post_path, reaction)
    )`,
    `CREATE TABLE IF NOT EXISTS post_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_path TEXT NOT NULL,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration TEXT NOT NULL,
      message TEXT NOT NULL,
      meet_link TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ];
  for (const sql of stmts) {
    await db.prepare(sql).run();
  }
}

export async function syncPostToStorage(env, path, markdown) {
  await ensureContentInfra(env);
  const db = postsDb(env);
  const bucket = postsBucket(env);
  const payload = await postPayload(path, markdown, env);
  const nowIso = new Date().toISOString();
  const r2MarkdownKey = `${R2_POST_PREFIX}${path}`;
  const r2SnapshotKey = `${R2_SNAPSHOT_PREFIX}${path}.${nowIso.replaceAll(':', '-')}.json`;

  if (bucket) {
    await bucket.put(r2MarkdownKey, markdown, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      customMetadata: {
        path,
        slug: payload.slug,
        published: payload.published,
        updated: payload.updated,
      },
    });
    await bucket.put(
      r2SnapshotKey,
      JSON.stringify({
        path,
        slug: payload.slug,
        title: payload.title,
        tags: payload.tags,
        description: payload.description,
        published: payload.published,
        updated: payload.updated,
        markdown,
        comments: payload.comments,
        assets: assetRefsFromMarkdown(markdown),
      }),
      { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
    );
  }

  if (!db) {
    return;
  }
  await db.prepare(
    `INSERT INTO posts (
      path, slug, title, published, updated, description, tags_json, body_text, featured_asset,
      r2_markdown_key, r2_snapshot_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      published = excluded.published,
      updated = excluded.updated,
      description = excluded.description,
      tags_json = excluded.tags_json,
      body_text = excluded.body_text,
      featured_asset = excluded.featured_asset,
      r2_markdown_key = excluded.r2_markdown_key,
      r2_snapshot_key = excluded.r2_snapshot_key,
      updated_at = excluded.updated_at`,
  )
    .bind(
      path,
      payload.slug,
      payload.title,
      payload.published,
      payload.updated,
      payload.description,
      JSON.stringify(payload.tags),
      payload.body,
      String(payload.meta.featured || '').trim() || null,
      bucket ? r2MarkdownKey : null,
      bucket ? r2SnapshotKey : null,
      nowIso,
    )
    .run();

  await db.prepare('DELETE FROM post_tags WHERE post_path = ?').bind(path).run();
  for (const tag of payload.tags) {
    await db.prepare('INSERT OR IGNORE INTO post_tags (post_path, tag) VALUES (?, ?)').bind(path, tag).run();
  }
  await db.prepare(
    `INSERT INTO post_search (post_path, searchable_text, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(post_path) DO UPDATE SET searchable_text = excluded.searchable_text, updated_at = excluded.updated_at`,
  )
    .bind(path, [payload.title, payload.description, payload.body, payload.tags.join(' ')].join('\n'), nowIso)
    .run();
  await db.prepare(
    `INSERT INTO post_metrics (post_path, views, reactions, messages, bookings, updated_at)
     VALUES (?, 0, 0, 0, 0, ?)
     ON CONFLICT(post_path) DO NOTHING`,
  )
    .bind(path, nowIso)
    .run();
}

export async function syncAssetToStorage(env, path, content) {
  await ensureContentInfra(env);
  const bucket = postsBucket(env);
  if (bucket) {
    const key = `${R2_ASSET_PREFIX}${path}`;
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
              ? 'image/gif'
              : ext === 'svg'
                ? 'image/svg+xml'
                : ext === 'pdf'
                  ? 'application/pdf'
                  : 'application/octet-stream';
    await bucket.put(key, content, { httpMetadata: { contentType } });
  }
}

export async function deletePostFromStorage(env, path) {
  await ensureContentInfra(env);
  const db = postsDb(env);
  const bucket = postsBucket(env);
  if (bucket) {
    await bucket.delete(`${R2_POST_PREFIX}${path}`);
  }
  if (!db) {
    return;
  }
  await db.prepare('DELETE FROM post_tags WHERE post_path = ?').bind(path).run();
  await db.prepare('DELETE FROM post_search WHERE post_path = ?').bind(path).run();
  await db.prepare('DELETE FROM post_metrics WHERE post_path = ?').bind(path).run();
  await db.prepare('DELETE FROM post_reactions WHERE post_path = ?').bind(path).run();
  await db.prepare('DELETE FROM post_messages WHERE post_path = ?').bind(path).run();
  await db.prepare('DELETE FROM posts WHERE path = ?').bind(path).run();
}

export async function recordPostEvent(env, postPath, event, details = {}) {
  await ensureContentInfra(env);
  const db = postsDb(env);
  if (!db || !postPath) {
    return;
  }
  const now = new Date().toISOString();
  if (event === 'view') {
    await db.prepare(
      `INSERT INTO post_metrics (post_path, views, reactions, messages, bookings, updated_at)
       VALUES (?, 1, 0, 0, 0, ?)
       ON CONFLICT(post_path) DO UPDATE SET views = views + 1, updated_at = excluded.updated_at`,
    )
      .bind(postPath, now)
      .run();
    return;
  }
  if (event === 'reaction') {
    const reaction = String(details.reaction || 'like').slice(0, 32);
    await db.prepare(
      `INSERT INTO post_reactions (post_path, reaction, count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(post_path, reaction) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
    )
      .bind(postPath, reaction, now)
      .run();
    await db.prepare(
      `INSERT INTO post_metrics (post_path, views, reactions, messages, bookings, updated_at)
       VALUES (?, 0, 1, 0, 0, ?)
       ON CONFLICT(post_path) DO UPDATE SET reactions = reactions + 1, updated_at = excluded.updated_at`,
    )
      .bind(postPath, now)
      .run();
    return;
  }
  if (event === 'message') {
    const name = String(details.name || 'anonymous').slice(0, 60);
    const message = String(details.message || '').slice(0, 2000);
    const kind = String(details.kind || 'message').slice(0, 24);
    await db.prepare(
      'INSERT INTO post_messages (post_path, name, message, kind, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(postPath, name, message, kind, now)
      .run();
    await db.prepare(
      `INSERT INTO post_metrics (post_path, views, reactions, messages, bookings, updated_at)
       VALUES (?, 0, 0, 1, 0, ?)
       ON CONFLICT(post_path) DO UPDATE SET messages = messages + 1, updated_at = excluded.updated_at`,
    )
      .bind(postPath, now)
      .run();
  }
}

export async function recordBookingEvent(env, booking) {
  await ensureContentInfra(env);
  const db = postsDb(env);
  if (!db) {
    return;
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    `INSERT INTO bookings (id, email, date, time, duration, message, meet_link, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      String(booking.email || ''),
      String(booking.date || ''),
      String(booking.time || ''),
      String(booking.duration || ''),
      String(booking.message || ''),
      String(booking.meetLink || ''),
      new Date().toISOString(),
    )
    .run();
}

export async function postPayload(path, markdown, env) {
  const { body, meta } = parseFrontmatter(markdown);
  const pathDate = dateFromPostPath(path);
  const titleFromBody = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = (meta.title && meta.title.trim()) || titleFromBody || slugFromPath(path);

  const publishedRaw = meta.date || meta.published || pathDate;
  let published = publishedRaw;
  if (published && !/^\d{4}-\d{2}-\d{2}/.test(published)) {
    const d = new Date(published);
    published = Number.isNaN(d.getTime()) ? pathDate || new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  }
  if (!published) {
    published = new Date().toISOString().slice(0, 10);
  }

  const updated =
    meta.updated && /^\d{4}-\d{2}-\d{2}/.test(meta.updated)
      ? meta.updated.slice(0, 10)
      : published;

  const tags = tagsFromMeta(meta);
  const plain = body
    .replace(/^#\s+.+$/m, '')
    .replace(/[#*_`]/g, '')
    .trim();
  const description =
    (meta.description && meta.description.trim()) || plain.slice(0, 360).trim() || title;

  const comments = env.PORTFOLIO_OS
    ? (await env.PORTFOLIO_OS.get(`comments:${path}`, { type: 'json' })) ?? []
    : [];

  return {
    path,
    slug: slugFromPath(path),
    title,
    markdown,
    body,
    meta,
    tags,
    description,
    published,
    updated,
    comments: Array.isArray(comments) ? comments : [],
  };
}

/** @param {any} env */
export async function collectAllPosts(env) {
  const byPath = new Map();

  for (const [assetPath, markdown] of Object.entries(STATIC_ASSET_POSTS)) {
    const path = assetPathToPostPath(assetPath);
    byPath.set(path, await postPayload(path, markdown, env));
  }

  if (env.PORTFOLIO_OS?.list) {
    for (const prefix of ['file:/posts/', 'file:/assets/posts/']) {
      let cursor;
      do {
        const page = await env.PORTFOLIO_OS.list({ prefix, cursor, limit: 1000 });
        cursor = page.cursor;

        for (const key of page.keys ?? []) {
          const rawPath = key.name.replace(/^file:/, '');
          const path = assetPathToPostPath(rawPath);
          const markdown = await env.PORTFOLIO_OS.get(key.name);
          if (markdown) {
            byPath.set(path, await postPayload(path, String(markdown), env));
          }
        }
      } while (cursor);
    }
  }

  const posts = Array.from(byPath.values());
  posts.sort((a, b) => {
    const da = `${a.published} ${a.path}`;
    const db = `${b.published} ${b.path}`;
    return db.localeCompare(da);
  });
  return posts;
}

export async function onRequestGet({ env }) {
  const posts = await collectAllPosts(env);
  return Response.json({ posts }, { headers: jsonHeaders });
}

export async function onRequestPost({ request, env }) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: jsonHeaders });
  }
  const action = String(body?.action || '').toLowerCase();
  const postPath = String(body?.path || '').trim();
  if (!action || !postPath) {
    return Response.json({ error: 'action and path are required.' }, { status: 400, headers: jsonHeaders });
  }
  if (!postPath.startsWith('/posts/')) {
    return Response.json({ error: 'path must be under /posts.' }, { status: 400, headers: jsonHeaders });
  }
  if (!['view', 'reaction', 'message'].includes(action)) {
    return Response.json({ error: 'Unsupported action.' }, { status: 400, headers: jsonHeaders });
  }
  await recordPostEvent(env, postPath, action, {
    reaction: body?.reaction,
    name: body?.name,
    message: body?.message,
    kind: body?.kind,
  });
  return Response.json({ ok: true }, { headers: jsonHeaders });
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

function escapeXml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * RSS 2.0 feed for subscribers (linked from /posts view).
 * @param {any} env
 * @param {string} origin e.g. https://pecunies.com
 */
export async function buildRssXml(env, origin) {
  const posts = await collectAllPosts(env);
  const base = origin.replace(/\/$/, '');
  const buildDate = new Date().toUTCString();
  const items = posts
    .map((post) => {
      const link = `${base}/#posts`;
      const pub = post.published ? new Date(`${post.published}T12:00:00Z`).toUTCString() : buildDate;
      const desc = escapeXml(post.description || post.title);
      const tagNote =
        post.tags?.length > 0 ? `<p>Tags: ${escapeXml(post.tags.join(', '))}</p>` : '';
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(post.path)}</guid>
      <pubDate>${pub}</pubDate>
      <description><![CDATA[<p>${desc}</p>${tagNote}<p><code>post open ${escapeXml(post.slug)}</code> in the terminal for the full article.</p>]]></description>
    </item>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pecunies — Posts</title>
    <link>${escapeXml(base)}/#posts</link>
    <description>Terminal-native notes and essays from Chris Pecunies.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <generator>Pecunies Terminal</generator>
    ${items}
  </channel>
</rss>`;
}
