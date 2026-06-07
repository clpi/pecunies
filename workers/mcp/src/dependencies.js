/**
 * Consolidated dependencies for the MCP worker.
 * Bundles all shared logic from knowledge-store.js, posts.js, ai-models.js, ai-log.js.
 * Only exports what mcp-core.js actually imports.
 */

// ── ai-log.js ─────────────────────────────────────────────────────────────────

const AI_LOG_KV_KEY = "global:ai.log";
const MAX_STORE_BYTES = 110_000;

function truncate(str, max) {
  if (str == null || str === "") return "";
  const s = String(str);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated, was ${s.length} chars]`;
}

async function appendAiLog(env, entry) {
  if (!env?.PORTFOLIO_OS) return;

  const ts = new Date().toISOString();
  const lines = [
    "────────────────────────────────────────────────────────────",
    `${ts}  source=${entry.source}  session=${entry.sessionId ?? "anonymous"}  model=${entry.model ?? "unknown"}`,
    `query:\n${truncate(entry.query, 4500)}`,
  ];

  if (entry.contextExcerpt) {
    lines.push(`context_excerpt:\n${truncate(entry.contextExcerpt, 4000)}`);
  }

  if (entry.error) {
    lines.push(`error:\n${truncate(entry.error, 800)}`);
  } else {
    lines.push(`response:\n${truncate(entry.response ?? "", 6500)}`);
  }

  lines.push("");

  const block = `${lines.join("\n")}\n`;

  try {
    const prev = (await env.PORTFOLIO_OS.get(AI_LOG_KV_KEY)) ?? "";
    let next = prev + block;
    if (next.length > MAX_STORE_BYTES) {
      next = next.slice(-Math.floor(MAX_STORE_BYTES * 0.92));
      next = `…[earlier entries truncated for KV size]\n\n${next}`;
    }
    await env.PORTFOLIO_OS.put(AI_LOG_KV_KEY, next);
  } catch {
    /* best-effort */
  }
}

// ── ai-models.js ──────────────────────────────────────────────────────────────

const DEFAULT_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const WORKERS_AI_TEXT_MODELS = [
  DEFAULT_AI_MODEL,
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-70b-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/mistralai/mistral-7b-instruct-v0.1",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/google/gemma-3-12b-it",
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/qwen/qwen1.5-14b-chat-awq",
  "@cf/qwen/qwen2.5-coder-32b-instruct",
  "@cf/qwen/qwen2.5-32b-instruct",
  "@cf/qwen/qwen2.5-72b-instruct",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/qwen/qwq-32b",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/openai/gpt-oss-20b",
  "@cf/openai/gpt-oss-120b",
  "@cf/microsoft/phi-2",
  "@cf/nvidia/nemotron-3-120b-a12b",
  "@cf/ibm-granite/granite-4.0-h-micro",
  "@cf/zai-org/glm-4.7-flash",
  "@cf/moonshotai/kimi-k2.5",
  "@cf/moonshotai/kimi-k2.6",
  "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
  "@hf/nousresearch/hermes-2-pro-mistral-7b",
];

function isValidWorkersAiModelId(model) {
  if (typeof model !== "string") return false;
  const value = model.trim();
  return /^@(cf|hf)\/[a-z0-9._-]+\/[a-z0-9._:-]+$/iu.test(value);
}

function resolveChatModel(requested, configured, fallback) {
  const fb = String(fallback || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL;
  if (isValidWorkersAiModelId(requested)) return requested.trim();
  if (isValidWorkersAiModelId(configured)) return configured.trim();
  return isValidWorkersAiModelId(fb) ? fb : DEFAULT_AI_MODEL;
}

// ── knowledge-store.js ─────────────────────────────────────────────────────────

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const DEFAULT_EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function apiHeaders(extra = {}) {
  return {
    ...jsonHeaders,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, cf-aig-authorization",
    ...extra,
  };
}

function optionsResponse(methods = "GET, POST, OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: apiHeaders({
      Allow: methods,
      "Access-Control-Allow-Methods": methods,
    }),
  });
}

/** Timing-safe string comparison — prevents side-channel attacks on token checks. */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

function errorJson(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status, headers: apiHeaders() });
}

function requireApiAuth(request, env) {
  const candidates = [
    env.PECUNIES_API_TOKEN,
    env.POSTS_SYNC_TOKEN,
    env.PECUNIES_SUDO_PASSWD,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  if (!candidates.length) {
    return {
      ok: false,
      status: 501,
      message:
        "Write API token is not configured. Set PECUNIES_API_TOKEN, POSTS_SYNC_TOKEN, or PECUNIES_SUDO_PASSWD.",
    };
  }

  const auth = String(request.headers.get("authorization") || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token || !candidates.some((c) => timingSafeEqual(c, token))) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }

  return { ok: true };
}

function normalizeFsPath(path) {
  const raw = String(path || "").trim();
  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  const cleaned = prefixed
    .replace(/\/+/g, "/")
    .replace(/\0/g, "")
    .replace(/\.(?=\/|$)/g, "")
    .replace(/\/[^/]+\/\.\.(?=\/|$)/g, "");
  return cleaned.replace(/\/+$/, "") || "/";
}

function slugify(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "untitled"
  );
}

function datedPath(prefix, title, ext = "md", date = new Date()) {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const safeExt = String(ext || "md").replace(/^\./, "").replace(/[^a-z0-9]/gi, "") || "md";
  return normalizeFsPath(`${prefix}/${yyyy}/${mm}/${dd}/${slugify(title)}.${safeExt}`);
}

function ksDb(env) {
  return env.DB || env.POSTS_DB || null;
}

function fsBucket(env) {
  return env.STATIC || env.POSTS || env.POSTS_BUCKET || null;
}

function vectorIndex(env) {
  return env.RAG_VECTORIZE || env.VECTORIZE || env.VECTORIZE_INDEX || null;
}

async function ensureKnowledgeInfra(env) {
  const d1 = ksDb(env);
  if (!d1) return;

  const stmts = [
    `CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      content_type TEXT NOT NULL,
      markdown TEXT NOT NULL,
      body_text TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      r2_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_documents_kind ON knowledge_documents(kind, updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_kind ON knowledge_chunks(kind, updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      meeting_at TEXT,
      attendees_json TEXT NOT NULL,
      transcript TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      source TEXT NOT NULL,
      markdown TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ];

  for (const sql of stmts) {
    await d1.prepare(sql).run();
  }
}

