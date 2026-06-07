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

export async function onRequestPost({ request, env }) {
  await ensureCatalogInfra(env);
  const d1 = catalogDb(env);

  if (!d1) {
    return errorJson("Catalog database not available", 503);
  }

  try {
    const body = await request.json();
    const action = body.action;
    const sudoPassword = body.sudoPassword;
    
    // Verify sudo for write operations
    if (sudoPassword) {
      const sudo = await verifySudo(
        { headers: { get: (name) => name === "authorization" ? `Bearer ${sudoPassword}` : null } },
        env
      );
      if (!sudo.ok) {
        return errorJson("Unauthorized: invalid sudo password", 401);
      }
    }

    if (action === "tag_add" || action === "tag_remove") {
      const { type, slug, tag } = body;
      if (!type || !slug || !tag) {
        return errorJson("type, slug, and tag are required", 400);
      }

      // Get the entity
      const result = await d1.prepare(
        "SELECT * FROM catalog_entities WHERE type = ? AND slug = ?"
      ).bind(type, slug).first();

      if (!result) {
        return errorJson("Entity not found", 404);
      }

      const entity = rowToEntity(result);
      const tags = entity.tags || [];
      
      if (action === "tag_add") {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      } else {
        const idx = tags.indexOf(tag);
        if (idx >= 0) {
          tags.splice(idx, 1);
        }
      }

      // Update the entity
      await d1.prepare(`
        UPDATE catalog_entities 
        SET tags_json = ?, updated_at = ?
        WHERE type = ? AND slug = ?
      `).bind(JSON.stringify(tags), new Date().toISOString(), type, slug).run();

      return Response.json({ 
        entity: { ...entity, tags },
        ok: true 
      }, { headers: apiHeaders() });
    }

    if (action === "quick_link_create") {
      const { title, url } = body;
      if (!title || !url) {
        return errorJson("title and url are required", 400);
      }

      const slug = String(title || "link")
        .toLowerCase()
        .replace(/https?:\/\//, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `link-${Date.now().toString(36)}`;

      const entity = {
        type: "link",
        slug,
        title,
        category: "quick-link",
        description: `Quick link for ${title}.`,
        tags: ["links", "quick-link"],
        metadata: { url, source: "quick-link" },
      };

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
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).bind(
        row.type, row.slug, row.title, row.category, row.description, row.tags_json,
        row.years_of_experience, row.summary, row.avatar, row.status,
        row.metadata_json, row.details_json, row.updated_at
      ).run();

      return Response.json({ entity: rowToEntity(row), ok: true }, { headers: apiHeaders() });
    }

    if (action === "signal_upsert") {
      const { signalId, signalLabel, signalValue, signalDetail, signalAccent, signalMode } = body;
      if (!signalId || !signalLabel || !signalValue) {
        return errorJson("signalId, signalLabel, and signalValue are required", 400);
      }

      const entity = {
        type: "signal",
        slug: signalId,
        title: signalLabel,
        category: "metric",
        description: signalValue,
        tags: ["signal", "metric"],
        metadata: {
          value: signalValue,
          detail: signalDetail || "",
          accent: signalAccent || "",
          mode: signalMode || 0,
        },
      };

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
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).bind(
        row.type, row.slug, row.title, row.category, row.description, row.tags_json,
        row.years_of_experience, row.summary, row.avatar, row.status,
        row.metadata_json, row.details_json, row.updated_at
      ).run();

      return Response.json({ entity: rowToEntity(row), ok: true }, { headers: apiHeaders() });
    }

    if (action === "signal_delete") {
      const { signalId } = body;
      if (!signalId) {
        return errorJson("signalId is required", 400);
      }

      await d1.prepare("DELETE FROM catalog_entities WHERE type = 'signal' AND slug = ?")
        .bind(signalId).run();

      return Response.json({ ok: true }, { headers: apiHeaders() });
    }

    return errorJson("Unsupported action", 400);
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
