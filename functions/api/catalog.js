import { apiHeaders, errorJson, db } from "./knowledge-store.js";

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

  const stmts = [
    `CREATE TABLE IF NOT EXISTS catalog_entities (
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
    )`,
    `CREATE INDEX IF NOT EXISTS idx_catalog_type ON catalog_entities(type)`,
    `CREATE INDEX IF NOT EXISTS idx_catalog_slug ON catalog_entities(slug)`,
    `CREATE TABLE IF NOT EXISTS catalog_relations (
      from_type TEXT NOT NULL,
      from_slug TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      to_type TEXT NOT NULL,
      to_slug TEXT NOT NULL,
      label TEXT,
      PRIMARY KEY (from_type, from_slug, relation_type, to_type, to_slug)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_catalog_relations_from ON catalog_relations(from_type, from_slug)`,
    `CREATE INDEX IF NOT EXISTS idx_catalog_relations_to ON catalog_relations(to_type, to_slug)`,
  ];

  for (const sql of stmts) {
    await d1.prepare(sql).run();
  }
}

function entityToRow(entity) {
  return {
    type: entity.type,
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
  const type = url.searchParams.get("type");

  if (!d1) {
    return Response.json({ items: [], types: [] }, { headers: apiHeaders() });
  }

  let query = "SELECT * FROM catalog_entities";
  const params = [];
  
  if (type) {
    query += " WHERE type = ?";
    params.push(type);
  }
  
  query += " ORDER BY type, slug";

  const result = await d1.prepare(query).bind(...params).all();
  const items = (result.results || []).map(rowToEntity);

  const typesResult = await d1.prepare("SELECT DISTINCT type FROM catalog_entities ORDER BY type").all();
  const types = (typesResult.results || []).map(r => r.type);

  return Response.json({ items, types }, { headers: apiHeaders() });
}

export async function onRequestPost({ request, env }) {
  await ensureCatalogInfra(env);
  const d1 = catalogDb(env);

  if (!d1) {
    return errorJson("Catalog database not available", 503);
  }

  try {
    const body = await request.json();
    const action = body.action;
    const sudo = await verifySudo(request, env);

    if (action === "update" || action === "create") {
      if (!sudo.ok) {
        return errorJson("Unauthorized: sudo required", 401);
      }

      const entity = body.entity;
      if (!entity || !entity.type || !entity.slug) {
        return errorJson("entity with type and slug required", 400);
      }

      const row = entityToRow(entity);
      
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

      // Handle relations
      if (entity.related && Array.isArray(entity.related)) {
        await d1.prepare("DELETE FROM catalog_relations WHERE from_type = ? AND from_slug = ?")
          .bind(entity.type, entity.slug).run();
        
        for (const rel of entity.related) {
          await d1.prepare(`
            INSERT INTO catalog_relations (from_type, from_slug, relation_type, to_type, to_slug, label)
            VALUES (?, ?, 'related', ?, ?, ?)
          `).bind(entity.type, entity.slug, rel.type, rel.slug, rel.label || null).run();
        }
      }

      return Response.json({ entity: rowToEntity(row) }, { headers: apiHeaders() });
    }

    if (action === "delete") {
      if (!sudo.ok) {
        return errorJson("Unauthorized: sudo required", 401);
      }

      const type = body.type;
      const slug = body.slug;
      
      if (!type || !slug) {
        return errorJson("type and slug required", 400);
      }

      await d1.prepare("DELETE FROM catalog_entities WHERE type = ? AND slug = ?")
        .bind(type, slug).run();
      await d1.prepare("DELETE FROM catalog_relations WHERE from_type = ? AND from_slug = ?")
        .bind(type, slug).run();
      await d1.prepare("DELETE FROM catalog_relations WHERE to_type = ? AND to_slug = ?")
        .bind(type, slug).run();

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
  const type = url.pathname.split("/").pop();
  const slug = url.searchParams.get("slug");

  if (!d1) {
    return errorJson("Catalog database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  if (!type || !slug) {
    return errorJson("type and slug required", 400);
  }

  await d1.prepare("DELETE FROM catalog_entities WHERE type = ? AND slug = ?")
    .bind(type, slug).run();
  await d1.prepare("DELETE FROM catalog_relations WHERE from_type = ? AND from_slug = ?")
    .bind(type, slug).run();
  await d1.prepare("DELETE FROM catalog_relations WHERE to_type = ? AND to_slug = ?")
    .bind(type, slug).run();

  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
