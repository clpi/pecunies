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
import { collectAllPosts } from "../../../functions/api/posts.js";

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
  PECUNIES_SUDO_PASSWD?: string;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
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
  const map = new Map(seed.map((entity) => [`${entity.type}:${entity.slug}`, entity]));
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
    a.type === b.type ? a.title.localeCompare(b.title) : a.type.localeCompare(b.type),
  );
}

function reverseLinks(target: CatalogEntity, entities: CatalogEntity[]): CatalogEntity[] {
  return entities.filter((entity) =>
    (entity.related ?? []).some((ref) => ref.type === target.type && ref.slug === target.slug),
  );
}

function tagTopUses(tagSlug: string, entities: CatalogEntity[]): CatalogEntity[] {
  return entities
    .filter((entity) => entity.tags.includes(tagSlug) && entity.type !== "tag")
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 6);
}

async function handleCatalogApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const all = await mergedCatalog(env);

  if (request.method === "GET") {
    const type = normalizeCatalogType(url.searchParams.get("type") || "");
    const slug = normalizeSlug(url.searchParams.get("slug") || "");
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

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        entity?: CatalogEntity;
        type?: string;
        slug?: string;
        sudoPassword?: string;
      }
    | null;

  const action = String(body?.action || "").toLowerCase();
  const password = String(body?.sudoPassword || "");
  if (!env.PECUNIES_SUDO_PASSWD || password !== env.PECUNIES_SUDO_PASSWD) {
    return json({ error: "sudo authentication failed." }, 403);
  }
  const database = db(env);
  if (!database) return json({ error: "D1 binding unavailable." }, 500);
  await ensureCatalogInfra(env);

  if (action === "update" || action === "create") {
    const entity = body?.entity;
    if (!entity?.type || !entity?.slug || !entity?.title) {
      return json({ error: "type, slug, and title are required." }, 400);
    }
    const normalizedType = normalizeCatalogType(entity.type);
    if (!normalizedType) return json({ error: "Unknown entity type." }, 400);
    const normalizedEntity: CatalogEntity = {
      ...entity,
      type: normalizedType,
      slug: normalizeSlug(entity.slug),
      tags: Array.from(new Set((entity.tags ?? []).map((tag) => normalizeSlug(tag)).filter(Boolean))),
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
    const type = normalizeCatalogType(String(body?.type || ""));
    const slug = normalizeSlug(String(body?.slug || ""));
    if (!type || !slug) return json({ error: "type and slug are required." }, 400);
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

async function handleAuthApi(request: Request, env: Env): Promise<Response> {
  const database = db(env);
  if (!database) return json({ error: "D1 binding unavailable." }, 500);
  await ensureCatalogInfra(env);
  if (request.method === "GET") {
    const users = await dynamicUsers(env);
    return json({ users });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        email?: string;
        username?: string;
        fullName?: string;
      }
    | null;
  const action = String(body?.action || "").toLowerCase();
  const email = String(body?.email || "").trim().toLowerCase();
  const username = normalizeSlug(body?.username || "");
  const fullName = String(body?.fullName || "").trim().slice(0, 120);
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

function isHtmlRequest(request: Request): boolean {
  return String(request.headers.get("accept") || "").includes("text/html");
}

function cleanRoutePath(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, "");
}

function looksLikeAsset(pathname: string): boolean {
  return /\.[a-z0-9]+$/i.test(pathname);
}

async function resolveSeo(pathname: string, env: Env): Promise<{ title: string; description: string; canonicalPath: string } | null> {
  const route = cleanRoutePath(pathname);
  if (!route) {
    return {
      title: "pecunies",
      description: "Command-driven portfolio and terminal shell for Chris Pecunies.",
      canonicalPath: "/",
    };
  }

  const staticPages: Record<string, { title: string; description: string }> = {
    about: {
      title: "About | pecunies",
      description: "Architecture and design notes for the pecunies terminal portfolio.",
    },
    resume: {
      title: "Resume | pecunies",
      description: "Professional profile, resume, and work summary for Chris Pecunies.",
    },
    projects: {
      title: "Projects | pecunies",
      description: "Projects, systems work, and shipped portfolio items from Chris Pecunies.",
    },
    posts: {
      title: "Posts | pecunies",
      description: "Terminal-native posts, notes, and markdown content from pecunies.",
    },
    links: {
      title: "Links | pecunies",
      description: "External profiles, project links, and public contact surfaces.",
    },
    contact: {
      title: "Contact | pecunies",
      description: "Contact surfaces and direct reachability for Chris Pecunies.",
    },
    view: {
      title: "Views | pecunies",
      description: "Route and view index for the terminal site.",
    },
    app: {
      title: "Apps | pecunies",
      description: "Interactive apps and games available inside the terminal shell.",
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
  const entity = catalog.find((item) => item.type === type && item.slug === normalizeSlug(tail));
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
  return (
    [
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
    ].includes(first)
  );
}

function rewriteToRoot(upstreamUrl: URL): URL {
  const next = new URL(upstreamUrl.toString());
  next.pathname = "/";
  next.search = "";
  next.hash = "";
  return next;
}

function injectSeo(response: Response, seo: { title: string; description: string; canonicalPath: string }): Response {
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

    if (url.pathname === "/api/catalog") {
      return handleCatalogApi(request, env);
    }
    if (url.pathname === "/api/auth") {
      return handleAuthApi(request, env);
    }

    const upstreamUrl = new URL(request.url);
    upstreamUrl.hostname = "pecunies-chaos-portfolio.pages.dev";
    upstreamUrl.protocol = "https:";
    upstreamUrl.port = "";

    if (url.hostname === API_HOST && !upstreamUrl.pathname.startsWith("/api/")) {
      upstreamUrl.pathname = `/api${upstreamUrl.pathname === "/" ? "/knowledge" : upstreamUrl.pathname}`;
    }

    const shouldRewriteSpa = isHtmlRequest(request) && spaRouteCandidate(url.pathname);
    const targetUrl = shouldRewriteSpa ? rewriteToRoot(upstreamUrl) : upstreamUrl;
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
