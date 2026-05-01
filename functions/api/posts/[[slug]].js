import { apiHeaders, errorJson } from "../knowledge-store.js";
import { collectAllPosts, postPayload, dateFromPostPath, slugFromPath } from "../posts.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected path: /api/posts/{slug}
  if (pathParts.length < 3) {
    return errorJson("Invalid path, expected /api/posts/{slug}", 400);
  }

  const slug = pathParts[2];
  const posts = await collectAllPosts(env);
  
  // Find post by slug
  const post = posts.find(p => p.slug === slug || slugFromPath(p.path) === slug);
  
  if (!post) {
    return errorJson("Post not found", 404);
  }

  return Response.json({ post }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
