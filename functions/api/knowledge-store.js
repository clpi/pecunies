import { appendAiLog } from "./ai-log.js";
export { DEFAULT_AI_MODEL } from "./ai-models.js";

export const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
export const DEFAULT_EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";

export const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function apiHeaders(extra = {}) {
  return {
    ...jsonHeaders,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, cf-aig-authorization",
    ...extra,
  };
}

export function optionsResponse(methods = "GET, POST, OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: apiHeaders({
      Allow: methods,
      "Access-Control-Allow-Methods": methods,
    }),
  });
}

export function errorJson(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status, headers: apiHeaders() });
}

export function requireApiAuth(request, env) {
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

  if (!token || !candidates.includes(token)) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }

  return { ok: true };
}

export async function parseRequestPayload(request) {
  const type = String(request.headers.get("content-type") || "").toLowerCase();

  if (type.includes("application/json")) {
    return { kind: "json", value: await request.json() };
  }

  if (
    type.includes("text/markdown") ||
    type.includes("text/plain") ||
    type.includes("application/x-markdown")
  ) {
    return { kind: "text", value: await request.text() };
  }

  if (type.includes("application/pdf")) {
    return {
      kind: "binary",
      value: await request.arrayBuffer(),
      contentType: "application/pdf",
    };
  }

  const text = await request.text();
  try {
    return { kind: "json", value: JSON.parse(text) };
  } catch {
    return { kind: "text", value: text };
  }
}

export function normalizeFsPath(path) {
  const raw = String(path || "").trim();
  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  const cleaned = prefixed
    .replace(/\/+/g, "/")
    .replace(/\0/g, "")
    .replace(/\/\.(?=\/|$)/g, "")
    .replace(/\/[^/]+\/\.\.(?=\/|$)/g, "");
  return cleaned.replace(/\/+$/, "") || "/";
}

export function slugify(value) {
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

export function datedPath(prefix, title, ext = "md", date = new Date()) {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const safeExt = String(ext || "md").replace(/^\./, "").replace(/[^a-z0-9]/gi, "") || "md";
  return normalizeFsPath(`${prefix}/${yyyy}/${mm}/${dd}/${slugify(title)}.${safeExt}`);
}

export function db(env) {
  return env.DB || env.POSTS_DB || null;
}

function fsBucket(env) {
  return env.STATIC || env.POSTS || env.POSTS_BUCKET || null;
}

function vectorIndex(env) {
  return env.RAG_VECTORIZE || env.VECTORIZE || env.VECTORIZE_INDEX || null;
}

export async function ensureKnowledgeInfra(env) {
  const d1 = db(env);
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

export function markdownToPlain(markdown) {
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

export function parseFrontmatter(markdown) {
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

export function chunkText(text, size = 1250, overlap = 160) {
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

export async function upsertKnowledgeDocument(env, input) {
  await ensureKnowledgeInfra(env);

  const path = normalizeFsPath(input.path);
  const now = new Date().toISOString();
  const { body, meta } = parseFrontmatter(String(input.markdown || ""));
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
    const { syncPostToStorage } = await import("./posts.js");
    await syncPostToStorage(env, path, markdown);
  }

  const d1 = db(env);
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

export async function storeBinaryObject(env, input) {
  const path = normalizeFsPath(input.path);
  const bucket = fsBucket(env);
  if (!bucket) {
    throw new Error("R2 bucket binding is unavailable.");
  }
  const contentType = input.contentType || "application/octet-stream";
  const key = `fs${path}`;
  await bucket.put(key, input.data, {
    httpMetadata: { contentType },
    customMetadata: {
      path,
      kind: String(input.kind || "asset"),
      title: String(input.title || path.split("/").pop() || "asset").slice(0, 512),
    },
  });
  return { path, r2Key: key, contentType };
}

export async function readKnowledgeDocument(env, path) {
  const normalized = normalizeFsPath(path);
  if (env.PORTFOLIO_OS) {
    const value = await env.PORTFOLIO_OS.get(`file:${normalized}`);
    if (value != null) return { path: normalized, markdown: value, source: "kv" };
  }

  const d1 = db(env);
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
        metadata: safeJson(row.metadata_json, {}),
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

export async function listStoredFilesystem(env, prefix = "/") {
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

  const d1 = db(env);
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

export async function queryKnowledge(env, query, options = {}) {
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
  const d1 = db(env);
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
    metadata: safeJson(row.metadata_json, {}),
  }));
}

export async function buildContext(env, query, options = {}) {
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

export async function callKnowledgeModel(env, input) {
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

export async function answerWithKnowledge(env, input) {
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

export async function latestResume(env) {
  const direct = await readKnowledgeDocument(env, "/resume/resume.md");
  if (direct?.markdown) return direct;
  const d1 = db(env);
  if (!d1) return null;
  await ensureKnowledgeInfra(env);
  const row = await d1
    .prepare(
      `SELECT path, title, markdown, metadata_json, created_at
       FROM knowledge_documents
       WHERE kind = 'resume'
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .first();
  return row
    ? {
        path: row.path,
        title: row.title,
        markdown: row.markdown,
        metadata: safeJson(row.metadata_json, {}),
        updatedAt: row.created_at,
      }
    : null;
}

export async function recordResumeVersion(env, doc) {
  const d1 = db(env);
  if (!d1) return;
  await ensureKnowledgeInfra(env);
  await d1
    .prepare(
      `INSERT INTO resume_versions (id, path, source, markdown, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      doc.path,
      doc.source || "api",
      doc.markdown || "",
      JSON.stringify(doc.metadata || {}),
      new Date().toISOString(),
    )
    .run();
}

export async function recordMeeting(env, input) {
  const title = String(input.title || input.metadata?.title || "Meeting").trim();
  const meetingAt = String(input.meetingAt || input.date || new Date().toISOString());
  const attendees = Array.isArray(input.attendees) ? input.attendees : [];
  const transcript = String(input.transcript || input.markdown || input.content || "").trim();
  if (!transcript) throw new Error("transcript or markdown is required");
  const path =
    input.path ||
    datedPath("/root/wiki/meetings", `${meetingAt.slice(0, 10)}-${title}`, "md", new Date(meetingAt));
  const summary = String(input.summary || "").trim();
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `date: ${meetingAt.slice(0, 10)}`,
    "type: meeting",
    attendees.length ? `attendees: ${attendees.join(", ")}` : "",
    "---",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
  const markdown = `${frontmatter}# ${title}\n\n${summary ? `## Summary\n\n${summary}\n\n` : ""}## Transcript\n\n${transcript}`;
  const doc = await upsertKnowledgeDocument(env, {
    path,
    kind: "meeting",
    source: "api",
    title,
    markdown,
    metadata: {
      ...(input.metadata || {}),
      meetingAt,
      attendees,
    },
  });

  const d1 = db(env);
  if (d1) {
    await ensureKnowledgeInfra(env);
    await d1
      .prepare(
        `INSERT INTO meetings (
          id, path, title, meeting_at, attendees_json, transcript, summary, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        doc.id,
        doc.path,
        title,
        meetingAt,
        JSON.stringify(attendees),
        transcript,
        summary,
        JSON.stringify(input.metadata || {}),
        new Date().toISOString(),
      )
      .run();
  }

  return doc;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}