function markdownToPlain(markdown) {
  return String(markdown || "")
    .replace(/^---[\s\S]*?\n---\s*/m, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_\-~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFrontmatterKS(markdown) {
  if (!markdown || typeof markdown !== "string" || !markdown.startsWith("---")) {
    return { body: markdown || "", meta: {} };
  }
  const end = markdown.indexOf("\n---", 3);
  if (end < 0) {
    return { body: markdown, meta: {} };
  }
  const raw = markdown.slice(3, end).trim();
  const body = markdown.slice(end + 4).trim();
  const meta = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { body, meta };
}

function chunkText(text, size = 1250, overlap = 160) {
  const input = String(text || "").trim();
  if (!input) return [];
  const chunks = [];
  let start = 0;
  while (start < input.length && chunks.length < 500) {
    const end = Math.min(input.length, start + size);
    chunks.push(input.slice(start, end).trim());
    if (end >= input.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks.filter(Boolean);
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function embeddingVectors(env, texts) {
  if (!env.AI || !texts.length) return [];
  try {
    const res = await env.AI.run(DEFAULT_EMBED_MODEL, {
      text: texts.map((t) => String(t).slice(0, 2000)),
    });
    const data = res?.data || res?.result?.data || res?.embeddings || [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function upsertVectors(env, doc, chunks) {
  const index = vectorIndex(env);
  if (!index?.upsert || !chunks.length) return { attempted: false, count: 0 };

  const vectors = await embeddingVectors(env, chunks.map((chunk) => chunk.text));
  if (!vectors.length) return { attempted: true, count: 0 };

  const records = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const values = vectors[i];
    if (!Array.isArray(values)) continue;
    const hash = await sha256Hex(`${doc.path}:${i}`);
    records.push({
      id: `k-${hash.slice(0, 30)}-${i}`.slice(0, 63),
      values,
      metadata: {
        path: doc.path,
        kind: doc.kind,
        title: doc.title,
        source: doc.source,
        chunk: i,
        text: chunks[i].text.slice(0, 1500),
      },
    });
  }

  for (let i = 0; i < records.length; i += 500) {
    await index.upsert(records.slice(i, i + 500));
  }

  return { attempted: true, count: records.length };
}

async function upsertKnowledgeDocument(env, input) {
  await ensureKnowledgeInfra(env);

  const path = normalizeFsPath(input.path);
  const now = new Date().toISOString();
  const { body, meta } = parseFrontmatterKS(String(input.markdown || ""));
  const title =
    String(input.title || meta.title || body.match(/^#\s+(.+)$/m)?.[1] || path.split("/").pop() || "Untitled").trim();
  const markdown = String(input.markdown || "");
  const plain = markdownToPlain(markdown);
  const kind = String(input.kind || "wiki").toLowerCase();
  const source = String(input.source || "api").slice(0, 80);
  const contentType = String(input.contentType || "text/markdown; charset=utf-8");
  const metadata = {
    ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
    frontmatter: meta,
  };
  const docId = `doc-${(await sha256Hex(path)).slice(0, 32)}`;
  const r2Key = `fs${path}`;

  if (env.PORTFOLIO_OS) {
    await env.PORTFOLIO_OS.put(`file:${path}`, markdown);
  }

  const bucket = fsBucket(env);
  if (bucket) {
    await bucket.put(r2Key, markdown, {
      httpMetadata: { contentType },
      customMetadata: {
        path,
        kind,
        title: title.slice(0, 512),
        source,
      },
    });
    await bucket.put(`ai-search${path}`, markdown, {
      httpMetadata: { contentType },
      customMetadata: {
        path,
        kind,
        title: title.slice(0, 512),
        source,
      },
    });
  }

  if (kind === "post" && path.startsWith("/posts/") && path.endsWith(".md")) {
    const { syncPostToStorage } = await import("./dependencies.js");
    await syncPostToStorage(env, path, markdown);
  }

  const d1 = ksDb(env);
  if (d1) {
    await d1
      .prepare(
        `INSERT INTO knowledge_documents (
          id, path, kind, source, title, content_type, markdown, body_text,
          metadata_json, r2_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          kind = excluded.kind,
          source = excluded.source,
          title = excluded.title,
          content_type = excluded.content_type,
          markdown = excluded.markdown,
          body_text = excluded.body_text,
          metadata_json = excluded.metadata_json,
          r2_key = excluded.r2_key,
          updated_at = excluded.updated_at`,
      )
      .bind(
        docId,
        path,
        kind,
        source,
        title,
        contentType,
        markdown,
        plain,
        JSON.stringify(metadata),
        r2Key,
        now,
        now,
      )
      .run();

    await d1.prepare("DELETE FROM knowledge_chunks WHERE doc_id = ?").bind(docId).run();
  }

  const chunks = chunkText([title, plain || body || markdown].join("\n\n")).map((text, index) => ({
    id: `${docId}:${index}`,
    text,
    index,
  }));

  if (d1) {
    for (const chunk of chunks) {
      await d1
        .prepare(
          `INSERT INTO knowledge_chunks (
            id, doc_id, path, kind, chunk_index, text, metadata_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          chunk.id,
          docId,
          path,
          kind,
          chunk.index,
          chunk.text,
          JSON.stringify({ path, kind, title, source, chunk: chunk.index }),
          now,
        )
        .run();
    }
  }

  const vector = await upsertVectors(env, { path, kind, title, source }, chunks);

  return {
    id: docId,
    path,
    kind,
    title,
    chunks: chunks.length,
    r2Key: bucket ? r2Key : null,
    vector,
    updatedAt: now,
  };
}

async function readKnowledgeDocument(env, path) {
  const normalized = normalizeFsPath(path);
  if (env.PORTFOLIO_OS) {
    const value = await env.PORTFOLIO_OS.get(`file:${normalized}`);
    if (value != null) return { path: normalized, markdown: value, source: "kv" };
  }

  const d1 = ksDb(env);
  if (d1) {
    await ensureKnowledgeInfra(env);
    const row = await d1
      .prepare("SELECT path, title, kind, markdown, metadata_json, updated_at FROM knowledge_documents WHERE path = ?")
      .bind(normalized)
      .first();
    if (row) {
      return {
        path: row.path,
        title: row.title,
        kind: row.kind,
        markdown: row.markdown,
        metadata: ksSafeJson(row.metadata_json, {}),
        updatedAt: row.updated_at,
        source: "d1",
      };
    }
  }

  const bucket = fsBucket(env);
  if (bucket) {
    const obj = await bucket.get(`fs${normalized}`);
    if (obj) return { path: normalized, markdown: await obj.text(), source: "r2" };
  }

  return null;
}

async function listStoredFilesystem(env, prefix = "/") {
  const wanted = normalizeFsPath(prefix);
  const paths = new Set();

  if (env.PORTFOLIO_OS?.list) {
    let cursor;
    do {
      const page = await env.PORTFOLIO_OS.list({ prefix: "file:", cursor, limit: 1000 });
      cursor = page.cursor;
      for (const key of page.keys || []) {
        const path = key.name.replace(/^file:/, "");
        if (path.startsWith(wanted === "/" ? "/" : `${wanted}/`) || path === wanted) {
          paths.add(path);
        }
      }
    } while (cursor);
  }

  const d1 = ksDb(env);
  if (d1) {
    await ensureKnowledgeInfra(env);
    const rows = await d1
      .prepare("SELECT path FROM knowledge_documents WHERE path LIKE ? ORDER BY path ASC LIMIT 1000")
      .bind(`${wanted === "/" ? "/" : `${wanted}/`}%`)
      .all();
    for (const row of rows?.results || []) {
      paths.add(String(row.path));
    }
  }

  return [...paths].sort();
}

async function queryKnowledge(env, query, options = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  const limit = Math.max(1, Math.min(20, Number(options.limit) || 8));
  const results = [];

  const aiSearch = await queryAiSearch(env, q, limit);
  results.push(...aiSearch);

  const vector = await queryVector(env, q, limit);
  results.push(...vector);

  const lexical = await queryLexical(env, q, limit);
  results.push(...lexical);

  const seen = new Set();
  return results
    .filter((item) => {
      const key = `${item.source}:${item.path}:${item.text.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

async function queryAiSearch(env, query, limit) {
  const instance = String(env.AI_SEARCH_INSTANCE || env.AUTORAG_INSTANCE || "").trim();
  if (!instance || !env.AI?.autorag) return [];
  try {
    const res = await env.AI.autorag(instance).search({
      query,
      max_num_results: limit,
      rewrite_query: true,
    });
    return (res?.data || [])
      .map((entry) => ({
        source: "ai-search",
        path: entry?.metadata?.filename || entry?.metadata?.path || "ai-search",
        title: entry?.metadata?.title || entry?.metadata?.filename || "AI Search result",
        score: Number(entry?.score || 0),
        text: String(entry?.content || "").slice(0, 1600),
      }))
      .filter((entry) => entry.text);
  } catch {
    return [];
  }
}

async function queryVector(env, query, limit) {
  const index = vectorIndex(env);
  if (!index?.query) return [];
  const vectors = await embeddingVectors(env, [query]);
  const values = vectors[0];
  if (!Array.isArray(values)) return [];
  try {
    const res = await index.query(values, {
      topK: limit,
      returnMetadata: "all",
    });
    return (res?.matches || res?.result?.matches || [])
      .map((match) => ({
        source: "vectorize",
        path: match?.metadata?.path || "vectorize",
        title: match?.metadata?.title || "Vector result",
        score: Number(match?.score || 0),
        text: String(match?.metadata?.text || "").slice(0, 1600),
      }))
      .filter((entry) => entry.text);
  } catch {
    return [];
  }
}

async function queryLexical(env, query, limit) {
  const d1 = ksDb(env);
  if (!d1) return [];
  await ensureKnowledgeInfra(env);
  const terms = String(query)
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length > 2)
    .slice(0, 4);
  if (!terms.length) return [];
  const like = `%${terms[0]}%`;
  const rows = await d1
    .prepare(
      `SELECT c.path, c.kind, c.text, c.metadata_json, d.title
       FROM knowledge_chunks c
       JOIN knowledge_documents d ON d.id = c.doc_id
       WHERE lower(c.text) LIKE ?
       ORDER BY c.updated_at DESC
       LIMIT ?`,
    )
    .bind(like, limit)
    .all();
  return (rows?.results || []).map((row) => ({
    source: "d1",
    path: String(row.path || ""),
    title: String(row.title || row.path || "Knowledge result"),
    kind: String(row.kind || "knowledge"),
    score: 0,
    text: String(row.text || "").slice(0, 1600),
    metadata: ksSafeJson(row.metadata_json, {}),
  }));
}

async function buildContext(env, query, options = {}) {
  const hits = await queryKnowledge(env, query, { limit: options.limit || 10 });
  return {
    hits,
    text:
      hits
        .map(
          (hit, index) =>
            `${index + 1}. [${hit.source}] ${hit.title || hit.path}\npath: ${hit.path}\n${hit.text}`,
        )
        .join("\n\n") || "(no retrieved knowledge)",
  };
}

async function callKnowledgeModel(env, input) {
  const model = String(input.model || env.DEFAULT_AI_MODEL || DEFAULT_MODEL).trim();
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const metadata = {
    source: input.source || "api",
    route: input.route || "knowledge",
    sessionId: input.sessionId || "api",
  };
  const gatewayId = String(env.AI_GATEWAY_ID || env.CF_AI_GATEWAY_ID || "").trim();

  if (env.AI && model.startsWith("@cf/")) {
    const result = await env.AI.run(
      model,
      {
        messages,
        temperature: Number(input.temperature ?? 0.2),
        max_tokens: Number(input.maxTokens ?? 900),
      },
      gatewayId
        ? {
            gateway: {
              id: gatewayId,
              metadata,
            },
          }
        : undefined,
    );
    return typeof result?.response === "string"
      ? result.response
      : typeof result?.text === "string"
        ? result.text
        : JSON.stringify(result);
  }

  const gatewayUrl = String(env.AI_GATEWAY_URL || "").trim();
  if (gatewayUrl) {
    const res = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.AI_GATEWAY_TOKEN
          ? { "cf-aig-authorization": `Bearer ${env.AI_GATEWAY_TOKEN}` }
          : {}),
        "cf-aig-metadata": JSON.stringify(metadata),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Number(input.temperature ?? 0.2),
        max_tokens: Number(input.maxTokens ?? 900),
      }),
    });
    if (!res.ok) {
      throw new Error(`AI Gateway request failed: ${res.status}`);
    }
    const json = await res.json();
    return (
      json?.choices?.[0]?.message?.content ||
      json?.response ||
      json?.text ||
      JSON.stringify(json)
    );
  }

  throw new Error("No Workers AI binding or AI_GATEWAY_URL configured.");
}

async function answerWithKnowledge(env, input) {
  const query = String(input.query || input.message || "").trim();
  if (!query) throw new Error("message is required");
  const context = await buildContext(env, query, { limit: input.limit || 10 });
  const system = [
    "You are the API knowledge assistant for Chris Pecunies.",
    "Answer in Chris Pecunies' practical, concise engineering voice.",
    "Use the retrieved repository context. If the context does not establish an answer, say what is missing.",
    input.system ? `Additional system instruction: ${String(input.system).slice(0, 1600)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Retrieved repository context:\n${context.text}\n\nQuestion:\n${query}`,
    },
  ];
  const answer = await callKnowledgeModel(env, {
    model: input.model,
    messages,
    source: input.source || "api",
    route: input.route || "ai",
    sessionId: input.sessionId,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });

  await appendAiLog(env, {
    source: input.source || "api",
    sessionId: input.sessionId || "api",
    model: input.model || env.DEFAULT_AI_MODEL || DEFAULT_MODEL,
    query,
    contextExcerpt: context.text,
    response: answer,
  });

  return { answer, context: context.hits };
}

function ksSafeJson(value, fallback) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}

// ── posts.js ──────────────────────────────────────────────────────────────────

const STATIC_ASSET_POSTS = {
  "/public/posts/2026/04/29/terminal-portfolio-changelog.md": `---
title: Terminal Portfolio Changelog
date: 2026-04-29
tags: writing, content, terminal
description: Changelog and notes for the terminal-native portfolio writing system.
---

# Terminal Portfolio Changelog

Initial post placeholder for the terminal-native writing system. Posts are markdown files under \`/posts\`; creating, editing, or removing them requires sudo privileges.`,
};

function assetPathToPostPath(path) {
  const normalized = String(path || "").trim();
  return normalized.startsWith("/public/posts/")
    ? normalized.replace(/^\/public/, "")
    : normalized;
}

function postsDb(env) {
  return env.POSTS_DB || env.DB || null;
}

function postsBucket(env) {
  return env.POSTS_BUCKET || env.POSTS || null;
}

function parseFrontmatterPosts(markdown) {
  if (
    !markdown ||
    typeof markdown !== "string" ||
    !markdown.startsWith("---")
  ) {
    return { body: markdown || "", meta: {} };
  }
  const end = markdown.indexOf("\n---", 3);
  if (end < 0) {
    return { body: markdown, meta: {} };
  }
  const raw = markdown.slice(3, end).trim();
  const body = markdown.slice(end + 4).trim();
  const meta = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase();
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    meta[k] = v;
  }
  return { body, meta };
}

function dateFromPostPath(path) {
  const m = path.match(/^\/posts\/(\d{4})\/(\d{2})\/(\d{2})\/[^/]+\.md$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function tagsFromMeta(meta) {
  if (!meta || !meta.tags) return [];
  return String(meta.tags)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function slugFromPath(path) {
  const base = path.split("/").pop() || path;
  return base.replace(/\.md$/i, "") || base;
}

async function ensureContentInfra(env) {
  const db = postsDb(env);
  if (!db) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS posts (
      path TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      published TEXT NOT NULL,
      updated TEXT NOT NULL,
      description TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      body_text TEXT NOT NULL,
      featured_asset TEXT,
      r2_markdown_key TEXT,
      r2_snapshot_key TEXT,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS post_tags (
      post_path TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (post_path, tag)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag)`,
    `CREATE TABLE IF NOT EXISTS post_search (
      post_path TEXT PRIMARY KEY,
      searchable_text TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS post_metrics (
      post_path TEXT PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0,
      reactions INTEGER NOT NULL DEFAULT 0,
      messages INTEGER NOT NULL DEFAULT 0,
      bookings INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS post_reactions (
      post_path TEXT NOT NULL,
      reaction TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (post_path, reaction)
    )`,
    `CREATE TABLE IF NOT EXISTS post_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_path TEXT NOT NULL,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      kind TEXT NOT NULL,
      parent_id INTEGER,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration TEXT NOT NULL,
      message TEXT NOT NULL,
      meet_link TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tags (
      slug TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'post',
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tag_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_slug TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      command TEXT NOT NULL,
      UNIQUE(tag_slug, command)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tag_items_slug ON tag_items(tag_slug)`,
  ];
  for (const sql of stmts) {
    await db.prepare(sql).run();
  }
  try {
    await db.prepare(`ALTER TABLE post_messages ADD COLUMN parent_id INTEGER`).run();
  } catch {
    // Column already exists on established databases.
  }
}

async function upsertTagWithItems(db, slug, items, source = "post") {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO tags (slug, description, source, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(slug) DO NOTHING`,
    )
    .bind(slug, "", source, now)
    .run();
  for (const item of items) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO tag_items (tag_slug, label, type, command)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(
        slug,
        String(item.label || ""),
        String(item.type || ""),
        String(item.command || ""),
      )
      .run();
  }
}

async function syncPostToStorage(env, path, markdown) {
  await ensureContentInfra(env);
  const db = postsDb(env);
  const bucket = postsBucket(env);
  const payload = await postPayload(path, markdown, env);
  const nowIso = new Date().toISOString();
  const r2MarkdownKey = `posts/markdown${path}`;
  const r2SnapshotKey = `posts/snapshots${path}.${nowIso.replaceAll(":", "-")}.json`;

  if (bucket) {
    await bucket.put(r2MarkdownKey, markdown, {
      httpMetadata: { contentType: "text/markdown; charset=utf-8" },
      customMetadata: {
        path,
        slug: payload.slug,
        published: payload.published,
        updated: payload.updated,
      },
    });
    await bucket.put(
      r2SnapshotKey,
      JSON.stringify({
        path,
        slug: payload.slug,
        title: payload.title,
        tags: payload.tags,
        description: payload.description,
        published: payload.published,
        updated: payload.updated,
        markdown,
        comments: payload.comments,
      }),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );
  }

  if (!db) return;

  await db
    .prepare(
      `INSERT INTO posts (
      path, slug, title, published, updated, description, tags_json, body_text, featured_asset,
      r2_markdown_key, r2_snapshot_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      published = excluded.published,
      updated = excluded.updated,
      description = excluded.description,
      tags_json = excluded.tags_json,
      body_text = excluded.body_text,
      featured_asset = excluded.featured_asset,
      r2_markdown_key = excluded.r2_markdown_key,
      r2_snapshot_key = excluded.r2_snapshot_key,
      updated_at = excluded.updated_at`,
    )
    .bind(
      path,
      payload.slug,
      payload.title,
      payload.published,
      payload.updated,
      payload.description,
      JSON.stringify(payload.tags),
      payload.body,
      String(payload.meta.featured || "").trim() || null,
      bucket ? r2MarkdownKey : null,
      bucket ? r2SnapshotKey : null,
      nowIso,
    )
    .run();

  await db
    .prepare("DELETE FROM post_tags WHERE post_path = ?")
    .bind(path)
    .run();
  for (const tag of payload.tags) {
    await db
      .prepare("INSERT OR IGNORE INTO post_tags (post_path, tag) VALUES (?, ?)")
      .bind(path, tag)
      .run();
    await upsertTagWithItems(
      db,
      tag,
      [
        {
          label: payload.title,
          type: "post",
          command: `post open ${payload.slug}`,
        },
      ],
      "post",
    );
  }
  await db
    .prepare(
      `INSERT INTO post_search (post_path, searchable_text, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(post_path) DO UPDATE SET searchable_text = excluded.searchable_text, updated_at = excluded.updated_at`,
    )
    .bind(
      path,
      [payload.title, payload.description, payload.body, payload.tags.join(" ")].join("\n"),
      nowIso,
    )
    .run();
  await db
    .prepare(
      `INSERT INTO post_metrics (post_path, views, reactions, messages, bookings, updated_at)
     VALUES (?, 0, 0, 0, 0, ?)
     ON CONFLICT(post_path) DO NOTHING`,
    )
    .bind(path, nowIso)
    .run();
}

async function deletePostFromStorage(env, path) {
  await ensureContentInfra(env);
  const db = postsDb(env);
  const bucket = postsBucket(env);
  if (bucket) {
    await bucket.delete(`posts/markdown${path}`);
  }
  if (!db) return;
  await db.prepare("DELETE FROM post_tags WHERE post_path = ?").bind(path).run();
  await db.prepare("DELETE FROM post_search WHERE post_path = ?").bind(path).run();
  await db.prepare("DELETE FROM post_metrics WHERE post_path = ?").bind(path).run();
  await db.prepare("DELETE FROM post_reactions WHERE post_path = ?").bind(path).run();
  await db.prepare("DELETE FROM post_messages WHERE post_path = ?").bind(path).run();
  await db.prepare("DELETE FROM posts WHERE path = ?").bind(path).run();
}

async function postPayload(path, markdown, env) {
  const { body, meta } = parseFrontmatterPosts(markdown);
  const pathDate = dateFromPostPath(path);
  const titleFromBody = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title =
    (meta.title && meta.title.trim()) || titleFromBody || slugFromPath(path);

  const publishedRaw = meta.date || meta.published || pathDate;
  let published = publishedRaw;
  if (published && !/^\d{4}-\d{2}-\d{2}/.test(published)) {
    const d = new Date(published);
    published = Number.isNaN(d.getTime())
      ? pathDate || new Date().toISOString().slice(0, 10)
      : d.toISOString().slice(0, 10);
  }
  if (!published) {
    published = new Date().toISOString().slice(0, 10);
  }

  const updated =
    meta.updated && /^\d{4}-\d{2}-\d{2}/.test(meta.updated)
      ? meta.updated.slice(0, 10)
      : published;

  const tags = tagsFromMeta(meta);
  const plain = body
    .replace(/^#\s+.+$/m, "")
    .replace(/[#*_`]/g, "")
    .trim();
  const description =
    (meta.description && meta.description.trim()) ||
    plain.slice(0, 360).trim() ||
    title;

  let comments = [];
  const db = postsDb(env);
  if (db) {
    const pmRows = await db
      .prepare(
        `SELECT id, name, message, kind, parent_id, created_at as at
         FROM post_messages
         WHERE post_path = ? AND kind IN ('comment', 'reply')
         ORDER BY created_at ASC
         LIMIT 200`,
      )
      .bind(path)
      .all();
    const pmRaw = Array.isArray(pmRows?.results) ? pmRows.results : [];

    const slug = slugFromPath(path);
    let cRows = { results: [] };
    try {
      cRows = await db
        .prepare(
          `SELECT id, author, body as message, parent_id, created_at as at
           FROM comments
           WHERE target_type = 'post' AND target_slug = ?
           ORDER BY created_at ASC
           LIMIT 200`,
        )
        .bind(slug)
        .all();
    } catch {
      // comments table may not exist yet.
    }
    const cRaw = Array.isArray(cRows?.results) ? cRows.results : [];

    const raw = [...pmRaw, ...cRaw];
    const commentMap = new Map();
    const orderedComments = [];
    const seenIds = new Set();
    for (const row of raw) {
      const kind = String(row?.kind || "comment");
      const id = String(row?.id ?? "");
      if (kind === "reply") continue;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const comment = {
        id: typeof row?.id === "number" ? row.id : id,
        name: String(row?.name || row?.author || "anonymous"),
        message: String(row?.message || ""),
        at: String(row?.at || ""),
        replies: [],
      };
      commentMap.set(id, comment);
      orderedComments.push(comment);
    }
    for (const row of raw) {
      if (String(row?.kind || "comment") !== "reply") continue;
      const parentId = String(row?.parent_id ?? "");
      const parent = commentMap.get(parentId);
      if (!parent) continue;
      parent.replies.push({
        id: typeof row?.id === "number" ? row.id : String(row?.id ?? ""),
        name: String(row?.name || row?.author || "anonymous"),
        message: String(row?.message || ""),
        at: String(row?.at || ""),
      });
    }
    comments = orderedComments;
  } else if (env.PORTFOLIO_OS) {
    comments =
      (await env.PORTFOLIO_OS.get(`comments:${path}`, { type: "json" })) ?? [];
  }

  return {
    path,
    slug: slugFromPath(path),
    title,
    markdown,
    body,
    meta,
    tags,
    description,
    published,
    updated,
    comments: Array.isArray(comments) ? comments : [],
  };
}

async function collectAllPosts(env) {
  const byPath = new Map();

  for (const [assetPath, markdown] of Object.entries(STATIC_ASSET_POSTS)) {
    const path = assetPathToPostPath(assetPath);
    byPath.set(path, await postPayload(path, markdown, env));
  }

  const db = postsDb(env);
  const bucket = postsBucket(env);

  if (db) {
    await ensureContentInfra(env);
    try {
      const rows = await db
        .prepare("SELECT path, r2_markdown_key FROM posts")
        .all();
      for (const row of rows?.results ?? []) {
        const postPath = String(row?.path || "");
        const r2Key = String(row?.r2_markdown_key || "");
        if (!postPath.startsWith("/posts/")) continue;
        let markdown = null;
        if (bucket && r2Key) {
          const obj = await bucket.get(r2Key);
          if (obj) {
            markdown = await obj.text();
          }
        }
        if (!markdown && env.PORTFOLIO_OS) {
          markdown = await env.PORTFOLIO_OS.get(`file:${postPath}`);
        }
        if (markdown) {
          byPath.set(
            postPath,
            await postPayload(postPath, String(markdown), env),
          );
        }
      }
    } catch {
      // Keep the static seed available even if the database is not ready yet.
    }
  } else if (env.PORTFOLIO_OS?.list) {
    for (const prefix of ["file:/posts/", "file:/public/posts/"]) {
      let cursor;
      do {
        const page = await env.PORTFOLIO_OS.list({
          prefix,
          cursor,
          limit: 1000,
        });
        cursor = page.cursor;

        for (const key of page.keys ?? []) {
          const rawPath = key.name.replace(/^file:/, "");
          const path = assetPathToPostPath(rawPath);
          const markdown = await env.PORTFOLIO_OS.get(key.name);
          if (markdown) {
            byPath.set(path, await postPayload(path, String(markdown), env));
          }
        }
      } while (cursor);
    }
  }

  const posts = Array.from(byPath.values());
  posts.sort((a, b) => {
    const da = `${a.published} ${a.path}`;
    const db2 = `${b.published} ${b.path}`;
    return db2.localeCompare(da);
  });
  return posts;
}

// ── Public exports (what mcp-core.js needs) ──────────────────────────────────

export {
  // ai-log
  appendAiLog,

  // ai-models
  DEFAULT_AI_MODEL,
  WORKERS_AI_TEXT_MODELS,
  isValidWorkersAiModelId,
  resolveChatModel,

  // knowledge-store
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

  // posts
  collectAllPosts,
  deletePostFromStorage,
  postPayload,
  syncPostToStorage,
};