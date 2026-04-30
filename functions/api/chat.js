import { appendAiLog } from './ai-log.js';
import { queryKnowledge } from './knowledge-store.js';
import { collectAllPosts } from './posts.js';

const MODEL = '@cf/meta/llama-3.1-8b-instruct';
const ALLOWED_MODELS = new Set([
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/qwen/qwen1.5-14b-chat-awq',
  "@cf/qwen/qwen2.5-coder-32b-instruct",
  "@openai/gpt-4o-mini",
  "@cf/qwen/qwen2.5-32b-instruct",
  "@cf/qwen/qwen2.5-72b-instruct",
  "@hf/nousresearch/hermes-2-pro-mistral-7b"
]);

const PROFILE_CONTEXT = `
You answer questions about Chris Pecunies using only this public portfolio context.
If asked for private, unknown, or speculative details, say you do not know from the supplied context.
Keep answers concise, factual, and grounded.

Chris Pecunies is a Seattle-based Software Engineer specializing in cloud services, workflow automation, distributed systems, and full-stack cloud applications.

Summary:
- 4+ years across AWS, Azure, GCP, and OCI.
- Builds workflow automation/orchestration tooling, CI/CD pipelines, Infrastructure as Code, and complex interconnected cloud services.
- Proficient in Python, C++, Rust, Go, SQL, TypeScript, Zig, Terraform, Ansible, Kubernetes, Docker, AWS CDK, Grafana, Prometheus, and FastAPI.

Experience:
- DevOps Engineer, HashGraph, Remote / Seattle, September 2025-November 2025: managed blockchain infrastructure across 8+ environments, implemented GitOps with ArgoCD, strengthened deployment integrity checks, optimized Grafana and PromQL alerting, and managed GCP lifecycle with Terraform and Ansible Vault.
- Software Engineer, WiseBlocks LLC, Hybrid / Golden CO, June 2022-April 2024: built a distributed transaction database in Go, integrated a Rust WebAssembly VM, engineered cloud networking with Ansible/Terraform/Prometheus/Grafana for 99.9% uptime, built Next.js visualization, FastAPI data services, gRPC, and Protocol Buffers.
- AWS Consultant, Impresys Software Corporation, Seattle, September 2019-May 2022: delivered AWS/Azure technical training, collaborated with AWS engineers on AWS CDK and IaC architecture automation, documented CI/CD and DevOps processes, and modernized legacy workflows to Python with Qt/QML and OpenCV, increasing production velocity over sevenfold.
- Research Assistant, University of Washington, Seattle, June 2018-April 2021: provisioned AWS/React/Django/FastAPI/PostgreSQL/Docker scientific apps, developed Python scientific simulations, and led data analysis/machine learning work on graphene-binding neuropeptide motifs.

Projects:
- Marketplace Aggregator on AWS at https://moe.pecunies.com, April 2026-present: serverless, message-oriented marketplace aggregation platform using Lambda, Step Functions, DynamoDB, SQS, API Gateway, CloudFront, and AWS CDK. It handles eventual consistency, rate limiting, external marketplace failures, transparent retry/state management, two-layer idempotency, and HMAC-SHA256 webhook verification.
- WebAssembly Runtime in Zig at https://github.com/clpi/wart.git, May 2025-present: performance-targeting WebAssembly runtime developed in Zig, optimized for memory layout and instruction dispatch, with nearly full WebAssembly 3.0 and WASI 1 preview support.
- Raspberry Pi Infrastructure Cluster, 2024-present: home-lab infrastructure cluster for Kubernetes, GitOps, monitoring, and resource-constrained deployment experiments.
- down.nvim at https://github.com/clpi/down.nvim.git, 2026-present: Neovim 0.12+ markdown note-taking plugin with planned LSP and AI-assisted workflow integration.

Education:
- University of Washington, B.S. Materials Science & Engineering, August 2015-June 2019. Coursework included database systems, data structures and algorithms, artificial intelligence, and machine learning. Degree focus in Nanotechnology & Molecular Engineering.

Contact:
- Email: chris@pecunies.com
- GitHub: https://github.com/clpi
- GitLab: https://gitlab.com/clpi
- LinkedIn: https://linkedin.com/in/chrispecunies
- Website: https://pecunies.com

Terminal app context:
- Core views: about, resume, timeline, projects, skills, posts, links, contact, pdf, chat, help, themes.
- Documents: download [--markdown], pdf.
- OS commands: ls, cat, man, whoami, history, ps, top, pwd, echo, cp, tree, find, grep, date, uptime, last.
- AI commands: ask <question>, explain <project|skill|work|education|command> [name], chat.
- Network commands: curl, ping, traceroute, trace, weather, stock, internet.
- Games and state: 2048, chess, minesweeper, jobquest (Signal Hunt text adventure), leaderboard, metrics.
- Contact commands: email <your email> <subject> <message>, book <your email> <date> <time> <duration> <message>.
- Window/theme commands: theme <red|amber|frost|ivory|auto>, maximize, minimize, shutdown, clear, exit.
`;

