import {
  apiHeaders,
  errorJson,
  listStoredFilesystem,
  normalizeFsPath,
  optionsResponse,
  readKnowledgeDocument,
} from "./knowledge-store.js";

export async function onRequestOptions() {
  return optionsResponse("GET, OPTIONS");
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (path) {
    const doc = await readKnowledgeDocument(env, path);
    if (!doc) return errorJson(`No file found at ${normalizeFsPath(path)}.`, 404);
    return Response.json(doc, { headers: apiHeaders() });
  }

  const prefix = url.searchParams.get("prefix") || "/";
  const files = await listStoredFilesystem(env, prefix);
  const includeContent = url.searchParams.get("content") === "true";
  if (!includeContent) {
    return Response.json({ prefix: normalizeFsPath(prefix), files }, { headers: apiHeaders() });
  }

  const documents = [];
  for (const file of files.slice(0, 250)) {
    const doc = await readKnowledgeDocument(env, file);
    if (doc) documents.push(doc);
  }
  return Response.json({ prefix: normalizeFsPath(prefix), files, documents }, { headers: apiHeaders() });
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}
