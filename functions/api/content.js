import { apiHeaders, errorJson } from "./knowledge-store.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function contentDb(env) {
  return env.DB || env.POSTS_DB || null;
}

async function ensureContentInfra(env) {
  const d1 = contentDb(env);
  if (!d1) return;

  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS content_overrides (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
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

export async function onRequestGet({ env }) {
  await ensureContentInfra(env);
  const d1 = contentDb(env);

  if (!d1) {
    return Response.json({ overrides: {} }, { headers: apiHeaders() });
  }

  const result = await d1.prepare("SELECT key, value FROM content_overrides").all();
  const overrides = {};
  for (const row of result.results || []) {
    overrides[row.key] = row.value;
  }

  return Response.json({ overrides }, { headers: apiHeaders() });
}

export async function onRequestPut({ request, env }) {
  await ensureContentInfra(env);
  const d1 = contentDb(env);

  if (!d1) {
    return errorJson("Content database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  try {
    const body = await request.json();
    const key = body.key;
    const value = body.value;

    if (!key || value === undefined) {
      return errorJson("key and value required", 400);
    }

    const updatedAt = new Date().toISOString();

    await d1.prepare(`
      INSERT INTO content_overrides (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind(key, value, updatedAt).run();

    return Response.json({ ok: true }, { headers: apiHeaders() });
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequestDelete({ request, env }) {
  await ensureContentInfra(env);
  const d1 = contentDb(env);

  if (!d1) {
    return errorJson("Content database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return errorJson("key query parameter required", 400);
  }

  await d1.prepare("DELETE FROM content_overrides WHERE key = ?").bind(key).run();

  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
