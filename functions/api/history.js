import { apiHeaders, errorJson, db } from "./knowledge-store.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function historyDb(env) {
  return env.DB || env.POSTS_DB || null;
}

async function ensureHistoryInfra(env) {
  const d1 = historyDb(env);
  if (!d1) return;

  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS command_history (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      command TEXT NOT NULL,
      executed_at TEXT NOT NULL
    )
  `).run();

  await d1.prepare(`
    CREATE INDEX IF NOT EXISTS idx_history_session ON command_history(session_id, executed_at DESC)
  `).run();
}

export async function onRequestGet({ request, env }) {
  await ensureHistoryInfra(env);
  const d1 = historyDb(env);
  const url = new URL(request.url);
  const session = url.searchParams.get("session");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  if (!d1) {
    return Response.json({ history: [] }, { headers: apiHeaders() });
  }

  if (!session) {
    return errorJson("session query parameter required", 400);
  }

  const result = await d1.prepare(`
    SELECT id, session_id, command, executed_at
    FROM command_history
    WHERE session_id = ?
    ORDER BY executed_at DESC
    LIMIT ?
  `).bind(session, limit).all();

  const history = (result.results || []).map(row => ({
    id: row.id,
    session_id: row.session_id,
    command: row.command,
    executed_at: row.executed_at,
  }));

  return Response.json({ history }, { headers: apiHeaders() });
}

export async function onRequestPost({ request, env }) {
  await ensureHistoryInfra(env);
  const d1 = historyDb(env);

  if (!d1) {
    // History is non-critical, silently fail
    return Response.json({ ok: true }, { headers: apiHeaders() });
  }

  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    const command = body.command;

    if (!sessionId || !command) {
      return errorJson("sessionId and command required", 400);
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const executedAt = new Date().toISOString();

    await d1.prepare(`
      INSERT INTO command_history (id, session_id, command, executed_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, sessionId, command, executedAt).run();

    return Response.json({ ok: true }, { headers: apiHeaders() });
  } catch (e) {
    // History is non-critical, silently fail
    return Response.json({ ok: true }, { headers: apiHeaders() });
  }
}

export async function onRequestDelete({ request, env }) {
  await ensureHistoryInfra(env);
  const d1 = historyDb(env);

  if (!d1) {
    return Response.json({ ok: true }, { headers: apiHeaders() });
  }

  const url = new URL(request.url);
  const session = url.searchParams.get("session");

  if (!session) {
    return errorJson("session query parameter required", 400);
  }

  await d1.prepare("DELETE FROM command_history WHERE session_id = ?").bind(session).run();

  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
