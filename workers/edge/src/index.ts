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
  deletePostFromStorage,
  ensureContentInfra,
  onRequestPost as handlePostsPost,
  recordPostEvent,
  syncPostToStorage,
} from "../../../functions/api/posts.js";
import { onRequestPost as handleMetricsPost } from "../../../functions/api/metrics.js";
import {
  onRequestOptions as handleOsOptions,
  onRequestPost as handleOsPost,
} from "../../../functions/api/os.js";
import {
  onRequestGet as handleFsGet,
  onRequestDelete as handleFsDelete,
  onRequestOptions as handleFsOptions,
  onRequestPost as handleFsPost,
  onRequestPut as handleFsPut,
} from "../../../functions/api/fs.js";

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

type BookingRow = {
  id: string;
  email: string;
  date: string;
  time: string;
  duration: string;
  message: string;
  meet_link: string;
  created_at: string;
};

type ScoreEntry = {
  name: string;
  score: number;
  at: string;
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
  "crud",
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
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

async function handleMutateApi(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return handleOptions();
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        type?: string;
        slug?: string;
        tag?: string;
        title?: string;
        url?: string;
        yearsOfExperience?: number;
        signalId?: string;
        signalLabel?: string;
        signalValue?: string;
        signalDetail?: string;
        signalAccent?: string;
        signalMode?: number;
      }
    | null;
  const action = String(body?.action || "").trim().toLowerCase();

  const database = db(env);
  if (!database) return json({ error: "D1 binding unavailable." }, 500);
  await ensureCatalogInfra(env);

  if (action === "tag_add" || action === "tag_remove") {
    const type = normalizeCatalogType(String(body?.type || ""));
    const slug = normalizeSlug(String(body?.slug || ""));
    const tag = normalizeSlug(String(body?.tag || ""));
    if (!type || !slug || !tag) {
      return json({ error: "type, slug, and tag are required." }, 400);
    }
    const res = await database
      .prepare(
        `SELECT payload_json, deleted FROM catalog_entities WHERE type=? AND slug=? LIMIT 1`,
      )
      .bind(type, slug)
      .all<{ payload_json: string; deleted: number }>();
    const row = (res.results?.[0] ?? null) as
      | { payload_json: string; deleted: number }
      | null;
    if (!row || row.deleted) return json({ error: "Not found." }, 404);

    const parsed = safeParseEntity(row.payload_json);
    if (!parsed) return json({ error: "Invalid entity payload." }, 500);

    const tags = new Set(
      Array.isArray(parsed.tags) ? parsed.tags.map((t) => normalizeSlug(t)) : [],
    );
    if (action === "tag_add") tags.add(tag);
    else tags.delete(tag);
    const next: CatalogEntity = { ...parsed, tags: Array.from(tags).filter(Boolean) };

    await database
      .prepare(
        `INSERT INTO catalog_entities (type, slug, payload_json, deleted, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(type, slug) DO UPDATE SET payload_json = excluded.payload_json, deleted = 0, updated_at = excluded.updated_at`,
      )
      .bind(type, slug, JSON.stringify(next), new Date().toISOString())
      .run();

    return json({ ok: true, entity: next });
  }

  if (action === "quick_link_create") {
    const rawTitle = String(body?.title || "").trim().slice(0, 160);
    const rawUrl = String(body?.url || "").trim().slice(0, 500);
    if (!rawTitle || !rawUrl) {
      return json({ error: "title and url are required." }, 400);
    }
    let safe;
    try {
      safe = new URL(rawUrl);
    } catch {
      return json({ error: "url is invalid." }, 400);
    }
    if (safe.protocol !== "http:" && safe.protocol !== "https:") {
      return json({ error: "url must be http(s)." }, 400);
    }

    const slug = normalizeSlug(rawTitle) || `link-${Date.now().toString(36)}`;
    const entity: CatalogEntity = {
      type: "link",
      slug,
      title: rawTitle,
      category: "quick-link",
      description: `Quick link for ${rawTitle}.`,
      tags: ["links", "quick-link"],
      metadata: { url: safe.toString(), source: "quick-link" },
    };

    await database
      .prepare(
        `INSERT INTO catalog_entities (type, slug, payload_json, deleted, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(type, slug) DO UPDATE SET payload_json = excluded.payload_json, deleted = 0, updated_at = excluded.updated_at`,
      )
      .bind(entity.type, entity.slug, JSON.stringify(entity), new Date().toISOString())
      .run();

    return json({ ok: true, entity });
  }

  if (action === "signal_upsert") {
    const signalId = String(body?.signalId || "").trim().slice(0, 64);
    const signalLabel = String(body?.signalLabel || "").trim().slice(0, 80);
    const signalValue = String(body?.signalValue || "").trim().slice(0, 40);
    const signalDetail = String(body?.signalDetail || "").trim().slice(0, 280);
    const signalAccent = String(body?.signalAccent || "#ffffff").trim().slice(0, 16);
    const signalMode = Number(body?.signalMode ?? 0);

    if (!signalId || !signalLabel || !signalValue) {
      return json({ error: "signalId, signalLabel, and signalValue are required." }, 400);
    }

    const slug = `signal:${signalId}`;
    const entity: CatalogEntity = {
      type: "data",
      slug,
      title: signalLabel,
      category: "signal",
      description: signalDetail || "",
      tags: ["signal"],
      metadata: {
        signalId,
        signalValue,
        signalAccent,
        signalMode: String(signalMode),
      },
    };

    await database
      .prepare(
        `INSERT INTO catalog_entities (type, slug, payload_json, deleted, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(type, slug) DO UPDATE SET payload_json = excluded.payload_json, deleted = 0, updated_at = excluded.updated_at`,
      )
      .bind(entity.type, entity.slug, JSON.stringify(entity), new Date().toISOString())
      .run();

    return json({ ok: true, entity });
  }

  if (action === "signal_delete") {
    const signalId = String(body?.signalId || "").trim().slice(0, 64);
    if (!signalId) {
      return json({ error: "signalId is required." }, 400);
    }

    const slug = `signal:${signalId}`;
    await database
      .prepare(
        `UPDATE catalog_entities SET deleted = 1, updated_at = ? WHERE type = 'data' AND slug = ?`,
      )
      .bind(new Date().toISOString(), slug)
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

type CrudRoute = {
  resource: string;
  id: string;
  tail: string[];
};

function matchCrudApiPath(pathname: string): CrudRoute | null {
  if (!pathname.startsWith("/api/crud")) return null;
  const segments = pathname
    .replace(/^\/api\/crud\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  return {
    resource: String(segments[0] || "")
      .trim()
      .toLowerCase(),
    id: String(segments[1] || "").trim(),
    tail: segments.slice(2),
  };
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  if (request.method === "GET" || request.method === "HEAD") return null;
  return (await request.json().catch(() => null)) as T | null;
}

async function readResponseJson<T>(response: Response): Promise<T | null> {
  return (await response.clone().json().catch(() => null)) as T | null;
}

function makeInternalRequest(
  request: Request,
  path: string,
  method = request.method,
  body?: unknown,
  searchParams?: URLSearchParams | Record<string, string | number | undefined>,
): Request {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = "";
  if (searchParams instanceof URLSearchParams) {
    url.search = searchParams.toString();
  } else if (searchParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") continue;
      params.set(key, String(value));
    }
    url.search = params.toString();
  }
  const headers = new Headers(request.headers);
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers.set("Content-Type", "application/json");
  }
  return new Request(url.toString(), {
    method,
    headers,
    body: payload,
  });
}

function requireSudo(env: Env, password: string): Response | null {
  if (!env.PECUNIES_SUDO_PASSWD || password !== env.PECUNIES_SUDO_PASSWD) {
    return json({ error: "sudo authentication failed." }, 403);
  }
  return null;
}

function shellQuote(value: string): string {
  return JSON.stringify(String(value ?? ""));
}

function sanitizeTags(tags: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(tags) ? tags : [])
        .map((tag) => normalizeSlug(String(tag || "")))
        .filter(Boolean),
    ),
  );
}

function escapeFrontmatterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function normalizePostDate(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toISOString().slice(0, 10);
}

function buildPostMarkdown(input: {
  title: string;
  body: string;
  description?: string;
  tags?: string[];
  published?: string;
  updated?: string;
}): string {
  const title = String(input.title || "Post").trim() || "Post";
  const body = String(input.body || "").trim();
  const published = normalizePostDate(
    input.published,
    new Date().toISOString().slice(0, 10),
  );
  const updated = normalizePostDate(input.updated, published);
  const tags = sanitizeTags(input.tags);
  const description = String(input.description || "")
    .trim()
    .slice(0, 360);
  const lines = [
    "---",
    `title: "${escapeFrontmatterValue(title)}"`,
    `date: ${published}`,
    ...(updated && updated !== published ? [`updated: ${updated}`] : []),
    ...(tags.length ? [`tags: ${tags.join(", ")}`] : []),
    ...(description
      ? [`description: "${escapeFrontmatterValue(description)}"`]
      : []),
    "---",
    "",
    `# ${title}`,
    "",
    body,
  ];
  return lines.join("\n").trimEnd();
}

function nextAvailablePostPath(
  existingPaths: Set<string>,
  title: string,
  preferredSlug?: string,
  published?: string,
): string {
  const baseSlug = normalizeSlug(preferredSlug || title) || "post";
  const date = normalizePostDate(published, new Date().toISOString().slice(0, 10));
  const [year, month, day] = date.split("-");
  const prefix = `/posts/${year}/${month}/${day}`;
  const basePath = `${prefix}/${baseSlug}.md`;
  if (!existingPaths.has(basePath)) return basePath;
  let suffix = 2;
  while (existingPaths.has(`${prefix}/${baseSlug}-${suffix}.md`)) suffix += 1;
  return `${prefix}/${baseSlug}-${suffix}.md`;
}

