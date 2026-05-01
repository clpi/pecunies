import {
  CATALOG_TYPES,
  type CatalogEntity,
  type CatalogEntityType,
  baseRouteForType,
  buildCatalogSeed,
  catalogSeoDescription,
  catalogSeoTitle,
  commandForEntity,
  normalizeCatalogType,
  routeForEntity,
} from "../../../src/data/catalog";
import {
  collectAllPosts,
  onRequestPost as handlePostsPost,
} from "../../../functions/api/posts.js";

const APEX_HOST = "pecunies.com";
const WWW_HOST = "www.pecunies.com";
const API_HOST = "api.pecunies.com";

type EntityRow = {
  type: string;
  slug: string;
  payload_json: string;
  deleted: number;
};

type UserRow = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

type Env = {
  DB?: D1Database;
  POSTS_DB?: D1Database;
  POSTS?: R2Bucket;
  POSTS_BUCKET?: R2Bucket;
  STATIC?: R2Bucket;
  PORTFOLIO_OS?: KVNamespace;
  PECUNIES_SUDO_PASSWD?: string;
  AI?: unknown;
};

type CommentRow = {
  id: string;
  target_type: string;
  target_slug: string;
  parent_id: string | null;
  author_username: string;
  author_email: string;
  body: string;
  created_at: string;
  deleted: number;
};

type HistoryRow = {
  id: string;
  session_id: string;
  command: string;
  executed_at: string;
};

type AutocompleteRow = {
  prefix: string;
  scope: string;
  payload_json: string;
  updated_at: string;
};

const RESERVED_API_ROUTES = new Set([
  "auth",
  "catalog",
  "chat",
  "fs",
  "knowledge",
  "mcp",
  "meetings",
  "metrics",
  "os",
  "posts",
  "posts-sync",
  "resume",
  "rss",
  "wiki",
]);

function json(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...extraHeaders,
    },
  });
}

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function normalizeSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function db(env: Env): D1Database | null {
  return env.DB ?? env.POSTS_DB ?? null;
}

