import { appendAiLog } from './ai-log.js';

const MODEL = '@cf/meta/llama-3.1-8b-instruct';
const ALLOWED_MODELS = new Set([
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/qwen/qwen1.5-14b-chat-awq',
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

  if (!message) {
    return Response.json({ error: 'Message is required.' }, { status: 400, headers: jsonHeaders });
  }

  if (message.length > 1600) {
    return Response.json(
      { error: 'Message is too long for this terminal chat.' },
      { status: 413, headers: jsonHeaders },
    );
  }

  const history = Array.isArray(body?.history)
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
  const persistedHistory = state.history
    .slice(-16)
    .map((entry) => `${entry.at}: ${entry.command}`)
    .join('\n');
  const ragContext = Array.isArray(state.ragContext)
    ? state.ragContext.slice(-20).map((entry) => `${entry.at}: ${entry.text}`).join('\n')
    : '';

  const sessionState = JSON.stringify({
    config: state.config ?? {},
    cwd: state.cwd,
    reads: state.reads ?? [],
  }).slice(0, 2400);

  const userContent = `Portfolio context:\n${PROFILE_CONTEXT}\n\nPersistent session/app state:\n${sessionState}\n\nPersistent RAG/session context notes:\n${ragContext || '(none)'}\n\nMetrics state:\n${JSON.stringify(metrics).slice(0, 3000)}\n\nLeaderboard state:\n${JSON.stringify(leaderboard).slice(0, 2000)}\n\nPersisted terminal history:\n${persistedHistory || '(empty)'}\n\nQuestion: ${message}`;
  const contextExcerpt = `chat_history_json:\n${JSON.stringify(history).slice(0, 3500)}\n\n---\n${userContent}`;

  let result;

  try {
    result = await env.AI.run(activeModel, {
      messages: [
        {
          role: 'system',
          content:
            `You are the AI help mode for Chris Pecunies terminal portfolio. Answer only from the provided context. Be concise and factual.${systemPrompt ? `\n\nSession system prompt injection:\n${systemPrompt}` : ''}`,
        },
        ...history,
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

  await appendAiLog(env, {
    source: 'chat',
    sessionId,
    model: activeModel,
    query: message,
    contextExcerpt,
    response: answer,
  });

  state.history.push({ at: new Date().toISOString(), command: `chat: ${message}` });
  state.history = state.history.slice(-120);
  await writeState(env, sessionId, state);

  return Response.json({ answer, model: activeModel }, { headers: jsonHeaders });
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function readState(env, sessionId) {
  if (!env.PORTFOLIO_OS) {
    return { history: [] };
  }

  const state = (await env.PORTFOLIO_OS.get(`session:${sessionId}`, { type: 'json' })) ?? { history: [], reads: [] };
  return {
    ...state,
    history: Array.isArray(state.history) ? state.history : [],
    reads: Array.isArray(state.reads) ? state.reads : [],
    ragContext: Array.isArray(state.ragContext) ? state.ragContext : [],
  };
}

async function writeState(env, sessionId, state) {
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
