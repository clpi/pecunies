import {
  apiHeaders,
  buildContext,
  datedPath,
  errorJson,
  listStoredFilesystem,
  normalizeFsPath,
  optionsResponse,
  parseRequestPayload,
  queryKnowledge,
  readKnowledgeDocument,
  requireApiAuth,
  upsertKnowledgeDocument,
} from "./knowledge-store.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const path = url.searchParams.get("path") || "";
  const exportFs = url.searchParams.get("export") === "fs";

  if (q) {
    const hits = await queryKnowledge(env, q, {
      limit: Number(url.searchParams.get("limit") || 10),
    });
    return Response.json({ query: q, hits }, { headers: apiHeaders() });
  }

  if (path) {
    const doc = await readKnowledgeDocument(env, path);
    if (!doc) return errorJson(`No file found at ${normalizeFsPath(path)}.`, 404);
    return Response.json(doc, { headers: apiHeaders() });
  }

  const prefix = url.searchParams.get("prefix") || "/";
  const files = await listStoredFilesystem(env, prefix);

  if (exportFs) {
    const documents = [];
    for (const file of files.slice(0, 250)) {
      const doc = await readKnowledgeDocument(env, file);
      if (doc) documents.push(doc);
    }
    return Response.json({ prefix: normalizeFsPath(prefix), files, documents }, { headers: apiHeaders() });
  }

  return Response.json({ prefix: normalizeFsPath(prefix), files }, { headers: apiHeaders() });
}

export async function onRequestPost({ request, env }) {
  const auth = requireApiAuth(request, env);
  if (!auth.ok) return errorJson(auth.message, auth.status);

  let payload;
  try {
    payload = await parseRequestPayload(request);
  } catch {
    return errorJson("Invalid request body.", 400);
  }

  const value = payload.value;
  const json = payload.kind === "json" && value && typeof value === "object" ? value : {};
  const markdown =
    payload.kind === "text"
      ? String(value || "")
      : String(json.markdown || json.content || json.text || "");

  if (!markdown.trim()) {
    return errorJson("markdown, content, or text is required.", 400);
  }

  const title = String(json.title || markdown.match(/^#\s+(.+)$/m)?.[1] || "Wiki note");
  const path =
    json.path ||
    datedPath("/root/wiki", title, "md", json.date ? new Date(json.date) : new Date());

  const doc = await upsertKnowledgeDocument(env, {
    path,
    kind: json.kind || "wiki",
    source: json.source || "api",
    title,
    markdown,
    metadata: json.metadata || {},
  });

  const context = json.query ? await buildContext(env, String(json.query), { limit: 8 }) : null;

  return Response.json({ ok: true, document: doc, context }, { headers: apiHeaders() });
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}
