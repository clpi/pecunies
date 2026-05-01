import { apiHeaders, errorJson, db } from "./knowledge-store.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function authDb(env) {
  return env.DB || env.POSTS_DB || null;
}

async function ensureAuthInfra(env) {
  const d1 = authDb(env);
  if (!d1) return;

  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  await d1.prepare(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
  `).run();
}

export async function onRequestGet({ env }) {
  await ensureAuthInfra(env);
  const d1 = authDb(env);

  if (!d1) {
    return Response.json({ users: [] }, { headers: apiHeaders() });
  }

  const result = await d1.prepare("SELECT email, username, full_name FROM users ORDER BY created_at DESC").all();
  const users = (result.results || []).map(row => ({
    type: "user",
    slug: row.username,
    title: row.full_name || row.username,
    category: "auth",
    description: `User account for ${row.username}`,
    tags: ["auth", "user"],
    email: row.email,
    username: row.username,
    fullName: row.full_name,
  }));

  return Response.json({ users }, { headers: apiHeaders() });
}

export async function onRequestPost({ request, env }) {
  await ensureAuthInfra(env);
  const d1 = authDb(env);

  if (!d1) {
    return errorJson("Auth database not available", 503);
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "login") {
      const emailOrUsername = body.email;
      if (!emailOrUsername) {
        return errorJson("email required", 400);
      }

      const result = await d1.prepare(
        "SELECT email, username, full_name FROM users WHERE email = ? OR username = ?"
      ).bind(emailOrUsername, emailOrUsername).first();

      if (!result) {
        return errorJson("User not found", 404);
      }

      return Response.json({
        user: {
          email: result.email,
          username: result.username,
          fullName: result.full_name,
        }
      }, { headers: apiHeaders() });
    }

    if (action === "signup") {
      const email = body.email;
      const username = body.username;
      const fullName = body.fullName;

      if (!email || !username) {
        return errorJson("email and username required", 400);
      }

      const createdAt = new Date().toISOString();

      try {
        await d1.prepare(`
          INSERT INTO users (email, username, full_name, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(email, username, fullName || null, createdAt).run();
      } catch (e) {
        if (e.message && e.message.includes("UNIQUE")) {
          return errorJson("Username or email already exists", 409);
        }
        throw e;
      }

      return Response.json({
        user: {
          email,
          username,
          fullName: fullName || null,
        }
      }, { headers: apiHeaders() });
    }

    return errorJson("Unsupported action", 400);
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
