import {
  apiHeaders,
  datedPath,
  errorJson,
  optionsResponse,
  parseRequestPayload,
  recordResumeVersion,
  requireApiAuth,
  storeBinaryObject,
  upsertKnowledgeDocument,
} from "./knowledge-store.js";

export async function onRequestOptions() {
  return optionsResponse("POST, OPTIONS");
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

  if (payload.kind === "binary") {
    const stored = await storeBinaryObject(env, {
      path: "/resume/latest.pdf",
      kind: "resume",
      title: "Latest resume PDF",
      contentType: payload.contentType,
      data: payload.value,
    });
    return Response.json(
      {
        ok: true,
        stored,
        note: "PDF stored in R2. Send markdown or JSON to update searchable resume context.",
      },
      { headers: apiHeaders() },
    );
  }

  const json = payload.kind === "json" && payload.value && typeof payload.value === "object" ? payload.value : {};
  const markdown =
    payload.kind === "text"
      ? String(payload.value || "")
      : String(json.markdown || json.content || json.text || "");

  if (!markdown.trim()) {
    return errorJson("markdown, content, or text is required for resume context.", 400);
  }

  const title = String(json.title || "Chris Pecunies Resume");
  const dated = datedPath("/root/wiki/resume", title, "md");
  const primary = await upsertKnowledgeDocument(env, {
    path: "/resume/resume.md",
    kind: "resume",
    source: json.source || "api",
    title,
    markdown,
    metadata: json.metadata || {},
  });
  const archive = await upsertKnowledgeDocument(env, {
    path: json.path || dated,
    kind: "resume",
    source: json.source || "api",
    title,
    markdown,
    metadata: { ...(json.metadata || {}), archivedFrom: "/resume/resume.md" },
  });

  await recordResumeVersion(env, {
    path: primary.path,
    source: json.source || "api",
    markdown,
    metadata: json.metadata || {},
  });

  return Response.json({ ok: true, primary, archive }, { headers: apiHeaders() });
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}
