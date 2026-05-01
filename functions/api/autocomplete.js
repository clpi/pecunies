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

async function ensureAutocompleteInfra(env) {
  const d1 = autocompleteDb(env);
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
    CREATE INDEX IF NOT EXISTS idx_catalog_slug ON catalog_entities(slug)
  `).run();
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

  const queryLower = q.toLowerCase();
  const prefix = `${queryLower}%`;
  let suggestions = [];

  if (scope === "command") {
    // Fetch commands from catalog
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
      description: row.description,
      usage: row.slug,
      category: row.category,
      yearsOfExperience: row.years_of_experience,
      tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    }));
  } else if (scope === "tag") {
    // Fetch tags from catalog_entities where type = 'tag'
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
      description: row.description,
      category: "tag",
      tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    }));
  } else if (scope === "skill") {
    // Fetch skills from catalog
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
      description: row.description,
      category: row.category,
      yearsOfExperience: row.years_of_experience,
      tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    }));
  } else {
    // Generic search across all types
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
      description: row.description,
      category: row.category,
    }));
  }

  return Response.json({ suggestions }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
