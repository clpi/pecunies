/**
 * Dedicated MCP worker — same KV / D1 / R2 / Vectorize / AI bindings as Pages API.
 * Core handlers: functions/api/mcp-core.js (Pages `/api/mcp` proxies here).
 */
import {
  onRequestGet,
  onRequestOptions,
  onRequestPost,
  onRequest,
} from "../../../functions/api/mcp-core.js";

export default {
  /**
   * @param {Request} request
   * @param {Record<string, unknown>} env
   * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
   */
  async fetch(request, env, _ctx) {
    if (request.method === "OPTIONS") {
      return onRequestOptions();
    }
    if (request.method === "GET") {
      return onRequestGet();
    }
    if (request.method === "POST") {
      return onRequestPost({ request, env });
    }
    return onRequest();
  },
};
