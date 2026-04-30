const STATIC_POSTS = {
  '/posts/terminal-portfolio-changelog.md': `---
title: Terminal Portfolio Changelog
date: 2026-04-29
tags: writing, content, terminal
description: Changelog and notes for the terminal-native portfolio writing system.
---

# Terminal Portfolio Changelog

Initial post placeholder for the terminal-native writing system. Posts are markdown files under \`/posts\`; creating, editing, or removing them requires sudo privileges.`,
};

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

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
  const posts = [];

  for (const [path, markdown] of Object.entries(STATIC_POSTS)) {
    posts.push(await postPayload(path, markdown, env));
  }

  if (env.PORTFOLIO_OS?.list) {
    let cursor;
    do {
      const page = await env.PORTFOLIO_OS.list({ prefix: 'file:/posts/', cursor, limit: 1000 });
      cursor = page.cursor;

      for (const key of page.keys ?? []) {
        const path = key.name.replace(/^file:/, '');
        const markdown = await env.PORTFOLIO_OS.get(key.name);

        if (markdown && !STATIC_POSTS[path]) {
          posts.push(await postPayload(path, String(markdown), env));
        }
      }
    } while (cursor);
  }

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
