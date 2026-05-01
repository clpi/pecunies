import { apiHeaders, errorJson } from "./knowledge-store.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function catalogDb(env) {
  return env.DB || env.POSTS_DB || null;
}

async function ensureCatalogInfra(env) {
  const d1 = catalogDb(env);
  if (!d1) return;

  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS catalog_entities (
      type TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      tags_json TEXT NOT NULL,
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
}

function rowToEntity(row) {
  return {
    type: row.type,
    slug: row.slug,
    title: row.title,
    category: row.category,
    description: row.description,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    yearsOfExperience: row.years_of_experience,
    summary: row.summary,
    avatar: row.avatar,
    status: row.status,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    details: row.details_json ? JSON.parse(row.details_json) : undefined,
  };
}

async function verifySudo(request, env) {
  const authHeader = request.headers.get("authorization") || "";
  const sudoPassword = env.PECUNIES_SUDO_PASSWD;
  
  if (!sudoPassword) {
    return { ok: false, configured: false };
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  return { ok: token === sudoPassword, configured: true };
}

export async function onRequestGet({ request, env }) {
  await ensureCatalogInfra(env);
  const d1 = catalogDb(env);
  const url = new URL(request.url);
  const slug = url.pathname.split("/").pop();

  if (!d1) {
    return Response.json({ item: null, usedBy: [], topUses: [] }, { headers: apiHeaders() });
  }

  if (slug && slug !== "work") {
    const result = await d1.prepare(
      "SELECT * FROM catalog_entities WHERE type = 'work' AND slug = ?"
    ).bind(slug).first();

    if (!result) {
      return Response.json({ item: null, usedBy: [], topUses: [] }, { headers: apiHeaders() });
    }

    const item = rowToEntity(result);

    const usedByResult = await d1.prepare(`
      SELECT DISTINCT ce.type, ce.slug, ce.title, ce.category, cr.label
      FROM catalog_relations cr
      JOIN catalog_entities ce ON cr.from_type = ce.type AND cr.from_slug = ce.slug
      WHERE cr.to_type = 'work' AND cr.to_slug = ?
      ORDER BY ce.type, ce.slug
      LIMIT 50
    `).bind(slug).all();

    const usedBy = (usedByResult.results || []).map(row => ({
      type: row.type,
      slug: row.slug,
      title: row.title,
      category: row.category,
      label: row.label,
    }));

    return Response.json({ item, usedBy, topUses: usedBy.slice(0, 10) }, { headers: apiHeaders() });
  }

  const result = await d1.prepare(
    "SELECT * FROM catalog_entities WHERE type = 'work' ORDER BY slug"
  ).all();

  const items = (result.results || []).map(rowToEntity);
  return Response.json({ items }, { headers: apiHeaders() });
}

export async function onRequestPost({ request, env }) {
  await ensureCatalogInfra(env);
  const d1 = catalogDb(env);

  if (!d1) {
    return errorJson("Database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  try {
    const body = await request.json();
    const action = body.action;
    const entity = body.entity;

    if (action === "update" || action === "create") {
      if (!entity || !entity.slug) {
        return errorJson("entity with slug required", 400);
      }

      const row = {
        type: "work",
        slug: entity.slug,
        title: entity.title,
        category: entity.category,
        description: entity.description,
        tags_json: JSON.stringify(entity.tags || []),
        years_of_experience: entity.yearsOfExperience || null,
        summary: entity.summary || null,
        avatar: entity.avatar || null,
        status: entity.status || null,
        metadata_json: entity.metadata ? JSON.stringify(entity.metadata) : null,
        details_json: entity.details ? JSON.stringify(entity.details) : null,
        updated_at: new Date().toISOString(),
      };
      
      await d1.prepare(`
        INSERT INTO catalog_entities (
          type, slug, title, category, description, tags_json, years_of_experience,
          summary, avatar, status, metadata_json, details_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(type, slug) DO UPDATE SET
          title = excluded.title,
          category = excluded.category,
          description = excluded.description,
          tags_json = excluded.tags_json,
          years_of_experience = excluded.years_of_experience,
          summary = excluded.summary,
          avatar = excluded.avatar,
          status = excluded.status,
          metadata_json = excluded.metadata_json,
          details_json = excluded.details_json,
          updated_at = excluded.updated_at
      `).bind(
        row.type, row.slug, row.title, row.category, row.description, row.tags_json,
        row.years_of_experience, row.summary, row.avatar, row.status,
        row.metadata_json, row.details_json, row.updated_at
      ).run();

      if (entity.related && Array.isArray(entity.related)) {
        await d1.prepare("DELETE FROM catalog_relations WHERE from_type = 'work' AND from_slug = ?")
          .bind(row.slug).run();
        
        for (const rel of entity.related) {
          await d1.prepare(`
            INSERT INTO catalog_relations (from_type, from_slug, relation_type, to_type, to_slug, label)
            VALUES ('work', ?, 'related', ?, ?, ?)
          `).bind(row.slug, rel.type, rel.slug, rel.label || null).run();
        }
      }

      return Response.json({ entity: rowToEntity(row) }, { headers: apiHeaders() });
    }

    if (action === "delete") {
      const slug = body.slug;
      if (!slug) {
        return errorJson("slug required", 400);
      }

      await d1.prepare("DELETE FROM catalog_entities WHERE type = 'work' AND slug = ?")
        .bind(slug).run();
      await d1.prepare("DELETE FROM catalog_relations WHERE from_type = 'work' AND from_slug = ?")
        .bind(slug).run();
      await d1.prepare("DELETE FROM catalog_relations WHERE to_type = 'work' AND to_slug = ?")
        .bind(slug).run();

      return Response.json({ ok: true }, { headers: apiHeaders() });
    }

    return errorJson("Unsupported action", 400);
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequestDelete({ request, env }) {
  await ensureCatalogInfra(env);
  const d1 = catalogDb(env);
  const url = new URL(request.url);
  const slug = url.pathname.split("/").pop();

  if (!d1) {
    return errorJson("Database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  if (!slug || slug === "work") {
    return errorJson("slug required", 400);
  }

  await d1.prepare("DELETE FROM catalog_entities WHERE type = 'work' AND slug = ?")
    .bind(slug).run();
  await d1.prepare("DELETE FROM catalog_relations WHERE from_type = 'work' AND from_slug = ?")
    .bind(slug).run();
  await d1.prepare("DELETE FROM catalog_relations WHERE to_type = 'work' AND to_slug = ?")
    .bind(slug).run();

  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
