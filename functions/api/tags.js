import { apiHeaders, errorJson } from "./knowledge-store.js";

const CATALOG_TYPES = {
  tag: { command: "tag" },
  skill: { command: "skill" },
  tool: { command: "tool" },
  project: { command: "project" },
  command: { command: "command" },
  view: { command: "view" },
  app: { command: "app" },
  link: { command: "link" },
  work: { command: "work" },
  workflow: { command: "workflow" },
  step: { command: "step" },
  execution: { command: "execution" },
  agent: { command: "agent" },
  hook: { command: "hook" },
  trigger: { command: "trigger" },
  user: { command: "user" },
  job: { command: "job" },
  systemprompt: { command: "systemprompt" },
  data: { command: "data" },
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function tagsDb(env) {
  return env.DB || env.POSTS_DB || null;
}

async function ensureTagsInfra(env) {
  const d1 = tagsDb(env);
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

  await d1.prepare(`
    CREATE INDEX IF NOT EXISTS idx_catalog_tags ON catalog_entities(type, slug)
  `).run();
}

export async function onRequestGet({ request, env }) {
  await ensureTagsInfra(env);
  const d1 = tagsDb(env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Handle /api/tags/{slug}/usage
  if (pathParts.length >= 3 && pathParts[2] === "usage") {
    const slug = pathParts[1];
    
    if (!d1) {
      return Response.json({
        usage: { slug, count: 0, uses: [], related: [] }
      }, { headers: apiHeaders() });
    }

    // Find the tag entity
    const tagResult = await d1.prepare(`
      SELECT title, description, tags_json
      FROM catalog_entities
      WHERE type = 'tag' AND slug = ?
    `).bind(slug).first();

    if (!tagResult) {
      return errorJson("Tag not found", 404);
    }

    // Find entities that use this tag
    const usesResult = await d1.prepare(`
      SELECT type, slug, title, category
      FROM catalog_entities
      WHERE tags_json LIKE ?
      ORDER BY type, slug
      LIMIT 50
    `).bind(`%"${slug}"%`).all();

    const uses = (usesResult.results || []).map(row => ({
      label: row.title,
      type: row.type,
      command: `${CATALOG_TYPES[row.type]?.command || row.type} ${row.slug}`,
    }));

    // Find related tags (tags that appear on the same entities)
    const relatedSet = new Set();
    for (const use of uses) {
      const entityResult = await d1.prepare(`
        SELECT tags_json FROM catalog_entities WHERE type = ? AND slug = ?
      `).bind(use.type, use.slug).first();
      
      if (entityResult?.tags_json) {
        try {
          const tags = JSON.parse(entityResult.tags_json);
          for (const t of tags) {
            if (t !== slug) relatedSet.add(t);
          }
        } catch {}
      }
    }

    return Response.json({
      usage: {
        slug,
        description: tagResult.description,
        count: uses.length,
        uses,
        related: Array.from(relatedSet).slice(0, 10),
      }
    }, { headers: apiHeaders() });
  }

  // Handle /api/tags - list all tags
  if (!d1) {
    return Response.json({ tags: [] }, { headers: apiHeaders() });
  }

  const result = await d1.prepare(`
    SELECT slug, title, description, tags_json
    FROM catalog_entities
    WHERE type = 'tag'
    ORDER BY slug
  `).all();

  const tags = (result.results || []).map(row => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
  }));

  return Response.json({ tags }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
