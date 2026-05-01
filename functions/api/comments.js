import { apiHeaders, errorJson } from "./knowledge-store.js";

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

  await d1.prepare(`
    CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)
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
  const targetType = url.searchParams.get("type");
  const targetSlug = url.searchParams.get("slug");
  const parentId = url.searchParams.get("parent");

  if (!d1) {
    return Response.json({ comments: [] }, { headers: apiHeaders() });
  }

  if (!targetType || !targetSlug) {
    return errorJson("type and slug query parameters required", 400);
  }

  let query = `
    SELECT id, target_type, target_slug, parent_id, author, body, created_at
    FROM comments
    WHERE target_type = ? AND target_slug = ?
  `;
  const params = [targetType, targetSlug];

  if (parentId) {
    query += " AND parent_id = ?";
    params.push(parentId);
  } else {
    query += " AND parent_id IS NULL";
  }

  query += " ORDER BY created_at ASC";

  const result = await d1.prepare(query).bind(...params).all();
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

  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "create") {
      let targetType = body.targetType;
      let targetSlug = body.targetSlug;
      const commentBody = body.body;
      const authorUsername = body.authorUsername || "anonymous";
      const authorEmail = body.authorEmail;
      const parentId = body.parentId || null;

      if (!commentBody) {
        return errorJson("body required", 400);
      }

      if (parentId && (!targetType || !targetSlug)) {
        const parent = await d1.prepare(
          "SELECT target_type, target_slug FROM comments WHERE id = ?"
        ).bind(parentId).first();
        if (!parent) {
          return errorJson("Parent comment not found", 404);
        }
        targetType = parent.target_type;
        targetSlug = parent.target_slug;
      }

      if (!targetType || !targetSlug) {
        return errorJson("targetType and targetSlug required (or parentId to infer)", 400);
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const author = authorEmail ? `${authorUsername} <${authorEmail}>` : authorUsername;
      const createdAt = new Date().toISOString();

      await d1.prepare(`
        INSERT INTO comments (id, target_type, target_slug, parent_id, author, body, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, targetType, targetSlug, parentId, author, commentBody, createdAt).run();

      return Response.json({
        comment: {
          id,
          targetType,
          targetSlug,
          parentId,
          author,
          body: commentBody,
          createdAt,
        }
      }, { headers: apiHeaders() });
    }

    if (action === "update") {
      const commentId = body.commentId;
      if (!commentId) {
        return errorJson("commentId required", 400);
      }

      const newBody = body.body;
      if (!newBody) {
        return errorJson("body required", 400);
      }

      const sudo = await verifySudo(request, env);
      if (!sudo.ok) {
        return errorJson("Unauthorized: sudo required", 401);
      }

      const existing = await d1.prepare(
        "SELECT id, author, body FROM comments WHERE id = ?"
      ).bind(commentId).first();

      if (!existing) {
        return errorJson("Comment not found", 404);
      }

      await d1.prepare(
        "UPDATE comments SET body = ? WHERE id = ?"
      ).bind(newBody, commentId).run();

      return Response.json({
        comment: {
          id: existing.id,
          author: existing.author,
          body: newBody,
          updatedAt: new Date().toISOString(),
        }
      }, { headers: apiHeaders() });
    }

    if (action === "delete") {
      const sudo = await verifySudo(request, env);
      if (!sudo.ok) {
        return errorJson("Unauthorized: sudo required", 401);
      }

      const commentId = body.commentId;
      if (!commentId) {
        return errorJson("commentId required", 400);
      }

      // Delete comment and all replies
      await d1.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?")
        .bind(commentId, commentId).run();

      return Response.json({ ok: true }, { headers: apiHeaders() });
    }

    return errorJson("Unsupported action", 400);
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequestPut({ request, env }) {
  await ensureCommentsInfra(env);
  const d1 = commentsDb(env);
  
  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  try {
    const body = await request.json();
    const sudoPassword = body.sudoPassword || "";
    
    if (sudoPassword && sudoPassword !== env.PECUNIES_SUDO_PASSWD) {
      return errorJson("Unauthorized: invalid sudo password", 401);
    }
    if (!sudoPassword) {
      const sudo = await verifySudo(request, env);
      if (!sudo.ok) return errorJson("Unauthorized: sudo required", 401);
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const commentId = pathParts[pathParts.length - 1];

    if (!commentId || commentId === "comments") {
      return errorJson("commentId required in path", 400);
    }

    const newBody = body.body;
    if (!newBody) {
      return errorJson("body required", 400);
    }

    const existing = await d1.prepare(
      "SELECT id, author, body FROM comments WHERE id = ?"
    ).bind(commentId).first();

    if (!existing) {
      return errorJson("Comment not found", 404);
    }

    await d1.prepare(
      "UPDATE comments SET body = ? WHERE id = ?"
    ).bind(newBody, commentId).run();

    return Response.json({
      comment: {
        id: existing.id,
        author: existing.author,
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
  
  if (!d1) {
    return errorJson("Comments database not available", 503);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const sudoPassword = body.sudoPassword || "";
    
    if (sudoPassword && sudoPassword !== env.PECUNIES_SUDO_PASSWD) {
      return errorJson("Unauthorized: invalid sudo password", 401);
    }
    if (!sudoPassword) {
      const sudo = await verifySudo(request, env);
      if (!sudo.ok) return errorJson("Unauthorized: sudo required", 401);
    }
  } catch {}

  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  let commentId = pathParts[pathParts.length - 1];
  
  if (!commentId || commentId === "comments") {
    commentId = url.searchParams.get("id") || body.commentId;
  }

  if (!commentId) {
    return errorJson("commentId required", 400);
  }

  await d1.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?")
    .bind(commentId, commentId).run();

  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...jsonHeaders,
      Allow: "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
    },
  });
}