const COMMAND_REFERENCE = `
Command reference (name: usage - description):
- help: help [command] - open command registry or manual page for a command
- commands: commands [command] - list commands or open a command manual
- man: man [command] - manual pages with examples and related commands
- tags: tags [tag|prefix|tag1 tag2 ...] - browse/filter content tags
- resume: resume - resume overview
- experience: experience - work timeline
- timeline: timeline - combined chronology
- skills: skills [--category|--applications] - skills grouped by perspective
- projects: projects - project index
- project: project <slug> - open project detail
- posts: posts - posts index
- post: post open <slug|path-fragment> - open a post
- contact: contact - contact channels
- links: links - external links and profiles
- pdf: pdf - embedded resume PDF
- download: download [--markdown] - download resume PDF/Markdown
- chat: chat - enter chat mode
- ask: ask <question> - AI answer with terminal context
- explain: explain <project|skill|work|education|command|last> [name] - AI explanation
- theme: theme [set <name>|list|random|auto|<palette>] - palette controls
- themes: themes - palette reference
- dark: dark - force dark mode
- light: light - force light mode
- ls: ls [path] - list files
- cat: cat [--pretty] <path> - read file
- tree: tree [path] - file tree
- find: find <query> - search files/dirs
- grep: grep <query> - search file contents
- pwd: pwd - print working directory
- cd: cd [path] - change directory
- head: head [-n N] <path> - first N lines
- tail: tail [-n N] <path> - last N lines
- less: less <path> - pager view
- cp: cp <text> - copy text
- echo: echo <text> - print text
- comment: comment <post> <name> <message> - comment on post
- internet: internet [site] - tiny fake text-web browser
- weather: weather [location] - current weather
- stock: stock <ticker> - market quote
- ping: ping <host> - edge reachability
- traceroute: traceroute <host> - hop-by-hop route
- whois: whois <site> - ownership metadata
- curl: curl <url> - fetch URL summary
- metrics: metrics - usage metrics
- leaderboard: leaderboard [game] - game scores
- 2048|chess|minesweeper|jobquest: <command> - launch game
`;

