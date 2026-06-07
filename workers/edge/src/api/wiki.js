import {
  apiHeaders,
  datedPath,
  errorJson,
  optionsResponse,
  parseRequestPayload,
  requireApiAuth,
  upsertKnowledgeDocument,
} from "./knowledge-store.js";

export async function onRequestOptions() {
  return optionsResponse();
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

  const json = payload.kind === "json" && payload.value && typeof payload.value === "object" ? payload.value : {};
  const markdown =
    payload.kind === "text"
      ? String(payload.value || "")
      : String(json.markdown || json.content || json.text || "");
  if (!markdown.trim()) return errorJson("markdown, content, or text is required.", 400);

  const title = String(json.title || markdown.match(/^#\s+(.+)$/m)?.[1] || "Wiki note");
  const path = json.path || datedPath("/root/wiki", title, "md", json.date ? new Date(json.date) : new Date());
  const document = await upsertKnowledgeDocument(env, {
    path,
    kind: "wiki",
    source: json.source || "api",
    title,
    markdown,
    metadata: json.metadata || {},
  });

  return Response.json({ ok: true, document }, { headers: apiHeaders() });
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}