async function ensureCatalogInfra(env: Env): Promise<void> {
  const database = db(env);
  if (!database) return;
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS catalog_entities (
        type TEXT NOT NULL,
        slug TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (type, slug)
      )`,
    )
    .run();
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_slug TEXT NOT NULL,
        parent_id TEXT,
        author_username TEXT NOT NULL DEFAULT 'anon',
        author_email TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )`,
    )
    .run();
  await database
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_comments_target
       ON comments (target_type, target_slug, deleted)`,
    )
    .run();
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS command_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL DEFAULT '',
        command TEXT NOT NULL,
        executed_at TEXT NOT NULL
      )`,
    )
    .run();
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS autocomplete_cache (
        prefix TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'command',
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (prefix, scope)
      )`,
    )
    .run();
}

async function readCatalogRows(env: Env): Promise<EntityRow[]> {
  const database = db(env);
  if (!database) return [];
  await ensureCatalogInfra(env);
  const res = await database
    .prepare(
      `SELECT type, slug, payload_json, deleted
       FROM catalog_entities`,
    )
    .all();
  return (res.results ?? []) as EntityRow[];
}

function safeParseEntity(raw: string): CatalogEntity | null {
  try {
    const parsed = JSON.parse(raw) as CatalogEntity;
    if (!parsed?.type || !parsed?.slug || !parsed?.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function dynamicUsers(env: Env): Promise<CatalogEntity[]> {
  const database = db(env);
  if (!database) return [];
  await ensureCatalogInfra(env);
  const res = await database
    .prepare(
      `SELECT id, email, username, full_name, created_at, updated_at
       FROM users
       ORDER BY updated_at DESC
       LIMIT 200`,
    )
    .all();
  return ((res.results ?? []) as UserRow[]).map((row) => ({
    type: "user",
    slug: normalizeSlug(row.username || row.email),
    title: row.full_name?.trim() || row.username,
    category: "viewer",
    description: `${row.username} <${row.email}>`,
    tags: ["user", "auth", "interaction"],
    metadata: {
      email: row.email,
      username: row.username,
      created: row.created_at,
      updated: row.updated_at,
    },
  }));
}

async function mergedCatalog(env: Env): Promise<CatalogEntity[]> {
  const seed = buildCatalogSeed();
  const map = new Map(
    seed.map((entity) => [`${entity.type}:${entity.slug}`, entity]),
  );
  const rows = await readCatalogRows(env);
  for (const row of rows) {
    const key = `${row.type}:${row.slug}`;
    if (row.deleted) {
      map.delete(key);
      continue;
    }
    const parsed = safeParseEntity(row.payload_json);
    if (!parsed) continue;
    map.set(key, parsed);
  }
  for (const user of await dynamicUsers(env)) {
    map.set(`${user.type}:${user.slug}`, user);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.type === b.type
      ? a.title.localeCompare(b.title)
      : a.type.localeCompare(b.type),
  );
}

function reverseLinks(
  target: CatalogEntity,
  entities: CatalogEntity[],
): CatalogEntity[] {
  return entities.filter((entity) =>
    (entity.related ?? []).some(
      (ref) => ref.type === target.type && ref.slug === target.slug,
    ),
  );
}

function tagTopUses(
  tagSlug: string,
  entities: CatalogEntity[],
): CatalogEntity[] {
  return entities
    .filter((entity) => entity.tags.includes(tagSlug) && entity.type !== "tag")
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 6);
}

async function handleCatalogApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const forcedRoute = matchCatalogApiPath(url.pathname);
  const forcedType = forcedRoute?.type ?? null;
  const forcedSlug = forcedRoute?.slug ?? "";
  const all = await mergedCatalog(env);

  if (request.method === "GET") {
    const type =
      forcedType ?? normalizeCatalogType(url.searchParams.get("type") || "");
    const slug =
      forcedSlug || normalizeSlug(url.searchParams.get("slug") || "");
    if (!type) {
      return json({
        types: Object.values(CATALOG_TYPES).map((meta) => ({
          ...meta,
          count: all.filter((entity) => entity.type === meta.type).length,
        })),
      });
    }
    const items = all.filter((entity) => entity.type === type);
    if (!slug) {
      return json({ meta: CATALOG_TYPES[type], items });
    }
    const item = items.find((entity) => entity.slug === slug);
    if (!item) return json({ error: "Not found." }, 404);
    return json({
      meta: CATALOG_TYPES[type],
      item,
      usedBy: reverseLinks(item, all),
      topUses: item.type === "tag" ? tagTopUses(item.slug, all) : [],
    });
  }

  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    entity?: CatalogEntity;
    type?: string;
    slug?: string;
    sudoPassword?: string;
  } | null;

  const action = String(body?.action || "").toLowerCase();
  const password = String(body?.sudoPassword || "");
  if (!env.PECUNIES_SUDO_PASSWD || password !== env.PECUNIES_SUDO_PASSWD) {
    return json({ error: "sudo authentication failed." }, 403);
  }
  const database = db(env);
  if (!database) return json({ error: "D1 binding unavailable." }, 500);
  await ensureCatalogInfra(env);

  if (action === "update" || action === "create") {
    const entity = body?.entity ? { ...body.entity } : null;
    if (forcedType) {
      if (entity?.type && normalizeCatalogType(entity.type) !== forcedType) {
        return json({ error: "Route type and entity type do not match." }, 400);
      }
      if (entity) {
        entity.type = forcedType;
      }
    }
    if (
      forcedSlug &&
      entity?.slug &&
      normalizeSlug(entity.slug) !== forcedSlug
    ) {
      return json({ error: "Route slug and entity slug do not match." }, 400);
    }
    if (forcedSlug && entity) {
      entity.slug = forcedSlug;
    }
    if (!entity?.type || !entity?.slug || !entity?.title) {
      return json({ error: "type, slug, and title are required." }, 400);
    }
    const normalizedType = normalizeCatalogType(entity.type);
    if (!normalizedType) return json({ error: "Unknown entity type." }, 400);
    const normalizedEntity: CatalogEntity = {
      ...entity,
      type: normalizedType,
      slug: normalizeSlug(entity.slug),
      tags: Array.from(
        new Set(
          (entity.tags ?? []).map((tag) => normalizeSlug(tag)).filter(Boolean),
        ),
      ),
    };
    await database
      .prepare(
        `INSERT INTO catalog_entities (type, slug, payload_json, deleted, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(type, slug) DO UPDATE SET payload_json = excluded.payload_json, deleted = 0, updated_at = excluded.updated_at`,
      )
      .bind(
        normalizedEntity.type,
        normalizedEntity.slug,
        JSON.stringify(normalizedEntity),
        new Date().toISOString(),
      )
      .run();
    return json({ ok: true, entity: normalizedEntity });
  }

  if (action === "delete") {
    const type = forcedType ?? normalizeCatalogType(String(body?.type || ""));
    const slug = forcedSlug || normalizeSlug(String(body?.slug || ""));
    if (!type || !slug)
      return json({ error: "type and slug are required." }, 400);
    await database
      .prepare(
        `INSERT INTO catalog_entities (type, slug, payload_json, deleted, updated_at)
         VALUES (?, ?, '{}', 1, ?)
         ON CONFLICT(type, slug) DO UPDATE SET deleted = 1, updated_at = excluded.updated_at`,
      )
      .bind(type, slug, new Date().toISOString())
      .run();
    return json({ ok: true });
  }

  return json({ error: "Unsupported action." }, 400);
}

function matchCatalogApiPath(
  pathname: string,
): { type: CatalogEntityType; slug: string } | null {
  const match = pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  const head = String(match[1] || "")
    .trim()
    .toLowerCase();
  if (!head || RESERVED_API_ROUTES.has(head)) return null;
  const type = normalizeCatalogType(head);
  if (!type) return null;
  return {
    type,
    slug: normalizeSlug(decodeURIComponent(String(match[2] || ""))),
  };
}

async function handleAuthApi(request: Request, env: Env): Promise<Response> {
  const database = db(env);
  if (!database) return json({ error: "D1 binding unavailable." }, 500);
  await ensureCatalogInfra(env);
  if (request.method === "GET") {
    const users = await dynamicUsers(env);
    return json({ users });
  }
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    email?: string;
    username?: string;
    fullName?: string;
  } | null;
  const action = String(body?.action || "").toLowerCase();
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const username = normalizeSlug(body?.username || "");
  const fullName = String(body?.fullName || "")
    .trim()
    .slice(0, 120);
  if (!email) return json({ error: "Email is required." }, 400);

  if (action === "login") {
    const res = await database
      .prepare(
        `SELECT id, email, username, full_name, created_at, updated_at
         FROM users
         WHERE email = ? OR username = ?
         LIMIT 1`,
      )
      .bind(email, username || email)
      .all();
    const row = (res.results?.[0] ?? null) as UserRow | null;
    if (!row) return json({ error: "No matching user." }, 404);
    return json({
      ok: true,
      user: {
        email: row.email,
        username: row.username,
        fullName: row.full_name || row.username,
      },
    });
  }

  if (action === "signup") {
    if (!username) return json({ error: "Username is required." }, 400);
    const now = new Date().toISOString();
    const id = `usr_${Date.now().toString(36)}`;
    await database
      .prepare(
        `INSERT INTO users (id, email, username, full_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET username = excluded.username, full_name = excluded.full_name, updated_at = excluded.updated_at`,
      )
      .bind(id, email, username, fullName || username, now, now)
      .run();
    return json({
      ok: true,
      user: {
        email,
        username,
        fullName: fullName || username,
      },
    });
  }

  return json({ error: "Unsupported action." }, 400);
}

// ─── Comments API ────────────────────────────────────────────────────────────

async function handleCommentsApi(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const database = db(env);
  if (!database) return json({ error: "D1 binding unavailable." }, 500);
  await ensureCatalogInfra(env);

  if (request.method === "GET") {
    const targetType = url.searchParams.get("type") || "";
    const targetSlug = url.searchParams.get("slug") || "";
    const parentId = url.searchParams.get("parent") || null;
    if (!targetType || !targetSlug)
      return json({ error: "type and slug required." }, 400);

    const rows = (
      parentId
        ? await database
            .prepare(
              `SELECT id, target_type, target_slug, parent_id, author_username, body, created_at
             FROM comments
             WHERE target_type=? AND target_slug=? AND parent_id=? AND deleted=0
             ORDER BY created_at ASC LIMIT 200`,
            )
            .bind(targetType, targetSlug, parentId)
            .all()
        : await database
            .prepare(
              `SELECT id, target_type, target_slug, parent_id, author_username, body, created_at
             FROM comments
             WHERE target_type=? AND target_slug=? AND parent_id IS NULL AND deleted=0
             ORDER BY created_at DESC LIMIT 100`,
            )
            .bind(targetType, targetSlug)
            .all()
    ).results as CommentRow[];

    const replyCountRes = await database
      .prepare(
        `SELECT parent_id, COUNT(*) as cnt FROM comments
         WHERE target_type=? AND target_slug=? AND parent_id IS NOT NULL AND deleted=0
         GROUP BY parent_id`,
      )
      .bind(targetType, targetSlug)
      .all();
    const replyCounts = new Map<string, number>(
      (replyCountRes.results as { parent_id: string; cnt: number }[]).map(
        (r) => [r.parent_id, r.cnt],
      ),
    );

    return json({
      comments: rows.map((r) => ({
        id: r.id,
        targetType: r.target_type,
        targetSlug: r.target_slug,
        parentId: r.parent_id,
        author: r.author_username,
        body: r.body,
        createdAt: r.created_at,
        replyCount: replyCounts.get(r.id) ?? 0,
      })),
    });
  }

  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      targetType?: string;
      targetSlug?: string;
      parentId?: string;
      authorUsername?: string;
      authorEmail?: string;
      body?: string;
      commentId?: string;
    } | null;

    const action = String(body?.action || "create").toLowerCase();

    if (action === "delete") {
      const password = String(
        (body as Record<string, string>)?.sudoPassword || "",
      );
      if (!env.PECUNIES_SUDO_PASSWD || password !== env.PECUNIES_SUDO_PASSWD) {
        return json({ error: "sudo authentication failed." }, 403);
      }
      const commentId = String(body?.commentId || "");
      if (!commentId) return json({ error: "commentId required." }, 400);
      await database
        .prepare(`UPDATE comments SET deleted=1 WHERE id=?`)
        .bind(commentId)
        .run();
      return json({ ok: true });
    }

    const targetType = String(body?.targetType || "").trim();
    const targetSlug = normalizeSlug(body?.targetSlug || "");
    const commentBody = String(body?.body || "")
      .trim()
      .slice(0, 4000);
    const author = normalizeSlug(body?.authorUsername || "anon") || "anon";
    const authorEmail = String(body?.authorEmail || "")
      .trim()
      .slice(0, 255);
    const parentId = body?.parentId ? String(body.parentId).trim() : null;

    if (!targetType || !targetSlug)
      return json({ error: "targetType and targetSlug required." }, 400);
    if (!commentBody) return json({ error: "body required." }, 400);

    const id = `cmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    await database
      .prepare(
        `INSERT INTO comments (id, target_type, target_slug, parent_id, author_username, author_email, body, created_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .bind(
        id,
        targetType,
        targetSlug,
        parentId,
        author,
        authorEmail,
        commentBody,
        now,
      )
      .run();
    return json({
      ok: true,
      comment: { id, author, body: commentBody, createdAt: now, parentId },
    });
  }

  return json({ error: "Method not allowed." }, 405);
}

// ─── Command History API ──────────────────────────────────────────────────────

async function handleHistoryApi(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const database = db(env);
  if (!database) return json({ error: "D1 binding unavailable." }, 500);
  await ensureCatalogInfra(env);

  if (request.method === "GET") {
    const sessionId = url.searchParams.get("session") || "";
    const limit = Math.min(
      200,
      parseInt(url.searchParams.get("limit") || "50", 10),
    );
    const rows = (
      await database
        .prepare(
          `SELECT id, session_id, command, executed_at FROM command_history
         WHERE session_id=? ORDER BY executed_at DESC LIMIT ?`,
        )
        .bind(sessionId, limit)
        .all()
    ).results as HistoryRow[];
    return json({ history: rows });
  }

  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as {
      sessionId?: string;
      command?: string;
    } | null;
    const sessionId = String(body?.sessionId || "")
      .trim()
      .slice(0, 128);
    const command = String(body?.command || "")
      .trim()
      .slice(0, 2000);
    if (!command) return json({ error: "command required." }, 400);
    const id = `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    await database
      .prepare(
        `INSERT INTO command_history (id, session_id, command, executed_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(id, sessionId, command, now)
      .run();
    return json({ ok: true, id });
  }

  return json({ error: "Method not allowed." }, 405);
}

// ─── Autocomplete API ─────────────────────────────────────────────────────────

async function handleAutocompleteApi(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const database = db(env);
  if (!database) return json({ suggestions: [] });
  await ensureCatalogInfra(env);

  const scope = (url.searchParams.get("scope") || "command").toLowerCase();
  const prefix = (url.searchParams.get("q") || "").toLowerCase().trim();

  if (scope === "tag") {
    const all = await mergedCatalog(env);
    const tags = all.filter((e) => e.type === "tag");
    const filtered = prefix
      ? tags.filter(
          (t) =>
            t.slug.startsWith(prefix) ||
            t.title.toLowerCase().startsWith(prefix),
        )
      : tags;
    return json({
      suggestions: filtered.slice(0, 40).map((t) => ({
        value: t.slug,
        label: t.title,
        description: t.description,
        count: all.filter((e) => e.tags?.includes(t.slug) && e.type !== "tag")
          .length,
      })),
    });
  }

  if (scope === "skill") {
    const all = await mergedCatalog(env);
    const skills = all.filter((e) => e.type === "skill");
    const filtered = prefix
      ? skills.filter(
          (s) =>
            s.slug.startsWith(prefix) ||
            s.title.toLowerCase().startsWith(prefix),
        )
      : skills;
    return json({
      suggestions: filtered.slice(0, 40).map((s) => ({
        value: s.slug,
        label: s.title,
        description: s.description,
        category: s.category,
        yearsOfExperience: s.yearsOfExperience,
      })),
    });
  }

  // scope=command: return all entity-level commands + built-in commands
  const all = await mergedCatalog(env);
  const commands = all.filter((e) => e.type === "command");
  const filtered = prefix
    ? commands.filter(
        (c) =>
          c.slug.startsWith(prefix) || c.title.toLowerCase().startsWith(prefix),
      )
    : commands;
  return json({
    suggestions: filtered.slice(0, 60).map((c) => ({
      value: c.slug,
      label: c.title,
      description: c.description,
      usage: (c.metadata?.usage as string) || `/${c.slug}`,
      tags: c.tags,
    })),
  });
}

// ── Content overrides (in-place editing) ─────────────────────────────────────

async function handleContentApi(request: Request, env: Env): Promise<Response> {
  const database = db(env);
  if (!database) return json({ overrides: {} });
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS content_overrides (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    )
    .run();

  if (request.method === "GET") {
    const rows = await database
      .prepare(`SELECT key, value FROM content_overrides`)
      .all<{ key: string; value: string }>();
    const overrides: Record<string, string> = {};
    for (const row of rows.results) overrides[row.key] = row.value;
    return json({ overrides });
  }

  if (request.method === "PUT") {
    const body = await request.json<{ key?: string; value?: string }>();
    const { key, value } = body;
    if (!key || value === undefined)
      return json({ error: "key and value required" }, 400);
    await database
      .prepare(
        `INSERT INTO content_overrides (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      )
      .bind(key, value, new Date().toISOString())
      .run();
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
}

// ── Posts ─────────────────────────────────────────────────────────────────────

async function handlePostsApi(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const posts = await collectAllPosts(env as never);
    return json({ posts });
  }

  if (request.method === "POST") {
    const response = await handlePostsPost({ request, env } as never);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return json({ error: "method not allowed" }, 405);
}

// ── Sudo auth ─────────────────────────────────────────────────────────────────

async function handleSudoAuth(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST")
    return json({ error: "method not allowed" }, 405);
  const body = await request
    .json<{ password?: string; sudoPassword?: string }>()
    .catch(() => ({}));
  const expected = String(env.PECUNIES_SUDO_PASSWD ?? "").trim();
  const provided = String(body.password ?? body.sudoPassword ?? "").trim();
  return json({
    ok: Boolean(expected) && provided === expected,
    configured: Boolean(expected),
  });
}

// ── Tag usage ─────────────────────────────────────────────────────────────────

async function handleTagUsageApi(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  const all = await mergedCatalog(env);
  const tag = all.find((e) => e.type === "tag" && e.slug === slug);
  const uses = all
    .filter((e) => e.type !== "tag" && e.tags?.includes(slug))
    .slice(0, 24)
    .map((e) => ({
      label: e.title,
      type: e.type,
      command: commandForEntity(e),
    }));
  return json({
    usage: {
      slug,
      description: tag?.description ?? "",
      count: uses.length,
      uses,
      related: all
        .filter((e) => e.type === "tag" && e.slug !== slug)
        .slice(0, 6)
        .map((e) => e.slug),
    },
  });
}

function isHtmlRequest(request: Request): boolean {
  return String(request.headers.get("accept") || "").includes("text/html");
}

function cleanRoutePath(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, "");
}

function looksLikeAsset(pathname: string): boolean {
  return /\.[a-z0-9]+$/i.test(pathname);
}

async function resolveSeo(
  pathname: string,
  env: Env,
): Promise<{
  title: string;
  description: string;
  canonicalPath: string;
} | null> {
  const route = cleanRoutePath(pathname);
  if (!route) {
    return {
      title: "pecunies",
      description:
        "Command-driven portfolio and terminal shell for Chris Pecunies.",
      canonicalPath: "/",
    };
  }

  const staticPages: Record<string, { title: string; description: string }> = {
    about: {
      title: "About | pecunies",
      description:
        "Architecture and design notes for the pecunies terminal portfolio.",
    },
    resume: {
      title: "Resume | pecunies",
      description:
        "Professional profile, resume, and work summary for Chris Pecunies.",
    },
    projects: {
      title: "Projects | pecunies",
      description:
        "Projects, systems work, and shipped portfolio items from Chris Pecunies.",
    },
    posts: {
      title: "Posts | pecunies",
      description:
        "Terminal-native posts, notes, and markdown content from pecunies.",
    },
    links: {
      title: "Links | pecunies",
      description:
        "External profiles, project links, and public contact surfaces.",
    },
    contact: {
      title: "Contact | pecunies",
      description:
        "Contact surfaces and direct reachability for Chris Pecunies.",
    },
    view: {
      title: "Views | pecunies",
      description: "Route and view index for the terminal site.",
    },
    app: {
      title: "Apps | pecunies",
      description:
        "Interactive apps and games available inside the terminal shell.",
    },
  };
  if (staticPages[route]) {
    return { ...staticPages[route], canonicalPath: `/${route}` };
  }

  const postMatch = route.match(/^post\/([^/]+)$/);
  if (postMatch) {
    const posts = await collectAllPosts(env as never);
    const slug = normalizeSlug(postMatch[1] || "");
    const post = posts.find((entry) => normalizeSlug(entry.slug) === slug);
    if (!post) return null;
    return {
      title: `${post.title} | pecunies`,
      description: post.description || post.title,
      canonicalPath: `/post/${post.slug}`,
    };
  }

  const [head, tail] = route.split("/", 2);
  const type = normalizeCatalogType(head || "");
  if (!type) return null;
  const catalog = await mergedCatalog(env);
  if (!tail) {
    return {
      title: catalogSeoTitle(null, type),
      description: catalogSeoDescription(null, type),
      canonicalPath: `/${baseRouteForType(type)}`,
    };
  }
  const entity = catalog.find(
    (item) => item.type === type && item.slug === normalizeSlug(tail),
  );
  if (!entity) return null;
  return {
    title: catalogSeoTitle(entity),
    description: catalogSeoDescription(entity),
    canonicalPath: `/${routeForEntity(entity)}`,
  };
}

function spaRouteCandidate(pathname: string): boolean {
  if (!pathname || pathname === "/") return true;
  if (pathname.startsWith("/api/")) return false;
  if (looksLikeAsset(pathname)) return false;
  const route = cleanRoutePath(pathname);
  if (!route) return true;
  const first = route.split("/", 1)[0] || "";
  return [
    "about",
    "resume",
    "projects",
    "posts",
    "links",
    "contact",
    "view",
    "app",
    "post",
    ...Object.values(CATALOG_TYPES).map((meta) => meta.routeBase),
  ].includes(first);
}

function rewriteToRoot(upstreamUrl: URL): URL {
  const next = new URL(upstreamUrl.toString());
  next.pathname = "/";
  next.search = "";
  next.hash = "";
  return next;
}

function injectSeo(
  response: Response,
  seo: { title: string; description: string; canonicalPath: string },
): Response {
  const canonicalUrl = `https://${APEX_HOST}${seo.canonicalPath}`;
  return new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(seo.title);
      },
    })
    .on('meta[name="description"]', {
      element(element) {
        element.setAttribute("content", seo.description);
      },
    })
    .on("head", {
      element(element) {
        element.append(
          `<meta property="og:title" content="${escapeAttr(seo.title)}">` +
            `<meta property="og:description" content="${escapeAttr(seo.description)}">` +
            `<meta name="twitter:card" content="summary_large_image">` +
            `<link rel="canonical" href="${escapeAttr(canonicalUrl)}">`,
          { html: true },
        );
      },
    })
    .transform(response);
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === WWW_HOST) {
      url.hostname = APEX_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    // Preflight
    if (request.method === "OPTIONS") return handleOptions();

    if (url.pathname === "/api/catalog") {
      return handleCatalogApi(request, env);
    }
    if (url.pathname === "/api/auth") {
      return handleAuthApi(request, env);
    }
    if (url.pathname === "/api/comments") {
      return handleCommentsApi(request, env, url);
    }
    if (url.pathname === "/api/history") {
      return handleHistoryApi(request, env, url);
    }
    if (url.pathname === "/api/autocomplete") {
      return handleAutocompleteApi(request, env, url);
    }
    if (url.pathname === "/api/content") {
      return handleContentApi(request, env);
    }
    if (url.pathname === "/api/posts") {
      return handlePostsApi(request, env);
    }
    if (url.pathname === "/api/sudo" || url.pathname === "/api/auth/sudo") {
      return handleSudoAuth(request, env);
    }
    const tagUsageMatch = url.pathname.match(/^\/api\/tags\/([^/]+)\/usage$/);
    if (tagUsageMatch) {
      return handleTagUsageApi(
        request,
        env,
        decodeURIComponent(tagUsageMatch[1]!),
      );
    }
    if (matchCatalogApiPath(url.pathname)) {
      return handleCatalogApi(request, env);
    }

    const upstreamUrl = new URL(request.url);
    upstreamUrl.hostname = "pecunies-chaos-portfolio.pages.dev";
    upstreamUrl.protocol = "https:";
    upstreamUrl.port = "";

    if (
      url.hostname === API_HOST &&
      !upstreamUrl.pathname.startsWith("/api/")
    ) {
      upstreamUrl.pathname = `/api${upstreamUrl.pathname === "/" ? "/knowledge" : upstreamUrl.pathname}`;
    }

    const shouldRewriteSpa =
      isHtmlRequest(request) && spaRouteCandidate(url.pathname);
    const targetUrl = shouldRewriteSpa
      ? rewriteToRoot(upstreamUrl)
      : upstreamUrl;
    const upstreamRequest = new Request(targetUrl.toString(), request);
    const response = await fetch(upstreamRequest, {
      cf: {
        cacheEverything: request.method === "GET",
      },
    });

    const headers = new Headers(response.headers);
    headers.set("x-portfolio-edge", "pecunies");
    const baseResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    if (!shouldRewriteSpa || !response.ok || !isHtmlRequest(request)) {
      return baseResponse;
    }

    const seo = await resolveSeo(url.pathname, env);
    return seo ? injectSeo(baseResponse, seo) : baseResponse;
  },
};
