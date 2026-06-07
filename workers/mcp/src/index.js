/**
 * Dedicated MCP worker — self-contained JSON-RPC server.
 * Routes: mcp.pecunies.com/*
 *
 * All logic lives in ./mcp-core.js (handlers) and ./dependencies.js (shared utils).
 */

import {
  onRequestOptions,
  onRequestGet,
  onRequestPost,
} from "./mcp-core.js";

/** @typedef {{ jsonrpc: string; id?: unknown; method?: string; params?: Record<string, unknown> }} JsonRpcRequest */

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return onRequestOptions();
    }
    if (request.method === "GET") {
      return onRequestGet();
    }
    if (request.method === "POST") {
      return onRequestPost({ request, env, ctx });
    }
    return new Response("Method not allowed", { status: 405 });
  },
};