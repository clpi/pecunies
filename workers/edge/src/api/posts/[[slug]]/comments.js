import { apiHeaders, errorJson } from "../../knowledge-store.js";

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

  await d1.prepare(`
    CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_slug)
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
  
  // Expected path: /api/posts/{slug}/comments
  if (pathParts.length < 4) {
    return errorJson("Invalid path, expected /api/posts/{slug}/comments", 400);
  }

  const postSlug = pathParts[2];

  if (!d1) {
    return Response.json({ comments: [] }, { headers: apiHeaders() });
  }

  const result = await d1.prepare(`
    SELECT id, target_type, target_slug, parent_id, author, body, created_at
    FROM comments
    WHERE target_type = 'post' AND target_slug = ?
    ORDER BY created_at ASC
  `).bind(postSlug).all();

  const comments = (result.results || []).map(row => ({
    id: row.id,
    targetType: row.target_type,
    targetSlug: row.target_slug,
    parentId: row.parent_id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at,
  }));

  // Add reply counts for top-level comments
  for (const comment of comments) {
    if (!comment.parentId) {
      const replyCountResult = await d1.prepare(
        "SELECT COUNT(*) as count FROM comments WHERE parent_id = ?"
      ).bind(comment.id).first();
      comment.replyCount = replyCountResult?.count || 0;
    }
  }

  return Response.json({ comments }, { headers: apiHeaders() });
}

export async function onRequestPost({ request, env }) {
  await ensureCommentsInfra(env);
  const d1 = commentsDb(env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected path: /api/posts/{slug}/comments
  if (pathParts.length < 4) {
    return errorJson("Invalid path, expected /api/posts/{slug}/comments", 400);
  }

  const postSlug = pathParts[2];

  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "create") {
      const commentBody = body.body;
      const authorUsername = body.authorUsername || "anonymous";
      const authorEmail = body.authorEmail;
      const parentId = body.parentId || null;

      if (!commentBody) {
        return errorJson("body required", 400);
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const author = authorEmail ? `${authorUsername} <${authorEmail}>` : authorUsername;
      const createdAt = new Date().toISOString();

      await d1.prepare(`
        INSERT INTO comments (id, target_type, target_slug, parent_id, author, body, created_at)
        VALUES (?, 'post', ?, ?, ?, ?, ?)
      `).bind(id, postSlug, parentId, author, commentBody, createdAt).run();

      return Response.json({
        comment: {
          id,
          targetType: "post",
          targetSlug: postSlug,
          parentId,
          author,
          body: commentBody,
          createdAt,
        }
      }, { headers: apiHeaders() });
    }

    return errorJson("Unsupported action", 400);
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequestPut({ request, env }) {
  await ensureCommentsInfra(env);
  const d1 = commentsDb(env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  if (pathParts.length < 4) {
    return errorJson("Invalid path, expected /api/posts/{slug}/comments", 400);
  }

  const postSlug = pathParts[2];

  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  try {
    const body = await request.json();
    const commentId = body.commentId;
    const newBody = body.body;

    if (!commentId || !newBody) {
      return errorJson("commentId and body required", 400);
    }

    const existing = await d1.prepare(
      "SELECT id, target_slug FROM comments WHERE id = ? AND target_type = 'post'"
    ).bind(commentId).first();

    if (!existing || existing.target_slug !== postSlug) {
      return errorJson("Comment not found", 404);
    }

    await d1.prepare(
      "UPDATE comments SET body = ? WHERE id = ?"
    ).bind(newBody, commentId).run();

    return Response.json({
      comment: {
        id: commentId,
        body: newBody,
        updatedAt: new Date().toISOString(),
      }
    }, { headers: apiHeaders() });
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequestDelete({ request, env }) {
  await ensureCommentsInfra(env);
  const d1 = commentsDb(env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  if (pathParts.length < 4) {
    return errorJson("Invalid path, expected /api/posts/{slug}/comments", 400);
  }

  const postSlug = pathParts[2];
  const commentId = url.searchParams.get("id");

  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  const sudo = await verifySudo(request, env);
  if (!sudo.ok) {
    return errorJson("Unauthorized: sudo required", 401);
  }

  if (!commentId) {
    return errorJson("id query parameter required", 400);
  }

  await d1.prepare("DELETE FROM comments WHERE id = ? AND target_type = 'post' AND target_slug = ?")
    .bind(commentId, postSlug).run();

  await d1.prepare("DELETE FROM comments WHERE parent_id = ?")
    .bind(commentId).run();

  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
