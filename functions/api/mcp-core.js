import {
  answerWithKnowledge,
  apiHeaders,
  datedPath,
  errorJson,
  listStoredFilesystem,
  optionsResponse,
  queryKnowledge,
  readKnowledgeDocument,
  requireApiAuth,
  upsertKnowledgeDocument,
} from "./knowledge-store.js";
import {
  collectAllPosts,
  deletePostFromStorage,
  parseFrontmatter,
  postPayload,
  slugFromPath,
  syncPostToStorage,
  tagsFromMeta,
  upsertTagWithItems,
} from "./posts.js";
import {
  DEFAULT_AI_MODEL,
  WORKERS_AI_TEXT_MODELS,
  isValidWorkersAiModelId,
  resolveChatModel,
} from "./ai-models.js";

const SERVER_INFO = {
  name: "pecunies-context",
  title: "Pecunies Personal Knowledge MCP",
  version: "0.2.0",
};

const TOOLS = [
  // ── identity ──────────────────────────────────────────────────────────────
  {
    name: "profile",
    description: "Return a compact public profile for Chris Pecunies.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── knowledge / rag ───────────────────────────────────────────────────────
  {
    name: "knowledge_search",
    description:
      "Search Chris Pecunies' personal wiki, posts, resume, meetings, and OS filesystem knowledge using vector + lexical search.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (1–20, default 8)" },
      },
      required: ["query"],
    },
  },
  {
    name: "ask_pecunies",
    description:
      "Answer a question using retrieved repository context in Chris Pecunies' concise engineering voice.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        model: { type: "string", description: "Optional Workers AI model ID" },
        system: { type: "string", description: "Extra system instruction" },
      },
      required: ["question"],
    },
  },

  // ── virtual filesystem ────────────────────────────────────────────────────
  {
    name: "filesystem_read",
    description: "Read a stored OS filesystem markdown/text file by path.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "filesystem_list",
    description: "List stored OS filesystem files under a prefix.",
    inputSchema: {
      type: "object",
      properties: { prefix: { type: "string", description: "Path prefix, default /" } },
    },
  },
  {
    name: "filesystem_write",
    description: "Write or update a knowledge document in the stored filesystem. Requires a valid API token.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Destination path, e.g. /root/wiki/notes.md" },
        markdown: { type: "string", description: "Markdown content" },
        kind: { type: "string", description: "Document kind: wiki | post | resume | meeting (default wiki)" },
        title: { type: "string" },
        token: { type: "string", description: "API token (PECUNIES_API_TOKEN / POSTS_SYNC_TOKEN)" },
      },
      required: ["path", "markdown", "token"],
    },
  },

  // ── terminal commands ─────────────────────────────────────────────────────
  {
    name: "terminal_run",
    description:
      "Execute a virtual terminal command against the stored filesystem. Supported: echo, pwd, whoami, ls [prefix], cat <path>, head <path> [n], tail <path> [n], find <prefix> [pattern], grep <pattern> <path>, stat <path>, env, help.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command string, e.g. 'ls /posts' or 'cat /resume/resume.md'" },
        token: { type: "string", description: "Optional API token — required for write commands" },
      },
      required: ["command"],
    },
  },

  // ── posts ─────────────────────────────────────────────────────────────────
  {
    name: "posts_list",
    description: "List all public posts with metadata and comment counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "post_get",
    description: "Get a specific post by slug or path, including its full markdown and comments.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Post slug, e.g. terminal-portfolio-changelog" },
        path: { type: "string", description: "Full post path, e.g. /posts/2026/04/29/terminal-portfolio-changelog.md" },
      },
    },
  },
  {
    name: "post_search",
    description: "Search posts by free-text query or filter by tag.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search query" },
        tag: { type: "string", description: "Filter by tag slug" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "post_create",
    description: "Create a new markdown post and sync it to D1 and R2. Requires a valid API token.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        markdown: { type: "string", description: "Full markdown with optional frontmatter" },
        date: { type: "string", description: "ISO date YYYY-MM-DD (default: today)" },
        path: { type: "string", description: "Override the auto-generated path" },
        token: { type: "string", description: "API token" },
      },
      required: ["title", "markdown", "token"],
    },
  },
  {
    name: "post_update",
    description: "Update an existing post by slug or path. Requires a valid API token.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        path: { type: "string" },
        markdown: { type: "string", description: "Replacement markdown content" },
        token: { type: "string", description: "API token" },
      },
      required: ["markdown", "token"],
    },
  },
  {
    name: "post_delete",
    description: "Delete a post by slug or path from D1 and R2. Requires a valid API token.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        path: { type: "string" },
        token: { type: "string", description: "API token" },
      },
      required: ["token"],
    },
  },

  // ── ai models ─────────────────────────────────────────────────────────────
  {
    name: "ai_list_models",
    description: "List available Workers AI text/chat models.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ai_query",
    description:
      "Run a direct prompt against a Workers AI model. No retrieval augmentation — raw model call.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "User prompt" },
        system: { type: "string", description: "Optional system prompt" },
        model: { type: "string", description: "Workers AI model ID (default: llama-3.1-8b-instruct)" },
        maxTokens: { type: "number", description: "Max response tokens (default 800)" },
        temperature: { type: "number", description: "Sampling temperature 0–1 (default 0.3)" },
      },
      required: ["prompt"],
    },
  },

  // ── tags ──────────────────────────────────────────────────────────────────
  {
    name: "tag_list",
    description: "List all tags stored in D1.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "tag_get",
    description: "Get a tag's metadata and usage (entities that reference it).",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Tag slug" } },
      required: ["slug"],
    },
  },
  {
    name: "tag_upsert",
    description: "Create or update a tag and optionally attach item references. Requires a valid API token.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        description: { type: "string" },
        items: {
          type: "array",
          description: "Items referencing this tag",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              type: { type: "string" },
              command: { type: "string" },
            },
          },
        },
        token: { type: "string", description: "API token" },
      },
      required: ["slug", "token"],
    },
  },

  // ── bucket (R2) ───────────────────────────────────────────────────────────
  {
    name: "bucket_list",
    description: "List objects in the posts R2 bucket under an optional key prefix.",
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string", description: "Key prefix to list under (default: posts/)" },
        limit: { type: "number", description: "Max keys to return (default 100, max 1000)" },
        bucket: { type: "string", description: "Bucket alias: posts | static (default posts)" },
      },
    },
  },
  {
    name: "bucket_get",
    description: "Retrieve an object from the posts R2 bucket by key.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "R2 object key" },
        bucket: { type: "string", description: "Bucket alias: posts | static (default posts)" },
      },
      required: ["key"],
    },
  },
  {
    name: "bucket_put",
    description: "Write a text or markdown object into the posts R2 bucket. Requires a valid API token.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "R2 object key" },
        content: { type: "string", description: "Text content to store" },
        contentType: { type: "string", description: "MIME type (default text/markdown; charset=utf-8)" },
        bucket: { type: "string", description: "Bucket alias: posts | static (default posts)" },
        token: { type: "string", description: "API token" },
      },
      required: ["key", "content", "token"],
    },
  },

  // ── database (D1) ─────────────────────────────────────────────────────────
  {
    name: "db_list_tables",
    description: "List all tables in the pecunies D1 database.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "db_query",
    description:
      "Execute a SQL query against the pecunies D1 database. SELECT queries are always allowed; INSERT/UPDATE/DELETE/DROP/CREATE require a valid API token.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL statement" },
        params: {
          type: "array",
          description: "Positional bind parameters (? placeholders)",
          items: {},
        },
        token: { type: "string", description: "API token — required for write statements" },
      },
      required: ["sql"],
    },
  },
];

