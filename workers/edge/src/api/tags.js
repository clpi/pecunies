import { apiHeaders, errorJson, requireApiAuth } from "./knowledge-store.js";

const CATALOG_ENTITY_TYPES = new Set([
  "tag", "skill", "tool", "project", "command", "view", "app", "link",
  "work", "workflow", "step", "execution", "agent", "hook", "trigger",
  "user", "job", "systemprompt", "data",
]);

const TYPE_COMMANDS = {
  tag: "tag", skill: "skill", tool: "tool", project: "project",
  command: "command", view: "view", app: "app", link: "link",
  work: "work", workflow: "workflow", step: "step", execution: "execution",
  agent: "agent", hook: "hook", trigger: "trigger", user: "user",
  job: "job", systemprompt: "systemprompt", data: "data",
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function tagsDb(env) {
  return env.DB || env.POSTS_DB || null;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "untitled";
}

async function ensureTagsInfra(env) {
  const d1 = tagsDb(env);
  if (!d1) return;

  // Columnar schema (Pages Function context)
  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS catalog_entities (
      type TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      years_of_experience INTEGER,
      summary TEXT,
      avatar TEXT,
      status TEXT,
      metadata_json TEXT,
      details_json TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (type, slug)
    )
  `).run();

  await d1.prepare(
    `CREATE INDEX IF NOT EXISTS idx_catalog_type_slug ON catalog_entities(type, slug)`,
  ).run();
}

// Reads a single row — handles both schemas (payload_json or columnar).
async function readTagRow(d1, slug) {
  let row = null;
  // Try payload_json schema first
  try {
    row = await d1
      .prepare("SELECT type, slug, payload_json, deleted FROM catalog_entities WHERE type='tag' AND slug=? LIMIT 1")
      .bind(slug)
      .first();
    if (row !== null && row.payload_json !== undefined) {
      if (row.deleted) return null;
      try {
        return { ...JSON.parse(row.payload_json), _schema: "payload_json" };
      } catch {
        return null;
      }
    }
  } catch {}

  // Columnar schema fallback
  try {
    row = await d1
      .prepare("SELECT type, slug, title, category, description, tags_json, summary, status, updated_at FROM catalog_entities WHERE type='tag' AND slug=? LIMIT 1")
      .bind(slug)
      .first();
    if (!row) return null;
    return {
      type: "tag",
      slug: row.slug,
      title: row.title,
      category: row.category || "",
      description: row.description || "",
      tags: tryJsonParse(row.tags_json, []),
      summary: row.summary || null,
      status: row.status || null,
      _schema: "columnar",
    };
  } catch {
    return null;
  }
}

// Detects which schema is in use by probing for the payload_json column.
async function detectSchema(d1) {
  try {
    await d1.prepare("SELECT payload_json FROM catalog_entities LIMIT 0").all();
    return "payload_json";
  } catch {
    return "columnar";
  }
}

function tryJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function upsertTagRow(d1, entity) {
  const now = new Date().toISOString();
  const schema = await detectSchema(d1);

  if (schema === "payload_json") {
    const payload = {
      type: "tag",
      slug: entity.slug,
      title: entity.title,
      category: entity.category || "tag",
      description: entity.description || "",
      tags: entity.tags || [],
      summary: entity.summary || null,
      status: entity.status || null,
      metadata: entity.metadata || {},
    };
    await d1.prepare(`
      INSERT INTO catalog_entities (type, slug, payload_json, deleted, updated_at)
      VALUES ('tag', ?, ?, 0, ?)
      ON CONFLICT(type, slug) DO UPDATE SET
        payload_json = excluded.payload_json,
        deleted = 0,
        updated_at = excluded.updated_at
    `).bind(entity.slug, JSON.stringify(payload), now).run();
    return payload;
  }

  // Columnar schema
  await d1.prepare(`
    INSERT INTO catalog_entities (type, slug, title, category, description, tags_json, summary, status, metadata_json, updated_at)
    VALUES ('tag', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(type, slug) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      description = excluded.description,
      tags_json = excluded.tags_json,
      summary = excluded.summary,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    entity.slug,
    entity.title,
    entity.category || "tag",
    entity.description || "",
    JSON.stringify(entity.tags || []),
    entity.summary || null,
    entity.status || null,
    entity.metadata ? JSON.stringify(entity.metadata) : null,
    now,
  ).run();

  return { type: "tag", ...entity };
}

// ── GET /api/tags                  — list all tags
// ── GET /api/tags/{slug}           — get one tag
// ── GET /api/tags/{slug}/usage     — tag usage (entities that reference it)
export async function onRequestGet({ request, env }) {
  await ensureTagsInfra(env);
  const d1 = tagsDb(env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // pathParts[0] = "api", [1] = "tags", [2] = slug?, [3] = "usage"?

  const slug = pathParts[2] ? decodeURIComponent(pathParts[2]) : null;
  const isUsage = pathParts[3] === "usage";

  // ── GET /api/tags/{slug}/usage ─────────────────────────────────────────────
  if (slug && isUsage) {
    if (!d1) return Response.json({ usage: { slug, count: 0, uses: [], related: [] } }, { headers: apiHeaders() });

    const tag = await readTagRow(d1, slug);
    if (!tag) return errorJson("Tag not found", 404);

    let uses = [];
    let relatedSet = new Set();
    const schema = await detectSchema(d1);

    if (schema === "payload_json") {
      // payload_json: scan JSON text for tag references
      const rows = await d1.prepare(
        `SELECT type, slug, payload_json FROM catalog_entities WHERE deleted=0 AND payload_json LIKE ? ORDER BY type, slug LIMIT 50`,
      ).bind(`%"${slug}"%`).all();
      uses = (rows?.results || []).flatMap((row) => {
        try {
          const entity = JSON.parse(row.payload_json);
          if (!Array.isArray(entity.tags) || !entity.tags.includes(slug)) return [];
          const tags = entity.tags;
          for (const t of tags) if (t !== slug) relatedSet.add(t);
          return [{ label: entity.title || row.slug, type: row.type, command: `${TYPE_COMMANDS[row.type] || row.type} ${row.slug}` }];
        } catch { return []; }
      });
    } else {
      // columnar: scan tags_json
      const rows = await d1.prepare(
        `SELECT type, slug, title, tags_json FROM catalog_entities WHERE tags_json LIKE ? ORDER BY type, slug LIMIT 50`,
      ).bind(`%"${slug}"%`).all();
      uses = (rows?.results || []).map((row) => {
        const tags = tryJsonParse(row.tags_json, []);
        for (const t of tags) if (t !== slug) relatedSet.add(t);
        return { label: row.title, type: row.type, command: `${TYPE_COMMANDS[row.type] || row.type} ${row.slug}` };
      });
    }

    return Response.json({
      usage: {
        slug,
        title: tag.title,
        description: tag.description || "",
        count: uses.length,
        uses,
        related: Array.from(relatedSet).slice(0, 12),
      },
    }, { headers: apiHeaders() });
  }

  // ── GET /api/tags/{slug} ───────────────────────────────────────────────────
  if (slug) {
    if (!d1) return errorJson("Tag not found", 404);
    const tag = await readTagRow(d1, slug);
    if (!tag) return errorJson("Tag not found", 404);
    const { _schema: _, ...clean } = tag;
    return Response.json({ tag: clean }, { headers: apiHeaders() });
  }

  // ── GET /api/tags (list) ───────────────────────────────────────────────────
  if (!d1) return Response.json({ tags: [] }, { headers: apiHeaders() });

  const schema = await detectSchema(d1);
  let tags = [];

  if (schema === "payload_json") {
    const rows = await d1.prepare(
      `SELECT slug, payload_json FROM catalog_entities WHERE type='tag' AND deleted=0 ORDER BY slug`,
    ).all();
    tags = (rows?.results || []).map((row) => {
      try {
        const e = JSON.parse(row.payload_json);
        return { slug: row.slug, title: e.title || row.slug, description: e.description || "", tags: e.tags || [] };
      } catch { return { slug: row.slug, title: row.slug, description: "", tags: [] }; }
    });
  } else {
    const rows = await d1.prepare(
      `SELECT slug, title, description, tags_json FROM catalog_entities WHERE type='tag' ORDER BY slug`,
    ).all();
    tags = (rows?.results || []).map((row) => ({
      slug: row.slug,
      title: row.title,
      description: row.description || "",
      tags: tryJsonParse(row.tags_json, []),
    }));
  }

  return Response.json({ tags }, { headers: apiHeaders() });
}

// ── POST /api/tags — create or update a tag (action: create | update, or inferred)
export async function onRequestPost({ request, env }) {
  const auth = requireApiAuth(request, env);
  if (!auth.ok) return errorJson(auth.message, auth.status);

  await ensureTagsInfra(env);
  const d1 = tagsDb(env);
  if (!d1) return errorJson("Database unavailable", 503);

  let body;
  try { body = await request.json(); } catch { return errorJson("Invalid JSON body", 400); }

  const rawSlug = String(body.slug || body.tag || "").trim();
  const slug = slugify(rawSlug);
  if (!slug || slug === "untitled") return errorJson("slug is required", 400);

  const title = String(body.title || slug).trim().slice(0, 120);
  const entity = {
    slug,
    title,
    category: String(body.category || "tag").trim(),
    description: String(body.description || "").trim().slice(0, 500),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => slugify(t)).filter(Boolean) : [],
    summary: body.summary ? String(body.summary).trim().slice(0, 1000) : null,
    status: body.status ? String(body.status).trim().slice(0, 40) : null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };

  const result = await upsertTagRow(d1, entity);
  return Response.json({ ok: true, tag: result }, { headers: apiHeaders() });
}

// ── PUT /api/tags/{slug} — update an existing tag
export async function onRequestPut({ request, env }) {
  const auth = requireApiAuth(request, env);
  if (!auth.ok) return errorJson(auth.message, auth.status);

  await ensureTagsInfra(env);
  const d1 = tagsDb(env);
  if (!d1) return errorJson("Database unavailable", 503);

  const url = new URL(request.url);
  const pathSlug = url.pathname.split("/").filter(Boolean)[2];
  const slug = pathSlug ? decodeURIComponent(pathSlug) : null;
  if (!slug) return errorJson("Tag slug required in path", 400);

  let body;
  try { body = await request.json(); } catch { return errorJson("Invalid JSON body", 400); }

  const existing = await readTagRow(d1, slug);
  if (!existing) return errorJson(`Tag not found: ${slug}`, 404);

  const entity = {
    slug,
    title: String(body.title || existing.title || slug).trim().slice(0, 120),
    category: String(body.category || existing.category || "tag").trim(),
    description: String(body.description ?? existing.description ?? "").trim().slice(0, 500),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => slugify(t)).filter(Boolean) : (existing.tags || []),
    summary: body.summary !== undefined ? String(body.summary || "").trim().slice(0, 1000) || null : (existing.summary || null),
    status: body.status !== undefined ? String(body.status || "").trim().slice(0, 40) || null : (existing.status || null),
    metadata: body.metadata && typeof body.metadata === "object" ? { ...(existing.metadata || {}), ...body.metadata } : (existing.metadata || {}),
  };

  const result = await upsertTagRow(d1, entity);
  return Response.json({ ok: true, tag: result }, { headers: apiHeaders() });
}