const CHAT_TOOL_NAMES = new Set([
  'create_user',
  'register_user',
  'generate_command',
  'compose_query',
]);

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...jsonHeaders,
      Allow: 'POST, OPTIONS',
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return Response.json(
      { error: 'Workers AI binding is not configured.' },
      { status: 500, headers: jsonHeaders },
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: jsonHeaders });
  }

  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const sessionId = sanitizeSessionId(body?.sessionId);
  const requestedModel = typeof body?.model === 'string' ? body.model.trim() : '';
  const activeModel = ALLOWED_MODELS.has(requestedModel) ? requestedModel : MODEL;
  const systemPrompt = typeof body?.systemPrompt === 'string' ? body.systemPrompt.trim().slice(0, 1200) : '';
  const visibleContext = typeof body?.visibleContext === 'string' ? body.visibleContext.trim().slice(-6000) : '';

  if (!message) {
    return Response.json({ error: 'Message is required.' }, { status: 400, headers: jsonHeaders });
  }

  if (message.length > 1600) {
    return Response.json(
      { error: 'Message is too long for this terminal chat.' },
      { status: 413, headers: jsonHeaders },
    );
  }

  const transientHistory = Array.isArray(body?.history)
    ? body.history
        .slice(-8)
        .map((entry) => ({
          role: entry?.kind === 'command' ? 'user' : 'assistant',
          content: String(entry?.text ?? '').slice(0, 900),
        }))
        .filter((entry) => entry.content)
    : [];
  const state = await readState(env, sessionId);
  const metrics = await readJson(env, 'metrics:global', {});
  const leaderboard = await readJson(env, 'leaderboard:global', {});
  const postDigest = await buildPostDigest(env);
  const persistedConversation = Array.isArray(state.chatHistory)
    ? state.chatHistory
        .slice(-12)
        .map((entry) => ({
          role: entry?.role === 'assistant' ? 'assistant' : 'user',
          content: String(entry?.content ?? '').slice(0, 900),
        }))
        .filter((entry) => entry.content)
    : [];
  const mergedHistory = [...persistedConversation, ...transientHistory].slice(-16);
  const persistedHistory = state.history
    .slice(-16)
    .map((entry) => `${entry.at}: ${entry.command}`)
    .join('\n');
  const ragContext = Array.isArray(state.ragContext)
    ? state.ragContext.slice(-20).map((entry) => `${entry.at}: ${entry.text}`).join('\n')
    : '';
  const repositoryHits = await queryKnowledge(env, message, { limit: 8 });
  const repositoryContext =
    repositoryHits
      .map(
        (hit, index) =>
          `${index + 1}. [${hit.source}] ${hit.title || hit.path}\npath: ${hit.path}\n${hit.text}`,
      )
      .join('\n\n') || '(none)';

  const sessionState = JSON.stringify(
    {
      config: state.config ?? {},
      cwd: state.cwd,
      previousCwd: state.previousCwd ?? null,
      rootUntil: Number(state.rootUntil ?? 0),
      reads: state.reads ?? [],
      envVars: state.envVars ?? {},
    },
    null,
    2,
  ).slice(0, 3200);

  const userContent = `Portfolio context:\n${PROFILE_CONTEXT}\n\nTerminal command reference:\n${COMMAND_REFERENCE}\n\nPersistent session/app state:\n${sessionState}\n\nPersistent RAG/session context notes:\n${ragContext || '(none)'}\n\nPersistent repository context (wiki/resume/posts/meetings/files via AI Search, Vectorize, and D1):\n${repositoryContext}\n\nVisible terminal context:\n${visibleContext || '(none)'}\n\nMetrics state:\n${JSON.stringify(metrics).slice(0, 3000)}\n\nLeaderboard state:\n${JSON.stringify(leaderboard).slice(0, 2000)}\n\nPosts digest:\n${postDigest}\n\nPersisted terminal history:\n${persistedHistory || '(empty)'}\n\nQuestion: ${message}`;
  const contextExcerpt = `chat_history_json:\n${JSON.stringify(mergedHistory).slice(0, 3500)}\n\n---\n${userContent}`;

  let result;

  try {
    result = await env.AI.run(activeModel, {
      messages: [
        {
          role: 'system',
          content:
            `You are the AI help mode for Chris Pecunies terminal portfolio. Answer only from the provided context. Be concise and factual.
You may call tools by returning STRICT JSON only, with this shape:
{"tool":"create_user","arguments":{"email":"user@example.com","username":"alice","fullName":"Alice"}}
or
{"tool":"register_user","arguments":{"email":"user@example.com","username":"alice","fullName":"Alice"}}
or
{"tool":"generate_command","arguments":{"goal":"show project timeline","constraints":["concise"],"includeAlternatives":true}}
or
{"tool":"compose_query","arguments":{"objective":"summarize posts about cloud and ai","maxSteps":4}}
If no tool call is needed, return normal assistant text.
${systemPrompt ? `\n\nSession system prompt injection:\n${systemPrompt}` : ''}`,
        },
        ...mergedHistory,
        {
          role: 'user',
          content: userContent,
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
    });
  } catch (err) {
    await appendAiLog(env, {
      source: 'chat',
      sessionId,
      model: activeModel,
      query: message,
      contextExcerpt,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { error: 'Workers AI request failed.' },
      { status: 502, headers: jsonHeaders },
    );
  }

  const answer =
    typeof result?.response === 'string'
      ? result.response
      : typeof result?.text === 'string'
        ? result.text
        : 'I could not extract a text response from the Workers AI result.';
  const toolCall = extractToolCall(answer);
  let finalAnswer = answer;
  if (toolCall) {
    const toolResult = await executeChatTool(env, toolCall);
    finalAnswer = toolResult.ok
      ? `${toolResult.message}`
      : `Tool call failed: ${toolResult.message}`;
  }

  await appendAiLog(env, {
    source: 'chat',
    sessionId,
    model: activeModel,
    query: message,
    contextExcerpt,
    response: finalAnswer,
  });

  state.history.push({ at: new Date().toISOString(), command: `chat: ${message}` });
  state.history = state.history.slice(-120);
  if (!Array.isArray(state.chatHistory)) {
    state.chatHistory = [];
  }
  state.chatHistory.push({ at: new Date().toISOString(), role: 'user', content: message });
  state.chatHistory.push({ at: new Date().toISOString(), role: 'assistant', content: finalAnswer });
  state.chatHistory = state.chatHistory.slice(-40);
  await writeState(env, sessionId, state);

  return Response.json({ answer: finalAnswer, model: activeModel }, { headers: jsonHeaders });
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function readState(env, sessionId) {
  const db = stateDb(env);
  if (db) {
    await ensureStateInfra(env);
    const row = await db.prepare('SELECT state_json FROM session_state WHERE session_id = ? LIMIT 1').bind(sessionId).first();
    const rawJson = String(row?.state_json || '');
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        return normalizeState(parsed);
      } catch {
        // fall through to KV/default
      }
    }
  }
  if (!env.PORTFOLIO_OS) {
    return normalizeState({});
  }

  const state = (await env.PORTFOLIO_OS.get(`session:${sessionId}`, { type: 'json' })) ?? { history: [], reads: [] };
  return normalizeState(state);
}

async function writeState(env, sessionId, state) {
  const db = stateDb(env);
  if (db) {
    await ensureStateInfra(env);
    await db
      .prepare(
        `INSERT INTO session_state (session_id, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      )
      .bind(sessionId, JSON.stringify(state), new Date().toISOString())
      .run();
  }
  if (!env.PORTFOLIO_OS) {
    return;
  }

  await env.PORTFOLIO_OS.put(`session:${sessionId}`, JSON.stringify(state), { expirationTtl: 60 * 60 * 24 * 30 });
}

async function readJson(env, key, fallback) {
  if (!env.PORTFOLIO_OS) {
    return fallback;
  }

  return (await env.PORTFOLIO_OS.get(key, { type: 'json' })) ?? fallback;
}

function sanitizeSessionId(value) {
  const raw = String(value || 'anonymous');
  return raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 96) || 'anonymous';
}

function stateDb(env) {
  return env.DB || env.POSTS_DB || null;
}

async function ensureStateInfra(env) {
  const db = stateDb(env);
  if (!db) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS session_state (
      session_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();
}

function normalizeState(state) {
  const s = state && typeof state === 'object' ? state : {};
  return {
    ...s,
    history: Array.isArray(s.history) ? s.history : [],
    reads: Array.isArray(s.reads) ? s.reads : [],
    ragContext: Array.isArray(s.ragContext) ? s.ragContext : [],
    chatHistory: Array.isArray(s.chatHistory) ? s.chatHistory : [],
  };
}

async function buildPostDigest(env) {
  try {
    const posts = await collectAllPosts(env);
    if (!Array.isArray(posts) || !posts.length) {
      return '(none)';
    }
    return posts
      .slice(0, 12)
      .map((post, idx) =>
        `${idx + 1}. ${post.title} [${post.published || 'unknown'}] tags=${(post.tags || []).join(', ') || 'none'} slug=${post.slug}\n   ${String(post.description || '').slice(0, 180)}`,
      )
      .join('\n');
  } catch {
    return '(failed to load posts)';
  }
}

function extractToolCall(answer) {
  const text = String(answer || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object') return null;
    const tool = String(parsed.tool || '').trim();
    const args = parsed.arguments && typeof parsed.arguments === 'object' ? parsed.arguments : {};
    if (!tool) return null;
    if (!CHAT_TOOL_NAMES.has(tool)) return null;
    return { tool, arguments: args };
  } catch {
    return null;
  }
}

function sanitizeUserField(value, max = 120) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

async function executeChatTool(env, toolCall) {
  if (toolCall.tool === 'generate_command') {
    return executeGenerateCommandTool(toolCall.arguments || {});
  }
  if (toolCall.tool === 'compose_query') {
    return executeComposeQueryTool(toolCall.arguments || {});
  }

  const db = stateDb(env);
  if (!db) {
    return { ok: false, message: 'D1 database binding is required for user registration tools.' };
  }
  await ensureStateInfra(env);
  const tool = toolCall.tool;
  const args = toolCall.arguments || {};
  const email = sanitizeUserField(args.email, 160).toLowerCase();
  const username = sanitizeUserField(args.username, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const fullName = sanitizeUserField(args.fullName || args.name, 120);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Missing/invalid email for user registration.' };
  }
  if (!username || username.length < 3) {
    return { ok: false, message: 'Missing/invalid username for user registration.' };
  }
  const now = new Date().toISOString();
  const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    if (tool === 'create_user') {
      await db
        .prepare(
          `INSERT INTO users (id, email, username, full_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, email, username, fullName || null, now, now)
        .run();
      return { ok: true, message: `User created: ${username} <${email}>` };
    }
    await db
      .prepare(
        `INSERT INTO users (id, email, username, full_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           username = excluded.username,
           full_name = excluded.full_name,
           updated_at = excluded.updated_at`,
      )
      .bind(id, email, username, fullName || null, now, now)
      .run();
    return { ok: true, message: `User registered: ${username} <${email}>` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Database error.' };
  }
}

function executeGenerateCommandTool(args) {
  const goal = sanitizeUserField(args.goal, 240);
  const includeAlternatives = Boolean(args.includeAlternatives);
  const constraints = Array.isArray(args.constraints)
    ? args.constraints.map((value) => sanitizeUserField(value, 120)).filter(Boolean).slice(0, 6)
    : [];
  if (!goal) {
    return { ok: false, message: 'generate_command requires a non-empty goal.' };
  }

  const command = inferCommandFromGoal(goal, constraints);
  const lines = [
    `Recommended command for goal "${goal}":`,
    `\`${command}\``,
  ];
  if (constraints.length) {
    lines.push(`Constraints: ${constraints.join(', ')}`);
  }
  if (includeAlternatives) {
    const alternatives = buildCommandAlternatives(command).slice(0, 3);
    if (alternatives.length) {
      lines.push(`Alternatives: ${alternatives.map((item) => `\`${item}\``).join(', ')}`);
    }
  }
  return { ok: true, message: lines.join('\n') };
}

function executeComposeQueryTool(args) {
  const objective = sanitizeUserField(args.objective, 260);
  const maxStepsRaw = Number(args.maxSteps ?? 4);
  const maxSteps = Number.isFinite(maxStepsRaw) ? Math.min(8, Math.max(2, Math.floor(maxStepsRaw))) : 4;
  if (!objective) {
    return { ok: false, message: 'compose_query requires a non-empty objective.' };
  }

  const steps = composePlanForObjective(objective, maxSteps);
  if (!steps.length) {
    return { ok: false, message: `Could not compose a query plan for "${objective}".` };
  }
  const commandChain = steps.join(' && ');
  const details = [
    `Objective: ${objective}`,
    'Proposed command sequence:',
    ...steps.map((step, idx) => `${idx + 1}. \`${step}\``),
    '',
    `One-liner:\n\`${commandChain}\``,
  ];
  return { ok: true, message: details.join('\n') };
}

function inferCommandFromGoal(goal, constraints) {
  const text = `${goal} ${(constraints || []).join(' ')}`.toLowerCase();
  if (text.includes('timeline')) return 'timeline';
  if (text.includes('project')) return 'projects';
  if (text.includes('skill')) return 'skills --applications';
  if (text.includes('resume')) return 'resume';
  if (text.includes('post')) return 'posts';
  if (text.includes('tag')) return 'tags';
  if (text.includes('weather')) return 'weather';
  if (text.includes('stock')) return 'stock AAPL';
  if (text.includes('network') || text.includes('trace')) return 'traceroute pecunies.com';
  if (text.includes('find') || text.includes('search')) return 'find resume';
  if (text.includes('help') || text.includes('how')) return 'help';
  return `ask ${goal}`;
}

function buildCommandAlternatives(command) {
  if (command === 'projects') return ['project moe-marketplace-aggregator', 'timeline', 'explain project moe-marketplace-aggregator'];
  if (command.startsWith('skills')) return ['skills --category', 'explain skill cloud', 'resume'];
  if (command === 'posts') return ['post open latest', 'tags writing', 'ask summarize latest posts'];
  if (command.startsWith('find')) return ['tree /', 'grep cloud', 'tags cloud'];
  return ['help', 'commands', 'man ' + command.split(/\s+/)[0]];
}

function composePlanForObjective(objective, maxSteps) {
  const text = objective.toLowerCase();
  const steps = [];
  if (text.includes('post')) {
    steps.push('posts');
    steps.push('tags writing');
    steps.push(`ask summarize posts for: ${objective}`);
  } else if (text.includes('project')) {
    steps.push('projects');
    steps.push('timeline');
    steps.push(`explain project ${objective.replace(/^.*project\s+/i, '').trim() || 'moe-marketplace-aggregator'}`);
  } else if (text.includes('skill')) {
    steps.push('skills --applications');
    steps.push('skills --category');
    steps.push(`ask map skills to objective: ${objective}`);
  } else {
    steps.push('help');
    steps.push(`ask ${objective}`);
  }
  return steps.slice(0, maxSteps);
}
