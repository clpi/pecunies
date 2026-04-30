import {
  answerWithKnowledge,
  apiHeaders,
  errorJson,
  optionsResponse,
  requireApiAuth,
} from "./knowledge-store.js";

export async function onRequestOptions() {
  return optionsResponse("POST, OPTIONS");
}

export async function onRequestPost({ request, env }) {
  if (String(env.PUBLIC_AI_API || "").toLowerCase() !== "true") {
    const auth = requireApiAuth(request, env);
    if (!auth.ok) return errorJson(auth.message, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body.", 400);
  }

  const message = String(body?.message || body?.query || "").trim();
  if (!message) return errorJson("message or query is required.", 400);

  try {
    const result = await answerWithKnowledge(env, {
      query: message,
      model: body?.model,
      system: body?.system || body?.systemPrompt,
      sessionId: body?.sessionId || "api",
      source: "api-ai",
      route: "ai",
      limit: body?.limit,
      temperature: body?.temperature,
      maxTokens: body?.maxTokens,
    });
    return Response.json({ ok: true, ...result }, { headers: apiHeaders() });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "AI request failed.", 502);
  }
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}