// ── DELETE /api/tags/{slug} — delete a tag
export async function onRequestDelete({ request, env }) {
  const auth = requireApiAuth(request, env);
  if (!auth.ok) return errorJson(auth.message, auth.status);

  await ensureTagsInfra(env);
  const d1 = tagsDb(env);
  if (!d1) return errorJson("Database unavailable", 503);

  const url = new URL(request.url);
  const pathSlug = url.pathname.split("/").filter(Boolean)[2];
  const slug = pathSlug ? decodeURIComponent(pathSlug) : null;
  if (!slug) return errorJson("Tag slug required in path", 400);

  const schema = await detectSchema(d1);

  if (schema === "payload_json") {
    await d1.prepare(
      `UPDATE catalog_entities SET deleted=1, updated_at=? WHERE type='tag' AND slug=?`,
    ).bind(new Date().toISOString(), slug).run();
  } else {
    await d1.prepare("DELETE FROM catalog_entities WHERE type='tag' AND slug=?").bind(slug).run();
  }

  // Also remove from post_tags table
  try {
    await d1.prepare("DELETE FROM post_tags WHERE tag=?").bind(slug).run();
  } catch {}

  // Also remove from tag_items table
  try {
    await d1.prepare("DELETE FROM tag_items WHERE tag_slug=?").bind(slug).run();
    await d1.prepare("DELETE FROM tags WHERE slug=?").bind(slug).run();
  } catch {}

  return Response.json({ ok: true, deleted: slug }, { headers: apiHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...jsonHeaders,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
      Allow: "GET, POST, PUT, DELETE, OPTIONS",
    },
  });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
