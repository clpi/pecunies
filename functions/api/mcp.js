/**
 * Pages route `/api/mcp`: forwards to the dedicated MCP worker so bindings stay off the main API worker.
 * Override with env MCP_WORKER_ORIGIN (e.g. http://127.0.0.1:8788) for local cross-worker testing.
 */

/** @param {Request} request @param {Record<string, unknown>} env */
function mcpWorkerOrigin(env) {
  return String(env.MCP_WORKER_ORIGIN || "https://mcp.pecunies.com").replace(/\/$/, "");
}

/** @param {{ request: Request; env: Record<string, unknown> }} ctx */
function proxyToMcpWorker({ request, env }) {
  const origin = mcpWorkerOrigin(env);
  const incoming = new URL(request.url);
  const path = incoming.pathname.replace(/^\/?api\/mcp\/?$/, "/") || "/";
  const target = new URL(path + incoming.search, origin);

  const headers = new Headers(request.headers);
  headers.delete("host");

  return fetch(
    new Request(target.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    }),
  );
}

export function onRequestOptions(ctx) {
  return proxyToMcpWorker(ctx);
}

export function onRequestGet(ctx) {
  return proxyToMcpWorker(ctx);
}

export function onRequestPost(ctx) {
  return proxyToMcpWorker(ctx);
}

export function onRequest(ctx) {
  return proxyToMcpWorker(ctx);
}
