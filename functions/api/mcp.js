import {
  answerWithKnowledge,
  apiHeaders,
  errorJson,
  listStoredFilesystem,
  optionsResponse,
  queryKnowledge,
  readKnowledgeDocument,
} from "./knowledge-store.js";
import { collectAllPosts } from "./posts.js";

const SERVER_INFO = {
  name: "pecunies-context",
  title: "Pecunies Personal Knowledge MCP",
  version: "0.1.0",
};

const TOOLS = [
  {
    name: "profile",
    description: "Return a compact public profile for Chris Pecunies.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "knowledge_search",
    description: "Search Chris Pecunies' personal wiki, posts, resume, meetings, and OS filesystem knowledge.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "ask_pecunies",
    description: "Answer using the repository context in Chris Pecunies' concise engineering voice.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        model: { type: "string" },
        system: { type: "string" },
      },
      required: ["question"],
    },
  },
  {
    name: "filesystem_read",
    description: "Read a stored OS filesystem markdown/text file by path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "filesystem_list",
    description: "List stored OS filesystem files under a prefix.",
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string" },
      },
    },
  },
  {
    name: "posts_list",
    description: "List public posts and comment counts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export async function onRequestOptions() {
  return optionsResponse("GET, POST, OPTIONS");
}

export async function onRequestGet() {
  return Response.json(
    {
      server: SERVER_INFO,
      protocol: "MCP JSON-RPC over HTTP",
      endpoint: "POST /",
      tools: TOOLS.map(({ name, description }) => ({ name, description })),
    },
    { headers: apiHeaders() },
  );
}

export async function onRequestPost({ request, env }) {
  let rpc;
  try {
    rpc = await request.json();
  } catch {
    return errorJson("Invalid JSON-RPC request.", 400);
  }

  const response = await handleRpc(env, rpc);
  return Response.json(response, { headers: apiHeaders() });
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}

async function handleRpc(env, rpc) {
  const id = rpc?.id ?? null;
  const method = String(rpc?.method || "");
  const params = rpc?.params || {};

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params.protocolVersion || "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        },
      };
    }

    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    }

    if (method === "tools/call") {
      const name = String(params.name || "");
      const args = params.arguments || {};
      const result = await callTool(env, name, args);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    }

    if (method === "ping" || method === "notifications/initialized") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : "Tool failed",
      },
    };
  }
}

async function callTool(env, name, args) {
  switch (name) {
    case "profile":
      return [
        "Chris Pecunies is a Seattle-based software engineer focused on cloud services, workflow automation, distributed systems, full-stack cloud applications, WebAssembly/runtime work, and terminal-native tools.",
        "Primary site: https://pecunies.com",
        "Source: https://github.com/clpi",
      ].join("\n");
    case "knowledge_search":
      return queryKnowledge(env, String(args.query || ""), { limit: args.limit || 8 });
    case "ask_pecunies":
      return answerWithKnowledge(env, {
        query: String(args.question || ""),
        model: args.model,
        system: args.system,
        source: "mcp",
        route: "mcp",
        sessionId: "mcp",
      });
    case "filesystem_read": {
      const doc = await readKnowledgeDocument(env, String(args.path || ""));
      if (!doc) return `No stored file found at ${args.path}`;
      return doc.markdown;
    }
    case "filesystem_list":
      return listStoredFilesystem(env, String(args.prefix || "/"));
    case "posts_list": {
      const posts = await collectAllPosts(env);
      return posts.map((post) => ({
        path: post.path,
        slug: post.slug,
        title: post.title,
        published: post.published,
        tags: post.tags,
        comments: post.comments?.length || 0,
      }));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
