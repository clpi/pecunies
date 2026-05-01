import { apiHeaders, errorJson, DEFAULT_AI_MODEL } from "./knowledge-store.js";
import { resolveChatModel } from "./ai-models.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.pathname.split("/").pop();

  if (slug && slug !== "model") {
    const model = resolveChatModel(slug, env);
    if (model) {
      return Response.json({ model: { id: model } }, { headers: apiHeaders() });
    }
    return errorJson("Model not found", 404);
  }

  return Response.json({ 
    models: [
      { id: DEFAULT_AI_MODEL, name: "Default (Llama 3.1 8B)", default: true },
      { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct" },
      { id: "@cf/meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct" },
      { id: "@cf/qwen/qwen1.5-14b-chat", name: "Qwen 1.5 14B Chat" },
      { id: "@cf/mistral/mistral-7b-instruct", name: "Mistral 7B Instruct" },
    ]
  }, { headers: apiHeaders() });
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
