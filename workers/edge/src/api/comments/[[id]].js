import { apiHeaders, errorJson } from "../knowledge-store.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function commentsDb(env) {
  return env.DB || env.POSTS_DB || null;
}

async function ensureCommentsInfra(env) {
  const d1 = commentsDb(env);
  if (!d1) return;

  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_slug TEXT NOT NULL,
      parent_id TEXT,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
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

export async function onRequestGet({ request, env }) {
  await ensureCommentsInfra(env);
  const d1 = commentsDb(env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected path: /api/comments/{id}
  if (pathParts.length < 3) {
    return errorJson("Invalid path, expected /api/comments/{id}", 400);
  }

  const commentId = pathParts[2];

  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  const result = await d1.prepare(
    "SELECT * FROM comments WHERE id = ?"
  ).bind(commentId).first();

  if (!result) {
    return errorJson("Comment not found", 404);
  }

  const comment = {
    id: result.id,
    targetType: result.target_type,
    targetSlug: result.target_slug,
    parentId: result.parent_id,
    author: result.author,
    body: result.body,
    createdAt: result.created_at,
  };

  // Get replies
  const repliesResult = await d1.prepare(
    "SELECT * FROM comments WHERE parent_id = ? ORDER BY created_at ASC"
  ).bind(commentId).all();

  const replies = (repliesResult.results || []).map(row => ({
    id: row.id,
    targetType: row.target_type,
    targetSlug: row.target_slug,
    parentId: row.parent_id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at,
  }));

  return Response.json({ comment, replies }, { headers: apiHeaders() });
}

export async function onRequestDelete({ request, env }) {
  await ensureCommentsInfra(env);
  const d1 = commentsDb(env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected path: /api/comments/{id}
  if (pathParts.length < 3) {
    return errorJson("Invalid path, expected /api/comments/{id}", 400);
  }

  const commentId = pathParts[2];

  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  await d1.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?")
    .bind(commentId, commentId).run();

  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
