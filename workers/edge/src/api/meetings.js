import {
  apiHeaders,
  errorJson,
  optionsResponse,
  parseRequestPayload,
  recordMeeting,
  requireApiAuth,
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

  const json = payload.kind === "json" && payload.value && typeof payload.value === "object" ? payload.value : {};
  const transcript =
    payload.kind === "text"
      ? String(payload.value || "")
      : String(json.transcript || json.markdown || json.content || json.text || "");

  try {
    const meeting = await recordMeeting(env, {
      ...json,
      transcript,
    });
    return Response.json({ ok: true, meeting }, { headers: apiHeaders() });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "meeting ingest failed", 400);
  }
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}
