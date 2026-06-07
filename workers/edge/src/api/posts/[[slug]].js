import { apiHeaders, errorJson, requireApiAuth } from "../knowledge-store.js";
import { collectAllPosts, postPayload, dateFromPostPath, slugFromPath, syncPostToStorage, deletePostFromStorage } from "../posts.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function postsDb(env) {
  return env.POSTS_DB || env.DB || null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  if (pathParts.length < 3) {
    return errorJson("Invalid path, expected /api/posts/{slug}", 400);
  }

  const slug = pathParts[2];
  const posts = await collectAllPosts(env);
  
  const post = posts.find(p => p.slug === slug || slugFromPath(p.path) === slug);
  
  if (!post) {
    return errorJson("Post not found", 404);
  }

  return Response.json({ post }, { headers: apiHeaders() });
}

export async function onRequestPut({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  if (pathParts.length < 3) {
    return errorJson("Invalid path, expected /api/posts/{slug}", 400);
  }

  const slug = pathParts[2];
  const auth = requireApiAuth(request, env);
  if (!auth.ok) {
    return errorJson(auth.message, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  const markdown = String(body.markdown || body.content || "");
  if (!markdown) {
    return errorJson("markdown is required", 400);
  }

  const posts = await collectAllPosts(env);
  const existing = posts.find(p => p.slug === slug || slugFromPath(p.path) === slug);
  
  const path = existing ? existing.path : `/posts/${new Date().toISOString().slice(0, 10).replace(/-/g, '/')}/${slug}.md`;
  
  await syncPostToStorage(env, path, markdown);
  
  const updatedPosts = await collectAllPosts(env);
  const updatedPost = updatedPosts.find(p => p.path === path);
  
  return Response.json({ post: updatedPost }, { headers: apiHeaders() });
}

export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  if (pathParts.length < 3) {
    return errorJson("Invalid path, expected /api/posts/{slug}", 400);
  }

  const slug = pathParts[2];
  const auth = requireApiAuth(request, env);
  if (!auth.ok) {
    return errorJson(auth.message, auth.status);
  }

  const posts = await collectAllPosts(env);
  const post = posts.find(p => p.slug === slug || slugFromPath(p.path) === slug);
  
  if (!post) {
    return errorJson("Post not found", 404);
  }

  await deletePostFromStorage(env, post.path);
  
  return Response.json({ ok: true }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
