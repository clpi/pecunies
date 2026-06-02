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

function autocompleteDb(env) {
  return env.DB || env.POSTS_DB || null;
}

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

async function ensureAutocompleteInfra(env) {
  const d1 = autocompleteDb(env);
  if (!d1) return;

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

  await d1.prepare(`
    CREATE INDEX IF NOT EXISTS idx_catalog_slug ON catalog_entities(slug)
  `).run();
}

function payloadToSuggestion(row, scope) {
  let entity = {};
  try { entity = JSON.parse(row.payload_json); } catch { /* ignore */ }
  const base = {
    value: row.slug,
    label: entity.title || row.slug,
    description: entity.description || "",
    category: entity.category || scope || row.type || "",
    tags: Array.isArray(entity.tags) ? entity.tags : [],
  };
  if (entity.years_of_experience != null) base.yearsOfExperience = entity.years_of_experience;
  if (scope === "command") base.usage = row.slug;
  return base;
}

export async function onRequestGet({ request, env }) {
  await ensureAutocompleteInfra(env);
  const d1 = autocompleteDb(env);
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const q = url.searchParams.get("q");

  if (!scope || !q) {
    return errorJson("scope and q query parameters required", 400);
  }

  if (!d1) {
    return Response.json({ suggestions: [] }, { headers: apiHeaders() });
  }

  const schema = await detectSchema(d1);
  const queryLower = q.toLowerCase();
  const prefix = `${queryLower}%`;
  let suggestions = [];
  const entityType = scope === "command" || scope === "tag" || scope === "skill" ? scope : null;

  if (schema === "payload_json") {
    const whereType = entityType ? `type = '${entityType}' AND ` : "";
    const result = await d1.prepare(`
      SELECT type, slug, payload_json
      FROM catalog_entities
      WHERE ${whereType}deleted = 0 AND (slug LIKE ? OR payload_json LIKE ?)
      ORDER BY slug
      LIMIT 20
    `).bind(prefix, `%${queryLower}%`).all();

    suggestions = (result.results || []).map(row => payloadToSuggestion(row, scope));
  } else if (scope === "command") {
    const result = await d1.prepare(`
      SELECT slug, title, description, category, years_of_experience, tags_json
      FROM catalog_entities
      WHERE type = 'command' AND (slug LIKE ? OR title LIKE ?)
      ORDER BY slug
      LIMIT 20
    `).bind(prefix, prefix).all();

    suggestions = (result.results || []).map(row => ({
      value: row.slug,
      label: row.title,
      description: row.description || "",
      usage: row.slug,
      category: row.category || "",
      yearsOfExperience: row.years_of_experience,
      tags: tryJsonParse(row.tags_json, []),
    }));
  } else if (scope === "tag") {
    const result = await d1.prepare(`
      SELECT slug, title, description, tags_json
      FROM catalog_entities
      WHERE type = 'tag' AND (slug LIKE ? OR title LIKE ?)
      ORDER BY slug
      LIMIT 20
    `).bind(prefix, prefix).all();

    suggestions = (result.results || []).map(row => ({
      value: row.slug,
      label: row.title,
      description: row.description || "",
      category: "tag",
      tags: tryJsonParse(row.tags_json, []),
    }));
  } else if (scope === "skill") {
    const result = await d1.prepare(`
      SELECT slug, title, description, category, years_of_experience, tags_json
      FROM catalog_entities
      WHERE type = 'skill' AND (slug LIKE ? OR title LIKE ?)
      ORDER BY slug
      LIMIT 20
    `).bind(prefix, prefix).all();

    suggestions = (result.results || []).map(row => ({
      value: row.slug,
      label: row.title,
      description: row.description || "",
      category: row.category || "",
      yearsOfExperience: row.years_of_experience,
      tags: tryJsonParse(row.tags_json, []),
    }));
  } else {
    const result = await d1.prepare(`
      SELECT type, slug, title, description, category
      FROM catalog_entities
      WHERE slug LIKE ? OR title LIKE ?
      ORDER BY type, slug
      LIMIT 20
    `).bind(prefix, prefix).all();

    suggestions = (result.results || []).map(row => ({
      value: row.slug,
      label: row.title,
      description: row.description || "",
      category: row.category || "",
    }));
  }

  return Response.json({ suggestions }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