function matchesPostKey(
  post: { path?: string; slug?: string },
  key: string,
): boolean {
  const raw = String(key || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/posts/")) return post.path === raw;
  return normalizeSlug(post.slug || "") === normalizeSlug(raw);
}

async function findPostByKey(
  env: Env,
  key: string,
): Promise<Record<string, unknown> | null> {
  const posts = await collectAllPosts(env as never);
  return (
    (posts.find((entry) => matchesPostKey(entry as never, key)) as
      | Record<string, unknown>
      | undefined) ?? null
  );
}

function defaultLeaderboard(): Record<string, ScoreEntry[]> {
  return {
    "2048": [],
    chess: [],
    minesweeper: [],
    jobquest: [],
  };
}

async function readLeaderboard(env: Env): Promise<Record<string, ScoreEntry[]>> {
  if (!env.PORTFOLIO_OS) return defaultLeaderboard();
  const board = (await env.PORTFOLIO_OS.get("leaderboard:global", {
    type: "json",
  })) as Record<string, unknown> | null;
  const fallback = defaultLeaderboard();
  return Object.fromEntries(
    Object.keys(fallback).map((game) => [
      game,
      Array.isArray(board?.[game])
        ? (board?.[game] as ScoreEntry[])
        : fallback[game],
    ]),
  ) as Record<string, ScoreEntry[]>;
}

async function writeLeaderboard(
  env: Env,
  board: Record<string, ScoreEntry[]>,
): Promise<void> {
  if (!env.PORTFOLIO_OS) return;
  await env.PORTFOLIO_OS.put("leaderboard:global", JSON.stringify(board));
}

async function handleCrudApi(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const route = matchCrudApiPath(url.pathname);
  if (!route?.resource) return json({ error: "CRUD resource required." }, 400);

  const body = (await readJsonBody<Record<string, unknown>>(request)) ?? {};
  const resource = route.resource;
  const id = route.id;
  const catalogType = normalizeCatalogType(resource);

  if (resource === "catalog") {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed." }, 405);
    }
    const items = await mergedCatalog(env);
    return json({
      items,
      types: Object.values(CATALOG_TYPES).map((meta) => ({
        ...meta,
        count: items.filter((entity) => entity.type === meta.type).length,
      })),
    });
  }

  if (catalogType) {
    if (request.method === "GET") {
      return handleCatalogApi(
        makeInternalRequest(
          request,
          id ? `/api/${catalogType}/${encodeURIComponent(id)}` : "/api/catalog",
          "GET",
          undefined,
          id ? undefined : { type: catalogType },
        ),
        env,
      );
    }

    if (request.method === "POST" || request.method === "PUT") {
      const entity = {
        ...(((body.entity as Record<string, unknown> | undefined) ?? body) as Record<
          string,
          unknown
        >),
        type: catalogType,
        ...(id ? { slug: id } : {}),
      } as CatalogEntity;
      return handleCatalogApi(
        makeInternalRequest(
          request,
          id ? `/api/${catalogType}/${encodeURIComponent(id)}` : `/api/${catalogType}`,
          "POST",
          {
            action: request.method === "POST" ? "create" : "update",
            entity,
            sudoPassword: String(body.sudoPassword || ""),
          },
        ),
        env,
      );
    }

    if (request.method === "DELETE") {
      if (!id) return json({ error: "Entity slug required." }, 400);
      return handleCatalogApi(
        makeInternalRequest(
          request,
          `/api/${catalogType}/${encodeURIComponent(id)}`,
          "POST",
          {
            action: "delete",
            type: catalogType,
            slug: id,
            sudoPassword: String(body.sudoPassword || ""),
          },
        ),
        env,
      );
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "users") {
    const database = db(env);
    if (!database) return json({ error: "D1 binding unavailable." }, 500);
    await ensureCatalogInfra(env);

    if (request.method === "GET") {
      if (!id) {
        return handleAuthApi(makeInternalRequest(request, "/api/auth"), env);
      }
      const users = await dynamicUsers(env);
      const item =
        users.find(
          (user) =>
            user.slug === normalizeSlug(id) ||
            normalizeSlug(user.metadata?.email || "") === normalizeSlug(id),
        ) ?? null;
      if (!item) return json({ error: "Not found." }, 404);
      return json({ item });
    }

    if (request.method === "POST") {
      return handleAuthApi(
        makeInternalRequest(request, "/api/auth", "POST", {
          action: "signup",
          email: body.email,
          username: body.username,
          fullName: body.fullName,
        }),
        env,
      );
    }

    if (request.method === "PUT") {
      if (!id) return json({ error: "User id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const lookup = await database
        .prepare(
          `SELECT id, email, username, full_name, created_at, updated_at
           FROM users
           WHERE username = ? OR email = ?
           LIMIT 1`,
        )
        .bind(id, id)
        .all<UserRow>();
      const row = (lookup.results?.[0] ?? null) as UserRow | null;
      if (!row) return json({ error: "Not found." }, 404);
      const email = String(body.email || row.email)
        .trim()
        .toLowerCase();
      const username = normalizeSlug(String(body.username || row.username));
      const fullName = String(body.fullName || row.full_name || username)
        .trim()
        .slice(0, 120);
      await database
        .prepare(
          `UPDATE users
           SET email = ?, username = ?, full_name = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(email, username, fullName, new Date().toISOString(), row.id)
        .run();
      const item =
        (await dynamicUsers(env)).find((user) => user.slug === username) ?? null;
      return json({ ok: true, item });
    }

    if (request.method === "DELETE") {
      if (!id) return json({ error: "User id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      await database
        .prepare(`DELETE FROM users WHERE username = ? OR email = ?`)
        .bind(id, id)
        .run();
      return json({ ok: true });
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "comments") {
    const database = db(env);
    if (!database) return json({ error: "D1 binding unavailable." }, 500);
    await ensureCatalogInfra(env);

    if (request.method === "GET") {
      if (!id) {
        const params = new URLSearchParams();
        if (body.targetType || url.searchParams.get("targetType")) {
          params.set(
            "type",
            String(body.targetType || url.searchParams.get("targetType") || ""),
          );
        }
        if (body.targetSlug || url.searchParams.get("targetSlug")) {
          params.set(
            "slug",
            String(body.targetSlug || url.searchParams.get("targetSlug") || ""),
          );
        }
        if (body.parentId || url.searchParams.get("parentId")) {
          params.set(
            "parent",
            String(body.parentId || url.searchParams.get("parentId") || ""),
          );
        }
        return handleCommentsApi(
          makeInternalRequest(request, "/api/comments", "GET", undefined, params),
          env,
          new URL(`https://${API_HOST}/api/comments?${params.toString()}`),
        );
      }
      const row = (
        await database
          .prepare(
            `SELECT id, target_type, target_slug, parent_id, author_username, author_email, body, created_at
             FROM comments
             WHERE id = ? AND deleted = 0
             LIMIT 1`,
          )
          .bind(id)
          .all<CommentRow>()
      ).results?.[0] as CommentRow | undefined;
      if (!row) return json({ error: "Not found." }, 404);
      return json({
        item: {
          id: row.id,
          targetType: row.target_type,
          targetSlug: row.target_slug,
          parentId: row.parent_id,
          author: row.author_username,
          body: row.body,
          createdAt: row.created_at,
        },
      });
    }

    if (request.method === "POST") {
      return handleCommentsApi(
        makeInternalRequest(request, "/api/comments", "POST", {
          action: "create",
          targetType: body.targetType,
          targetSlug: body.targetSlug,
          parentId: body.parentId,
          authorUsername: body.authorUsername,
          authorEmail: body.authorEmail,
          body: body.body,
        }),
        env,
        new URL("https://api.pecunies.com/api/comments"),
      );
    }

    if (request.method === "PUT") {
      if (!id) return json({ error: "Comment id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const text = String(body.body || "")
        .trim()
        .slice(0, 4000);
      if (!text) return json({ error: "body required." }, 400);
      await database
        .prepare(`UPDATE comments SET body = ? WHERE id = ? AND deleted = 0`)
        .bind(text, id)
        .run();
      return handleCrudApi(
        makeInternalRequest(request, `/api/crud/comments/${encodeURIComponent(id)}`),
        env,
        new URL(`https://${API_HOST}/api/crud/comments/${encodeURIComponent(id)}`),
      );
    }

    if (request.method === "DELETE") {
      if (!id) return json({ error: "Comment id required." }, 400);
      return handleCommentsApi(
        makeInternalRequest(request, "/api/comments", "POST", {
          action: "delete",
          commentId: id,
          sudoPassword: body.sudoPassword,
        }),
        env,
        new URL("https://api.pecunies.com/api/comments"),
      );
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "history") {
    const database = db(env);
    if (!database) return json({ error: "D1 binding unavailable." }, 500);
    await ensureCatalogInfra(env);

    if (request.method === "GET") {
      if (!id) {
        const params = {
          session:
            String(body.sessionId || url.searchParams.get("session") || "").trim(),
          limit: String(body.limit || url.searchParams.get("limit") || "50").trim(),
        };
        return handleHistoryApi(
          makeInternalRequest(request, "/api/history", "GET", undefined, params),
          env,
          new URL(
            `https://${API_HOST}/api/history?session=${encodeURIComponent(params.session)}&limit=${encodeURIComponent(params.limit)}`,
          ),
        );
      }
      const row = (
        await database
          .prepare(
            `SELECT id, session_id, command, executed_at
             FROM command_history
             WHERE id = ?
             LIMIT 1`,
          )
          .bind(id)
          .all<HistoryRow>()
      ).results?.[0] as HistoryRow | undefined;
      if (!row) return json({ error: "Not found." }, 404);
      return json({ item: row });
    }

    if (request.method === "POST") {
      return handleHistoryApi(
        makeInternalRequest(request, "/api/history", "POST", {
          sessionId: body.sessionId,
          command: body.command,
        }),
        env,
        new URL("https://api.pecunies.com/api/history"),
      );
    }

    if (request.method === "PUT") {
      if (!id) return json({ error: "History id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const command = String(body.command || "")
        .trim()
        .slice(0, 2000);
      if (!command) return json({ error: "command required." }, 400);
      await database
        .prepare(`UPDATE command_history SET command = ? WHERE id = ?`)
        .bind(command, id)
        .run();
      return json({ ok: true, item: { id, command } });
    }

    if (request.method === "DELETE") {
      if (id) {
        const sudo = requireSudo(env, String(body.sudoPassword || ""));
        if (sudo) return sudo;
        await database.prepare(`DELETE FROM command_history WHERE id = ?`).bind(id).run();
        return json({ ok: true });
      }
      const sessionId = String(body.sessionId || url.searchParams.get("session") || "");
      if (!sessionId) return json({ error: "sessionId required." }, 400);
      await database
        .prepare(`DELETE FROM command_history WHERE session_id = ?`)
        .bind(sessionId)
        .run();
      return json({ ok: true });
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "content") {
    const database = db(env);
    if (!database) return json({ error: "D1 binding unavailable." }, 500);
    await database
      .prepare(
        `CREATE TABLE IF NOT EXISTS content_overrides (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      )
      .run();

    if (request.method === "GET") {
      if (!id) {
        return handleContentApi(makeInternalRequest(request, "/api/content"), env);
      }
      const row = (
        await database
          .prepare(`SELECT key, value FROM content_overrides WHERE key = ? LIMIT 1`)
          .bind(id)
          .all<{ key: string; value: string }>()
      ).results?.[0];
      if (!row) return json({ error: "Not found." }, 404);
      return json({ item: row });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const key = String(id || body.key || "").trim();
      if (!key) return json({ error: "key required." }, 400);
      return handleContentApi(
        makeInternalRequest(request, "/api/content", "PUT", {
          key,
          value: body.value,
        }),
        env,
      );
    }

    if (request.method === "DELETE") {
      if (!id) return json({ error: "key required." }, 400);
      await database
        .prepare(`DELETE FROM content_overrides WHERE key = ?`)
        .bind(id)
        .run();
      return json({ ok: true });
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "config") {
    const sessionId = String(
      url.searchParams.get("sessionId") || body.sessionId || "",
    ).trim();
    if (!sessionId) return json({ error: "sessionId required." }, 400);

    if (request.method === "GET") {
      const response = await handleOsPost({
        request: makeInternalRequest(request, "/api/os", "POST", {
          sessionId,
          command: "config list",
        }),
        env,
      } as never);
      const payload = await readResponseJson<{
        config?: Record<string, unknown>;
        cwd?: string;
      }>(response);
      return json({
        config: payload?.config ?? {},
        cwd: payload?.cwd ?? "",
      });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const values =
        body.values && typeof body.values === "object"
          ? (body.values as Record<string, unknown>)
          : body.key
            ? { [String(body.key)]: body.value }
            : {};
      for (const [key, value] of Object.entries(values)) {
        const response = await handleOsPost({
          request: makeInternalRequest(request, "/api/os", "POST", {
            sessionId,
            command: `config set ${key} ${shellQuote(String(value ?? ""))}`,
          }),
          env,
        } as never);
        if (!response.ok) {
          const payload = await readResponseJson<{ error?: string }>(response);
          return json(
            { error: payload?.error || "Failed to update config." },
            response.status,
          );
        }
      }
      return handleCrudApi(
        makeInternalRequest(request, "/api/crud/config", "GET", undefined, {
          sessionId,
        }),
        env,
        new URL(`https://${API_HOST}/api/crud/config?sessionId=${encodeURIComponent(sessionId)}`),
      );
    }

    if (request.method === "DELETE") {
      const response = await handleOsPost({
        request: makeInternalRequest(request, "/api/os", "POST", {
          sessionId,
          command: "config reset",
        }),
        env,
      } as never);
      const payload = await readResponseJson<{
        config?: Record<string, unknown>;
        cwd?: string;
        error?: string;
      }>(response);
      if (!response.ok) {
        return json(
          { error: payload?.error || "Failed to reset config." },
          response.status,
        );
      }
      return json({
        ok: true,
        config: payload?.config ?? {},
        cwd: payload?.cwd ?? "",
      });
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "files") {
    if (request.method === "GET") {
      const path = String(id || url.searchParams.get("path") || "").trim();
      const prefix = String(body.prefix || url.searchParams.get("prefix") || "").trim();
      const includeContent = String(
        body.includeContent || url.searchParams.get("content") || "",
      ).trim();
      const params = path
        ? { path }
        : {
            prefix: prefix || "/",
            content: includeContent === "true" ? "true" : undefined,
          };
      const response = await handleFsGet({
        request: makeInternalRequest(request, "/api/fs", "GET", undefined, params),
        env,
      } as never);
      const payload = await readResponseJson<unknown>(response);
      return json(payload ?? {}, response.status);
    }

    if (request.method === "POST") {
      const response = await handleFsPost({
        request: makeInternalRequest(request, "/api/fs", "POST", {
          path: String(body.path || id || ""),
          content: body.content ?? body.markdown ?? "",
          title: body.title,
          kind: body.kind,
          source: body.source,
          metadata: body.metadata,
        }),
        env,
      } as never);
      const payload = await readResponseJson<unknown>(response);
      return json(payload ?? {}, response.status);
    }

    if (request.method === "PUT") {
      const response = await handleFsPut({
        request: makeInternalRequest(request, "/api/fs", "PUT", {
          path: String(body.path || id || ""),
          content: body.content ?? body.markdown ?? "",
          title: body.title,
          kind: body.kind,
          source: body.source,
          metadata: body.metadata,
        }),
        env,
      } as never);
      const payload = await readResponseJson<unknown>(response);
      return json(payload ?? {}, response.status);
    }

    if (request.method === "DELETE") {
      const path = String(body.path || id || "").trim();
      if (!path) return json({ error: "path required." }, 400);
      const response = await handleFsDelete({
        request: makeInternalRequest(
          request,
          "/api/fs",
          "DELETE",
          undefined,
          { path },
        ),
        env,
      } as never);
      const payload = await readResponseJson<unknown>(response);
      return json(payload ?? {}, response.status);
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "posts") {
    if (request.method === "GET") {
      if (!id) return handlePostsApi(makeInternalRequest(request, "/api/posts"), env);
      const post = await findPostByKey(env, id);
      if (!post) return json({ error: "Not found." }, 404);
      return json({ item: post });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const existing = id ? await findPostByKey(env, id) : null;
      if (id && !existing) return json({ error: "Not found." }, 404);
      const allPosts = await collectAllPosts(env as never);
      const existingPaths = new Set(
        allPosts.map((entry) => String((entry as Record<string, unknown>).path || "")),
      );
      const title = String(body.title || existing?.title || "Post")
        .trim()
        .slice(0, 200);
      const currentBody = String(existing?.body || existing?.markdown || "").trim();
      const nextBody = String(
        body.markdown || body.content || body.body || currentBody,
      );
      const description = String(
        body.description || existing?.description || nextBody.slice(0, 240),
      ).trim();
      const tags = sanitizeTags(body.tags || existing?.tags || []);
      const published = normalizePostDate(
        body.published || body.date || existing?.published,
        new Date().toISOString().slice(0, 10),
      );
      const updated = normalizePostDate(
        body.updated || new Date().toISOString().slice(0, 10),
        published,
      );
      const path =
        String(body.path || existing?.path || "").trim() ||
        nextAvailablePostPath(
          existingPaths,
          title,
          String(body.slug || ""),
          published,
        );
      if (!path.startsWith("/posts/") || !path.endsWith(".md")) {
        return json({ error: "post path must be under /posts and end in .md" }, 400);
      }
      const markdown = buildPostMarkdown({
        title,
        body: nextBody,
        description,
        tags,
        published,
        updated,
      });
      await syncPostToStorage(env as never, path, markdown);
      const item = await findPostByKey(env, path);
      return json({ ok: true, item });
    }

    if (request.method === "DELETE") {
      if (!id) return json({ error: "Post id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const existing = await findPostByKey(env, id);
      if (!existing?.path) return json({ error: "Not found." }, 404);
      await deletePostFromStorage(env as never, String(existing.path));
      return json({ ok: true });
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "bookings") {
    const database = db(env);
    if (!database) return json({ error: "D1 binding unavailable." }, 500);
    await ensureContentInfra(env as never);

    if (request.method === "GET") {
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      if (!id) {
        const limit = Math.min(
          200,
          parseInt(String(url.searchParams.get("limit") || body.limit || "50"), 10) ||
            50,
        );
        const rows = (
          await database
            .prepare(
              `SELECT id, email, date, time, duration, message, meet_link, created_at
               FROM bookings
               ORDER BY created_at DESC
               LIMIT ?`,
            )
            .bind(limit)
            .all<BookingRow>()
        ).results as BookingRow[];
        return json({
          items: rows.map((row) => ({
            id: row.id,
            email: row.email,
            date: row.date,
            time: row.time,
            duration: row.duration,
            message: row.message,
            meetLink: row.meet_link,
            createdAt: row.created_at,
          })),
        });
      }
      const row = (
        await database
          .prepare(
            `SELECT id, email, date, time, duration, message, meet_link, created_at
             FROM bookings
             WHERE id = ?
             LIMIT 1`,
          )
          .bind(id)
          .all<BookingRow>()
      ).results?.[0] as BookingRow | undefined;
      if (!row) return json({ error: "Not found." }, 404);
      return json({
        item: {
          id: row.id,
          email: row.email,
          date: row.date,
          time: row.time,
          duration: row.duration,
          message: row.message,
          meetLink: row.meet_link,
          createdAt: row.created_at,
        },
      });
    }

    if (request.method === "POST") {
      const email = String(body.email || "")
        .trim()
        .slice(0, 255);
      const date = String(body.date || "")
        .trim()
        .slice(0, 64);
      const time = String(body.time || "")
        .trim()
        .slice(0, 64);
      const duration = String(body.duration || "")
        .trim()
        .slice(0, 64);
      const message = String(body.message || "")
        .trim()
        .slice(0, 2000);
      const meetLink = String(body.meetLink || "")
        .trim()
        .slice(0, 500);
      if (!email || !date || !time || !duration || !message || !meetLink) {
        return json(
          { error: "email, date, time, duration, message, and meetLink are required." },
          400,
        );
      }
      const bookingId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();
      await database
        .prepare(
          `INSERT INTO bookings (id, email, date, time, duration, message, meet_link, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(bookingId, email, date, time, duration, message, meetLink, createdAt)
        .run();
      return json({
        ok: true,
        item: {
          id: bookingId,
          email,
          date,
          time,
          duration,
          message,
          meetLink,
          createdAt,
        },
      });
    }

    if (request.method === "PUT") {
      if (!id) return json({ error: "Booking id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const existing = (
        await database
          .prepare(`SELECT id FROM bookings WHERE id = ? LIMIT 1`)
          .bind(id)
          .all<{ id: string }>()
      ).results?.[0];
      if (!existing) return json({ error: "Not found." }, 404);
      const email = String(body.email || "")
        .trim()
        .slice(0, 255);
      const date = String(body.date || "")
        .trim()
        .slice(0, 64);
      const time = String(body.time || "")
        .trim()
        .slice(0, 64);
      const duration = String(body.duration || "")
        .trim()
        .slice(0, 64);
      const message = String(body.message || "")
        .trim()
        .slice(0, 2000);
      const meetLink = String(body.meetLink || "")
        .trim()
        .slice(0, 500);
      await database
        .prepare(
          `UPDATE bookings
           SET email = COALESCE(NULLIF(?, ''), email),
               date = COALESCE(NULLIF(?, ''), date),
               time = COALESCE(NULLIF(?, ''), time),
               duration = COALESCE(NULLIF(?, ''), duration),
               message = COALESCE(NULLIF(?, ''), message),
               meet_link = COALESCE(NULLIF(?, ''), meet_link)
           WHERE id = ?`,
        )
        .bind(email, date, time, duration, message, meetLink, id)
        .run();
      return handleCrudApi(
        makeInternalRequest(request, `/api/crud/bookings/${encodeURIComponent(id)}`),
        env,
        new URL(`https://${API_HOST}/api/crud/bookings/${encodeURIComponent(id)}`),
      );
    }

    if (request.method === "DELETE") {
      if (!id) return json({ error: "Booking id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      await database.prepare(`DELETE FROM bookings WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "scores") {
    if (request.method === "GET") {
      const board = await readLeaderboard(env);
      if (!id) return json({ items: board });
      return json({ items: board[id] ?? [] });
    }

    if (request.method === "POST") {
      const game = String(body.game || "").trim();
      const score = Number(body.score);
      const name = String(body.name || "anonymous")
        .trim()
        .slice(0, 40);
      if (!game || !Number.isFinite(score)) {
        return json({ error: "game and numeric score are required." }, 400);
      }
      const board = await readLeaderboard(env);
      const entries = Array.isArray(board[game]) ? board[game] : [];
      entries.push({
        name: name || "anonymous",
        score,
        at: new Date().toISOString().slice(0, 10),
      });
      board[game] = entries
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, 10);
      await writeLeaderboard(env, board);
      return json({ ok: true, items: board[game] });
    }

    if (request.method === "PUT") {
      if (!id) return json({ error: "game id required." }, 400);
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const items = Array.isArray(body.items) ? body.items : [];
      const normalized = items
        .map((entry) => ({
          name: String((entry as Record<string, unknown>).name || "anonymous")
            .trim()
            .slice(0, 40),
          score: Number((entry as Record<string, unknown>).score || 0),
          at:
            String((entry as Record<string, unknown>).at || "").trim() ||
            new Date().toISOString().slice(0, 10),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      const board = await readLeaderboard(env);
      board[id] = normalized;
      await writeLeaderboard(env, board);
      return json({ ok: true, items: board[id] });
    }

    if (request.method === "DELETE") {
      const sudo = requireSudo(env, String(body.sudoPassword || ""));
      if (sudo) return sudo;
      const board = await readLeaderboard(env);
      if (id) board[id] = [];
      else {
        for (const key of Object.keys(board)) board[key] = [];
      }
      await writeLeaderboard(env, board);
      return json({ ok: true, items: id ? board[id] : board });
    }

    return json({ error: "Method not allowed." }, 405);
  }

  if (resource === "post-events") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }
    const action = String(body.action || "view")
      .trim()
      .toLowerCase();
    const key = String(body.path || body.slug || body.post || "").trim();
    const post = await findPostByKey(env, key);
    if (!post?.path) return json({ error: "Not found." }, 404);
    await recordPostEvent(env as never, String(post.path), action, {
      reaction: body.reaction,
      name: body.name,
      message: body.message,
      kind: body.kind,
      parentId: body.parentId,
    });
    return json({ ok: true });
  }

  if (resource === "metrics") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }
    const response = await handleMetricsPost({
      request: makeInternalRequest(request, "/api/metrics", "POST", {
        sessionId: body.sessionId,
        route: body.route,
      }),
      env,
    } as never);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return json({ error: "Unknown CRUD resource." }, 404);
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

// ── OS (terminal runtime) ─────────────────────────────────────────────────────

async function handleOsApi(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    const response = await handleOsOptions();
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  if (request.method === "POST") {
    const response = await handleOsPost({ request, env } as never);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
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

// ── Stored filesystem (knowledge-store) ───────────────────────────────────────

async function handleFsApi(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    const response = await handleFsOptions();
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  if (request.method === "GET") {
    const response = await handleFsGet({ request, env } as never);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
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
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
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
    if (request.method === "OPTIONS") {
      if (url.pathname === "/api/os") {
        return handleOsApi(request, env);
      }
      if (url.pathname === "/api/fs") {
        return handleFsApi(request, env);
      }
      return handleOptions();
    }

    if (url.pathname === "/api/catalog") {
      return handleCatalogApi(request, env);
    }
    if (url.pathname.startsWith("/api/crud")) {
      return handleCrudApi(request, env, url);
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
    if (url.pathname === "/api/os") {
      return handleOsApi(request, env);
    }
    if (url.pathname === "/api/fs") {
      return handleFsApi(request, env);
    }
    if (url.pathname === "/api/mutate") {
      return handleMutateApi(request, env);
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
