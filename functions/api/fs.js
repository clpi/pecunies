import {
  apiHeaders,
  errorJson,
  listStoredFilesystem,
  normalizeFsPath,
  optionsResponse,
  readKnowledgeDocument,
  requireApiAuth,
  upsertKnowledgeDocument,
} from "./knowledge-store.js";
import { syncPostToStorage, deletePostFromStorage } from "./posts.js";

const IMMUTABLE_PREFIXES = ["/bin", "/system"];
const POST_PREFIX = "/posts";

function isImmutable(path) {
  return IMMUTABLE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function isPost(path) {
  return path.startsWith(POST_PREFIX + "/") && path.endsWith(".md");
}

function kvKey(path) {
  return `file:${normalizeFsPath(path)}`;
}

export async function onRequestOptions() {
  return optionsResponse("GET, POST, PUT, DELETE, OPTIONS");
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (path) {
    const doc = await readKnowledgeDocument(env, path);
    if (!doc)
      return errorJson(`No file found at ${normalizeFsPath(path)}.`, 404);
    return Response.json(doc, { headers: apiHeaders() });
  }

  const prefix = url.searchParams.get("prefix") || "/";
  const files = await listStoredFilesystem(env, prefix);
  const includeContent = url.searchParams.get("content") === "true";
  if (!includeContent) {
    return Response.json(
      { prefix: normalizeFsPath(prefix), files },
      { headers: apiHeaders() },
    );
  }

  const documents = [];
  for (const file of files.slice(0, 250)) {
    const doc = await readKnowledgeDocument(env, file);
    if (doc) documents.push(doc);
  }
  return Response.json(
    { prefix: normalizeFsPath(prefix), files, documents },
    { headers: apiHeaders() },
  );
}

export async function onRequestPost({ request, env }) {
  return handleWrite(request, env);
}

export async function onRequestPut({ request, env }) {
  return handleWrite(request, env);
}

export async function onRequestDelete({ request, env }) {
  const auth = requireApiAuth(request, env);
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const url = new URL(request.url);
  const path = normalizeFsPath(url.searchParams.get("path") || "");
  if (!path || path === "/") return errorJson("path is required", 400);
  if (isImmutable(path)) return errorJson(`${path}: immutable`, 403);

  if (isPost(path)) {
    await deletePostFromStorage(env, path);
    return Response.json(
      { ok: true, deleted: path },
      { headers: apiHeaders() },
    );
  }

  if (env.PORTFOLIO_OS) {
    await env.PORTFOLIO_OS.delete(kvKey(path));
  }
  return Response.json({ ok: true, deleted: path }, { headers: apiHeaders() });
}

async function handleWrite(request, env) {
  const auth = requireApiAuth(request, env);
  if (!auth.ok) return errorJson(auth.message, auth.status);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  const path = normalizeFsPath(String(body?.path || ""));
  if (!path || path === "/") return errorJson("path is required", 400);
  if (isImmutable(path)) return errorJson(`${path}: immutable`, 403);

  const content = String(body?.content ?? body?.markdown ?? "");
  const title = String(body?.title || path.split("/").pop() || "Untitled");
  const kind = String(body?.kind || (isPost(path) ? "post" : "wiki"));

  if (isPost(path)) {
    await syncPostToStorage(env, path, content);
    return Response.json(
      { ok: true, path, kind: "post" },
      { headers: apiHeaders() },
    );
  }

  const doc = await upsertKnowledgeDocument(env, {
    path,
    title,
    markdown: content,
    kind,
    source: body?.source || "fs-api",
    metadata: body?.metadata || {},
  });

  // Also mirror to KV so `cat` in the OS shell can read it immediately
  if (env.PORTFOLIO_OS) {
    await env.PORTFOLIO_OS.put(kvKey(path), content);
  }

  return Response.json({ ok: true, path, doc }, { headers: apiHeaders() });
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}
w;