// ── auth ─────────────────────────────────────────────────────────────────────

function checkToken(args, env) {
  const supplied = String(args.token || "").trim();
  if (!supplied) return { ok: false, message: "token is required for write operations" };
  const candidates = [env.PECUNIES_API_TOKEN, env.POSTS_SYNC_TOKEN, env.PECUNIES_SUDO_PASSWD]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!candidates.length) return { ok: false, message: "Write token not configured on this server" };
  return { ok: candidates.includes(supplied), message: "Invalid token" };
}

function bucketBinding(env, alias = "posts") {
  if (alias === "static") return env.STATIC || env.STATIC_BUCKET || null;
  return env.POSTS || env.POSTS_BUCKET || null;
}

function dbBinding(env) {
  return env.DB || env.POSTS_DB || null;
}

function isSqlReadOnly(sql) {
  const first = String(sql || "")
    .trim()
    .toLowerCase()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .trimStart();
  return /^(select|with|explain|pragma)\b/.test(first);
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

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

// ── JSON-RPC dispatcher ───────────────────────────────────────────────────────

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
          capabilities: { tools: {} },
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

// ── tool dispatch ─────────────────────────────────────────────────────────────

async function callTool(env, name, args) {
  switch (name) {
    // identity
    case "profile":
      return [
        "Chris Pecunies is a Seattle-based software engineer focused on cloud services, workflow automation, distributed systems, full-stack cloud applications, WebAssembly/runtime work, and terminal-native tools.",
        "Primary site: https://pecunies.com",
        "Source: https://github.com/clpi",
      ].join("\n");

    // knowledge
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

    // filesystem
    case "filesystem_read": {
      const doc = await readKnowledgeDocument(env, String(args.path || ""));
      if (!doc) return `No stored file found at ${args.path}`;
      return doc.markdown;
    }
    case "filesystem_list":
      return listStoredFilesystem(env, String(args.prefix || "/"));
    case "filesystem_write": {
      const auth = checkToken(args, env);
      if (!auth.ok) throw new Error(auth.message);
      const doc = await upsertKnowledgeDocument(env, {
        path: String(args.path || ""),
        kind: String(args.kind || "wiki"),
        source: "mcp",
        title: String(args.title || ""),
        markdown: String(args.markdown || ""),
      });
      return doc;
    }

    // terminal
    case "terminal_run":
      return handleTerminalRun(env, args);

    // posts — reads
    case "posts_list": {
      const posts = await collectAllPosts(env);
      return posts.map((p) => ({
        path: p.path,
        slug: p.slug,
        title: p.title,
        published: p.published,
        tags: p.tags,
        comments: p.comments?.length || 0,
      }));
    }
    case "post_get":
      return handlePostGet(env, args);
    case "post_search":
      return handlePostSearch(env, args);

    // posts — writes
    case "post_create": {
      const auth = checkToken(args, env);
      if (!auth.ok) throw new Error(auth.message);
      return handlePostCreate(env, args);
    }
    case "post_update": {
      const auth = checkToken(args, env);
      if (!auth.ok) throw new Error(auth.message);
      return handlePostUpdate(env, args);
    }
    case "post_delete": {
      const auth = checkToken(args, env);
      if (!auth.ok) throw new Error(auth.message);
      return handlePostDelete(env, args);
    }

    // ai
    case "ai_list_models":
      return {
        default: DEFAULT_AI_MODEL,
        models: WORKERS_AI_TEXT_MODELS,
      };
    case "ai_query":
      return handleAiQuery(env, args);

    // tags
    case "tag_list":
      return handleTagList(env);
    case "tag_get":
      return handleTagGet(env, args);
    case "tag_upsert": {
      const auth = checkToken(args, env);
      if (!auth.ok) throw new Error(auth.message);
      return handleTagUpsert(env, args);
    }

    // bucket
    case "bucket_list":
      return handleBucketList(env, args);
    case "bucket_get":
      return handleBucketGet(env, args);
    case "bucket_put": {
      const auth = checkToken(args, env);
      if (!auth.ok) throw new Error(auth.message);
      return handleBucketPut(env, args);
    }

    // database
    case "db_list_tables":
      return handleDbListTables(env);
    case "db_query":
      return handleDbQuery(env, args);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── terminal handler ──────────────────────────────────────────────────────────

const TERMINAL_HELP = [
  "echo <text>         — print text",
  "pwd                 — print working directory (/)",
  "whoami              — print current user (chris)",
  "env                 — list non-sensitive environment variable names",
  "ls [prefix]         — list stored filesystem files under prefix",
  "cat <path>          — read a stored filesystem file",
  "head <path> [n]     — first n lines of a stored file (default 20)",
  "tail <path> [n]     — last n lines of a stored file (default 20)",
  "find <prefix> [pat] — find stored filesystem files matching glob pattern",
  "grep <pattern> <p>  — search a stored file for a pattern (case-insensitive)",
  "stat <path>         — print metadata for a stored file",
  "help                — show this help",
];

async function handleTerminalRun(env, args) {
  const raw = String(args.command || "").trim();
  if (!raw) return "No command provided. Try 'help'.";

  const parts = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const argv = parts.map((p) =>
    (p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))
      ? p.slice(1, -1)
      : p,
  );
  const [prog, ...rest] = argv;

  switch (prog?.toLowerCase()) {
    case "echo":
      return rest.join(" ");

    case "pwd":
      return "/";

    case "whoami":
      return "chris";

    case "help":
      return TERMINAL_HELP.join("\n");

    case "env": {
      const safe = Object.keys(env).filter(
        (k) => !/passwd|password|token|secret|key|auth|api/i.test(k),
      );
      return safe.length ? safe.join("\n") : "(no public env vars)";
    }

    case "ls": {
      const prefix = rest[0] || "/";
      const files = await listStoredFilesystem(env, prefix);
      if (!files.length) return `(no files under ${prefix})`;
      return Array.isArray(files) ? files.join("\n") : String(files);
    }

    case "cat": {
      if (!rest[0]) return "Usage: cat <path>";
      const doc = await readKnowledgeDocument(env, rest[0]);
      if (!doc) return `cat: ${rest[0]}: No such file`;
      return doc.markdown;
    }

    case "head": {
      if (!rest[0]) return "Usage: head <path> [n]";
      const doc = await readKnowledgeDocument(env, rest[0]);
      if (!doc) return `head: ${rest[0]}: No such file`;
      const n = Math.max(1, parseInt(rest[1] || "20", 10) || 20);
      return doc.markdown.split("\n").slice(0, n).join("\n");
    }

    case "tail": {
      if (!rest[0]) return "Usage: tail <path> [n]";
      const doc = await readKnowledgeDocument(env, rest[0]);
      if (!doc) return `tail: ${rest[0]}: No such file`;
      const n = Math.max(1, parseInt(rest[1] || "20", 10) || 20);
      const lines = doc.markdown.split("\n");
      return lines.slice(Math.max(0, lines.length - n)).join("\n");
    }

    case "find": {
      const prefix = rest[0] || "/";
      const pattern = rest[1] || "";
      const files = await listStoredFilesystem(env, prefix);
      const list = Array.isArray(files) ? files : [];
      if (!pattern) return list.join("\n") || `(no files under ${prefix})`;
      const re = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."), "i");
      const matched = list.filter((f) => re.test(f));
      return matched.length ? matched.join("\n") : `(no match for ${pattern} under ${prefix})`;
    }

    case "grep": {
      if (rest.length < 2) return "Usage: grep <pattern> <path>";
      const [patternArg, filePath] = rest;
      const doc = await readKnowledgeDocument(env, filePath);
      if (!doc) return `grep: ${filePath}: No such file`;
      const re = new RegExp(patternArg, "i");
      const matched = doc.markdown
        .split("\n")
        .map((line, i) => ({ line, i: i + 1 }))
        .filter(({ line }) => re.test(line));
      if (!matched.length) return `(no matches for /${patternArg}/ in ${filePath})`;
      return matched.map(({ i, line }) => `${i}:${line}`).join("\n");
    }

    case "stat": {
      if (!rest[0]) return "Usage: stat <path>";
      const doc = await readKnowledgeDocument(env, rest[0]);
      if (!doc) return `stat: ${rest[0]}: No such file`;
      const size = new TextEncoder().encode(doc.markdown).length;
      return [
        `Path:   ${doc.path}`,
        `Source: ${doc.source}`,
        `Kind:   ${doc.kind || "unknown"}`,
        `Title:  ${doc.title || "(none)"}`,
        `Size:   ${size} bytes`,
        `Updated: ${doc.updatedAt || "unknown"}`,
      ].join("\n");
    }

    default:
      return `${prog}: command not found. Type 'help' for available commands.`;
  }
}

// ── post handlers ─────────────────────────────────────────────────────────────

async function handlePostGet(env, args) {
  const slug = String(args.slug || "").trim();
  const path = String(args.path || "").trim();

  if (!slug && !path) throw new Error("slug or path is required");

  const posts = await collectAllPosts(env);

  const post = path
    ? posts.find((p) => p.path === path)
    : posts.find((p) => p.slug === slug);

  if (!post) throw new Error(`Post not found: ${path || slug}`);
  return post;
}

async function handlePostSearch(env, args) {
  const query = String(args.query || "").toLowerCase().trim();
  const tag = String(args.tag || "").toLowerCase().trim();
  const limit = Math.max(1, Math.min(50, Number(args.limit) || 10));

  const posts = await collectAllPosts(env);

  let results = posts;
  if (tag) {
    results = results.filter((p) => p.tags?.includes(tag));
  }
  if (query) {
    results = results.filter(
      (p) =>
        p.title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.body?.toLowerCase().includes(query) ||
        p.tags?.some((t) => t.includes(query)),
    );
  }

  return results.slice(0, limit).map((p) => ({
    path: p.path,
    slug: p.slug,
    title: p.title,
    published: p.published,
    description: p.description,
    tags: p.tags,
    comments: p.comments?.length || 0,
  }));
}

async function handlePostCreate(env, args) {
  const title = String(args.title || "").trim();
  const markdown = String(args.markdown || "").trim();
  if (!title) throw new Error("title is required");
  if (!markdown) throw new Error("markdown is required");

  const date = args.date ? new Date(String(args.date)) : new Date();
  const path = args.path || datedPath("/posts", title, "md", date);

  if (!path.startsWith("/posts/") || !path.endsWith(".md")) {
    throw new Error("post path must be under /posts/ and end in .md");
  }

  await syncPostToStorage(env, path, markdown);

  const payload = await postPayload(path, markdown, env);
  return { ok: true, post: { path, slug: payload.slug, title: payload.title, tags: payload.tags } };
}

async function handlePostUpdate(env, args) {
  const markdown = String(args.markdown || "").trim();
  if (!markdown) throw new Error("markdown is required");

  const slug = String(args.slug || "").trim();
  const path = String(args.path || "").trim();

  if (!slug && !path) throw new Error("slug or path is required");

  let resolvedPath = path;
  if (!resolvedPath) {
    const posts = await collectAllPosts(env);
    const post = posts.find((p) => p.slug === slug);
    if (!post) throw new Error(`Post not found: ${slug}`);
    resolvedPath = post.path;
  }

  if (!resolvedPath.startsWith("/posts/") || !resolvedPath.endsWith(".md")) {
    throw new Error("post path must be under /posts/ and end in .md");
  }

  await syncPostToStorage(env, resolvedPath, markdown);
  const payload = await postPayload(resolvedPath, markdown, env);
  return { ok: true, post: { path: resolvedPath, slug: payload.slug, title: payload.title } };
}

async function handlePostDelete(env, args) {
  const slug = String(args.slug || "").trim();
  const path = String(args.path || "").trim();

  if (!slug && !path) throw new Error("slug or path is required");

  let resolvedPath = path;
  if (!resolvedPath) {
    const posts = await collectAllPosts(env);
    const post = posts.find((p) => p.slug === slug);
    if (!post) throw new Error(`Post not found: ${slug}`);
    resolvedPath = post.path;
  }

  await deletePostFromStorage(env, resolvedPath);
  return { ok: true, deleted: resolvedPath };
}

// ── ai handler ────────────────────────────────────────────────────────────────

async function handleAiQuery(env, args) {
  if (!env.AI) throw new Error("Workers AI binding (AI) is not available");

  const prompt = String(args.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required");

  const model = resolveChatModel(args.model, env.DEFAULT_AI_MODEL, DEFAULT_AI_MODEL);
  const maxTokens = Math.max(50, Math.min(4096, Number(args.maxTokens) || 800));
  const temperature = Math.max(0, Math.min(1, Number(args.temperature) || 0.3));

  const messages = [];
  if (args.system) {
    messages.push({ role: "system", content: String(args.system).slice(0, 2000) });
  }
  messages.push({ role: "user", content: prompt.slice(0, 8000) });

  const gatewayId = String(env.AI_GATEWAY_ID || "").trim();
  const result = await env.AI.run(
    model,
    { messages, temperature, max_tokens: maxTokens },
    gatewayId ? { gateway: { id: gatewayId, metadata: { source: "mcp", route: "ai_query" } } } : undefined,
  );

  const text =
    typeof result?.response === "string"
      ? result.response
      : typeof result?.text === "string"
        ? result.text
        : JSON.stringify(result);

  return { model, answer: text };
}

// ── tag handlers ──────────────────────────────────────────────────────────────

async function handleTagList(env) {
  const d1 = dbBinding(env);
  if (!d1) return { tags: [] };

  try {
    const result = await d1
      .prepare(
        `SELECT t.slug, t.description, t.source, t.created_at,
                COUNT(ti.id) as item_count
         FROM tags t
         LEFT JOIN tag_items ti ON ti.tag_slug = t.slug
         GROUP BY t.slug
         ORDER BY t.slug`,
      )
      .all();

    return {
      tags: (result?.results || []).map((row) => ({
        slug: row.slug,
        description: row.description,
        source: row.source,
        itemCount: Number(row.item_count || 0),
        createdAt: row.created_at,
      })),
    };
  } catch {
    return { tags: [] };
  }
}

async function handleTagGet(env, args) {
  const slug = String(args.slug || "").trim();
  if (!slug) throw new Error("slug is required");

  const d1 = dbBinding(env);
  if (!d1) throw new Error("D1 database binding unavailable");

  const tag = await d1
    .prepare("SELECT slug, description, source, created_at FROM tags WHERE slug = ?")
    .bind(slug)
    .first();

  if (!tag) throw new Error(`Tag not found: ${slug}`);

  const items = await d1
    .prepare("SELECT label, type, command FROM tag_items WHERE tag_slug = ? ORDER BY type, label LIMIT 100")
    .bind(slug)
    .all();

  const postTags = await d1
    .prepare(
      "SELECT p.slug, p.title, p.published FROM posts p JOIN post_tags pt ON pt.post_path = p.path WHERE pt.tag = ? ORDER BY p.published DESC LIMIT 50",
    )
    .bind(slug)
    .all()
    .catch(() => ({ results: [] }));

  return {
    slug: tag.slug,
    description: tag.description,
    source: tag.source,
    createdAt: tag.created_at,
    items: items?.results || [],
    posts: postTags?.results || [],
  };
}

async function handleTagUpsert(env, args) {
  const slug = String(args.slug || "").trim().toLowerCase();
  if (!slug) throw new Error("slug is required");

  const d1 = dbBinding(env);
  if (!d1) throw new Error("D1 database binding unavailable");

  const description = String(args.description || "").trim();
  const now = new Date().toISOString();

  await d1
    .prepare(
      `INSERT INTO tags (slug, description, source, created_at)
       VALUES (?, ?, 'mcp', ?)
       ON CONFLICT(slug) DO UPDATE SET description = excluded.description`,
    )
    .bind(slug, description, now)
    .run();

  const items = Array.isArray(args.items) ? args.items : [];
  for (const item of items.slice(0, 100)) {
    await d1
      .prepare(
        `INSERT OR IGNORE INTO tag_items (tag_slug, label, type, command)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(slug, String(item.label || ""), String(item.type || ""), String(item.command || ""))
      .run();
  }

  return { ok: true, slug, itemsAdded: items.length };
}

// ── bucket handlers ───────────────────────────────────────────────────────────

async function handleBucketList(env, args) {
  const bucket = bucketBinding(env, String(args.bucket || "posts"));
  if (!bucket) throw new Error("R2 bucket binding unavailable");

  const prefix = String(args.prefix ?? "posts/").replace(/^\//, "");
  const limit = Math.max(1, Math.min(1000, Number(args.limit) || 100));

  const listed = await bucket.list({ prefix, limit });
  return {
    prefix,
    truncated: listed.truncated,
    objects: (listed.objects || []).map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      etag: obj.etag,
    })),
  };
}

async function handleBucketGet(env, args) {
  const key = String(args.key || "").trim();
  if (!key) throw new Error("key is required");

  const bucket = bucketBinding(env, String(args.bucket || "posts"));
  if (!bucket) throw new Error("R2 bucket binding unavailable");

  const obj = await bucket.get(key);
  if (!obj) throw new Error(`Object not found: ${key}`);

  const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
  const isBinary = !/text|json|xml|markdown|javascript|css|html/i.test(contentType);
  const content = isBinary ? `(binary object, ${obj.size} bytes)` : await obj.text();

  return {
    key,
    contentType,
    size: obj.size,
    uploaded: obj.uploaded,
    etag: obj.etag,
    customMetadata: obj.customMetadata || {},
    content,
  };
}

async function handleBucketPut(env, args) {
  const key = String(args.key || "").trim();
  const content = String(args.content || "");
  if (!key) throw new Error("key is required");

  const bucket = bucketBinding(env, String(args.bucket || "posts"));
  if (!bucket) throw new Error("R2 bucket binding unavailable");

  const contentType = String(args.contentType || "text/markdown; charset=utf-8");
  await bucket.put(key, content, { httpMetadata: { contentType } });

  return { ok: true, key, size: new TextEncoder().encode(content).length, contentType };
}

// ── database handlers ─────────────────────────────────────────────────────────

async function handleDbListTables(env) {
  const d1 = dbBinding(env);
  if (!d1) throw new Error("D1 database binding unavailable");

  const result = await d1
    .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
    .all();

  return {
    tables: (result?.results || []).map((r) => ({ name: r.name, type: r.type })),
  };
}

async function handleDbQuery(env, args) {
  const sql = String(args.sql || "").trim();
  if (!sql) throw new Error("sql is required");

  const readOnly = isSqlReadOnly(sql);
  if (!readOnly) {
    const auth = checkToken(args, env);
    if (!auth.ok) throw new Error(`${auth.message} — write queries require a valid token`);
  }

  const d1 = dbBinding(env);
  if (!d1) throw new Error("D1 database binding unavailable");

  const params = Array.isArray(args.params) ? args.params : [];

  let stmt = d1.prepare(sql);
  if (params.length) stmt = stmt.bind(...params);

  if (readOnly) {
    const result = await stmt.all();
    return {
      results: result?.results || [],
      meta: result?.meta || {},
    };
  }

  const result = await stmt.run();
  return {
    ok: true,
    meta: result?.meta || {},
    changes: result?.meta?.changes ?? null,
    lastRowId: result?.meta?.last_row_id ?? null,
  };
}
