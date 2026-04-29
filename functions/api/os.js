const MODEL = '@cf/meta/llama-3.1-8b-instruct';

const PROFILE_CONTEXT = `
Chris Pecunies is a Seattle-based Software Engineer specializing in cloud services, workflow automation, distributed systems, and full-stack cloud applications.

Summary:
- 4+ years of experience across AWS, Azure, GCP, and OCI.
- Focuses on workflow automation/orchestration tooling, CI/CD pipelines, and Infrastructure as Code with Ansible, Terraform, and Kubernetes.
- Proficient in Python, C++, Rust, Go, SQL, TypeScript, and full-stack application development.
- Has implemented distributed systems and databases and created technical training for AWS, Azure, GCP, and OCI.

Experience:
- DevOps Engineer, HashGraph, Remote / Seattle, September 2025-November 2025: managed multi-tier blockchain infrastructure across 8+ environments, implemented GitOps with ArgoCD, strengthened deployment integrity checks, optimized Grafana and PromQL alerting, and managed GCP lifecycle with Terraform and Ansible Vault.
- Software Engineer, WiseBlocks LLC, Hybrid / Golden CO, June 2022-April 2024: built a distributed transaction database in Go, integrated a Rust WebAssembly VM, engineered cloud networking with Ansible/Terraform/Prometheus/Grafana for 99.9% uptime, built Next.js visualization, FastAPI data services, gRPC, and Protocol Buffers.
- AWS Consultant, Impresys Software Corporation, Seattle, September 2019-May 2022: delivered AWS/Azure technical training, collaborated with AWS engineers on AWS CDK and IaC architecture automation, documented CI/CD and DevOps processes, and modernized legacy workflows to Python with Qt/QML and OpenCV, increasing production velocity over sevenfold.
- Research Assistant, University of Washington, Seattle, June 2018-April 2021: provisioned AWS/React/Django/FastAPI/PostgreSQL/Docker scientific apps, developed Python scientific simulations, and led data analysis/machine learning work on graphene-binding neuropeptide motifs.

Projects:
- Marketplace Aggregator on AWS, moe.pecunies.com, April 2026-present: serverless, message-oriented marketplace aggregation platform on AWS using Lambda, Step Functions, DynamoDB, SQS, API Gateway, CloudFront, and AWS CDK. It manages eventual consistency, rate limiting, external marketplace failure, transparent retry/state management, two-layer idempotency, and HMAC-SHA256 webhook verification.
- WebAssembly Runtime in Zig, github.com/clpi/wart.git, May 2025-present: performance-targeting WebAssembly runtime developed in Zig. Optimizes memory layout and instruction dispatch, targets state-of-the-art low-level benchmark performance, and fulfills nearly full WebAssembly 3.0 and WASI 1 preview specifications.

Education:
- University of Washington, B.S. Materials Science & Engineering, August 2015-June 2019. Coursework includes database systems, data structures and algorithms, artificial intelligence, and machine learning. Degree focus in Nanotechnology & Molecular Engineering.
`;

const PROJECTS = {
  'marketplace-aggregator': {
    aliases: ['moe', 'marketplace', 'marketplace-aggregator', 'moe-marketplace'],
    title: 'Marketplace Aggregator on AWS',
    body:
      'Marketplace Aggregator on AWS is a serverless, message-oriented marketplace aggregation platform at moe.pecunies.com. It uses Lambda, Step Functions, DynamoDB, SQS, API Gateway, CloudFront, and AWS CDK to handle eventual consistency, rate limiting, external marketplace failures, retries, idempotency, and secure webhook ingestion.',
  },
  'webassembly-runtime': {
    aliases: ['zig', 'wart', 'wasm', 'webassembly-runtime'],
    title: 'WebAssembly Runtime in Zig',
    body:
      'The WebAssembly Runtime in Zig is a performance-targeted runtime focused on low-level memory layout and instruction dispatch. It targets nearly full WebAssembly 3.0 and WASI 1 preview specification support and is available at github.com/clpi/wart.git.',
  },
};

const FILES = {
  '/resume/summary.txt':
    'Chris Pecunies is a Software Engineer with 4+ years across AWS, Azure, GCP, OCI, CI/CD, workflow automation, Infrastructure as Code, distributed systems, databases, and full-stack cloud applications.',
  '/resume/experience.txt':
    'HashGraph DevOps Engineer; WiseBlocks Software Engineer; Impresys AWS Consultant; University of Washington Research Assistant.',
  '/resume/skills.txt':
    'Python, Rust, Go, JavaScript/TypeScript, C/C++, SQL, Zig, Nix, C#/.NET, Dart/Flutter, Swift, Kotlin, Lua, PowerShell, Ruby, Django, FastAPI, Flask, React/Next.js, GraphQL, Node.js, SvelteKit, Vue/Nuxt, gRPC, Protocol Buffers, REST, AWS, Azure, GCP, OCI, Terraform, Ansible, Kubernetes, Docker, Grafana, Prometheus, PostgreSQL, Redis, MongoDB, Kafka, and Cloudflare Workers AI.',
  '/projects/marketplace-aggregator.txt': PROJECTS['marketplace-aggregator'].body,
  '/projects/webassembly-runtime.txt': PROJECTS['webassembly-runtime'].body,
  '/contact.txt':
    'Email: chris@pecunies.com\nGitHub: https://github.com/clpi\nLinkedIn: https://linkedin.com/in/chrispecunies\nWebsite: https://pecunies.com\nLocation: Seattle, WA',
  '/system/man.txt':
    'Portfolio OS commands: ls, cat, man, whoami, history, ps, top, ask, explain, curl, ping, weather, stock, 2048, clear, chat, exit.',
};

const DIRECTORIES = {
  '/': ['resume/', 'projects/', 'contact.txt', 'system/'],
  '/resume': ['summary.txt', 'experience.txt', 'skills.txt'],
  '/projects': ['marketplace-aggregator.txt', 'webassembly-runtime.txt'],
  '/system': ['man.txt'],
};

const MANUALS = {
  ask: 'ask <question>\nSend a question to Workers AI with command history and files you have read as context.',
  explain: 'explain <project>\nExplain a project. Projects: marketplace-aggregator, webassembly-runtime. Aliases include moe, marketplace, zig, wart, wasm.',
  ls: 'ls [path]\nList directories in the portfolio OS. Try ls /projects.',
  cat: 'cat <path>\nRead files from the portfolio OS. Try cat /resume/summary.txt.',
  man: 'man <command>\nShow command documentation.',
  whoami: 'whoami\nPrint the current portfolio identity.',
  history: 'history\nShow persisted command history stored in Cloudflare KV for this browser session.',
  ps: 'ps\nList pseudo-processes running in the terminal OS.',
  top: 'top\nShow pseudo live resource usage for the terminal OS.',
  curl: 'curl <url>\nFetch a URL from the Cloudflare edge and print status plus a short text preview.',
  ping: 'ping <host>\nApproximate network reachability with an HTTP request from Cloudflare Workers.',
  weather: 'weather [location]\nShow current weather using Open-Meteo. Defaults to Seattle, WA.',
  stock: 'stock <ticker>\nShow a compact quote using Stooq market data.',
  '2048': '2048\nBoot the local text-mode 2048 game. Use w/a/s/d to move, n for new, q to quit.',
};

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
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: jsonHeaders });
  }

  const sessionId = sanitizeSessionId(body?.sessionId);
  const command = String(body?.command ?? '').trim();
  const visibleContext = String(body?.visibleContext ?? '').slice(-6000);

  if (!command) {
    return Response.json({ error: 'Command is required.' }, { status: 400, headers: jsonHeaders });
  }

  const state = await readState(env, sessionId);
  appendHistory(state, command);

  if (body?.recordOnly) {
    await writeState(env, sessionId, state);
    return Response.json({ output: 'recorded' }, { headers: jsonHeaders });
  }

  const parsed = parseCommand(command);
  let result;

  try {
    result = await runCommand(parsed, state, env, visibleContext);
  } catch (error) {
    result = {
      output: error instanceof Error ? error.message : 'Command failed.',
      status: 500,
    };
  }

  await writeState(env, sessionId, state);
  return Response.json({ output: result.output, mode: result.mode }, { status: result.status ?? 200, headers: jsonHeaders });
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function runCommand(parsed, state, env, visibleContext) {
  switch (parsed.name) {
    case 'ls':
      return { output: listPath(parsed.rest || '/') };
    case 'cat':
      return catPath(parsed.rest, state);
    case 'man':
      return { output: MANUALS[parsed.args[0]] ?? 'No manual entry. Try man ask or cat /system/man.txt.' };
    case 'whoami':
      return { output: 'chris@pecunies: Software Engineer, Seattle, WA, U.S. Citizen' };
    case 'history':
      return { output: state.history.map((entry, index) => `${String(index + 1).padStart(3, ' ')}  ${entry.command}`).join('\n') || '(empty)' };
    case 'ps':
      return { output: psOutput() };
    case 'top':
      return { output: topOutput(state) };
    case 'ask':
      return askAi(parsed.rest, state, env, visibleContext);
    case 'explain':
      return explainProject(parsed.rest, state, env, visibleContext);
    case 'curl':
      return curlUrl(parsed.rest);
    case 'ping':
      return pingHost(parsed.rest || 'pecunies.com');
    case 'weather':
      return weather(parsed.rest || 'Seattle, WA');
    case 'stock':
      return stock(parsed.rest);
    default:
      return { output: `Unknown OS command "${parsed.name}". Try man ${parsed.name} or help.`, status: 404 };
  }
}

function parseCommand(command) {
  const normalized = command.replace(/^\//, '').replace(/^\.\//, '').trim();
  const [name = '', ...args] = normalized.split(/\s+/);
  return {
    name: name.toLowerCase(),
    args,
    rest: normalized.slice(name.length).trim(),
  };
}

function listPath(path) {
  const normalized = normalizePath(path);
  const entries = DIRECTORIES[normalized];

  if (!entries) {
    if (FILES[normalized]) {
      return normalized;
    }

    return `ls: ${path}: no such directory`;
  }

  return entries.join('\n');
}

function catPath(path, state) {
  if (!path) {
    return { output: 'Usage: cat <path>', status: 400 };
  }

  const normalized = normalizePath(path);
  const file = FILES[normalized];

  if (!file) {
    return { output: `cat: ${path}: no such file`, status: 404 };
  }

  if (!state.reads.includes(normalized)) {
    state.reads.push(normalized);
  }

  return { output: file };
}

async function askAi(question, state, env, visibleContext) {
  if (!question) {
    return { output: 'Usage: ask <question>', status: 400 };
  }

  if (!env.AI) {
    return { output: 'Workers AI binding is not configured.', status: 500 };
  }

  const answer = await runAi(env, question, state, visibleContext);
  return { output: answer };
}

async function explainProject(projectName, state, env, visibleContext) {
  if (!projectName) {
    return { output: 'Usage: explain <project>\nProjects: marketplace-aggregator, webassembly-runtime', status: 400 };
  }

  const normalized = projectName.toLowerCase();
  const project = Object.values(PROJECTS).find((entry) => entry.aliases.includes(normalized));

  if (!project) {
    return { output: `Unknown project "${projectName}". Try explain marketplace-aggregator or explain webassembly-runtime.`, status: 404 };
  }

  if (!env.AI) {
    return { output: project.body, mode: 'chat' };
  }

  const answer = await runAi(
    env,
    `Explain ${project.title} clearly. Include what it is, why it matters, architecture/implementation details, and what it says about Chris as an engineer.`,
    state,
    `${visibleContext}\n\nSelected project:\n${project.body}`,
  );

  return { output: answer, mode: 'chat' };
}

async function runAi(env, question, state, visibleContext) {
  const readContext = state.reads.map((path) => `${path}\n${FILES[path]}`).join('\n\n') || '(no files read yet)';
  const commandContext = state.history
    .slice(-20)
    .map((entry) => `${entry.at}: ${entry.command}`)
    .join('\n');

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content:
          'You are a concise terminal AI for Chris Pecunies portfolio. Use only the supplied profile, file, visible, and command-history context. If unknown, say so.',
      },
      {
        role: 'user',
        content: `Profile:\n${PROFILE_CONTEXT}\n\nFiles read by user:\n${readContext}\n\nRecent commands:\n${commandContext}\n\nVisible terminal context:\n${visibleContext}\n\nQuestion:\n${question}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  return typeof result?.response === 'string' ? result.response : 'No text response returned by Workers AI.';
}

async function curlUrl(rawUrl) {
  if (!rawUrl) {
    return { output: 'Usage: curl <url>', status: 400 };
  }

  const url = normalizeUrl(rawUrl);
  const started = Date.now();
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(6000),
    headers: {
      'User-Agent': 'pecunies-terminal/1.0',
    },
  });
  const elapsed = Date.now() - started;
  const contentType = response.headers.get('content-type') ?? 'unknown';
  const text = contentType.includes('text') || contentType.includes('json') || contentType.includes('html')
    ? await response.text()
    : '[binary response omitted]';

  return {
    output: `HTTP ${response.status} ${response.statusText}\ntime: ${elapsed}ms\ncontent-type: ${contentType}\n\n${text.slice(0, 1600)}`,
  };
}

async function pingHost(host) {
  const url = normalizeUrl(host);
  const started = Date.now();
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(5000),
  });

  return {
    output: `PING ${new URL(url).host}: HTTP ${response.status} in ${Date.now() - started}ms`,
  };
}

async function weather(location) {
  let geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`).then((res) => res.json());
  let place = geo?.results?.[0];

  if (!place && location.includes(',')) {
    const city = location.split(',')[0].trim();
    geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`).then((res) => res.json());
    place = geo?.results?.[0];
  }

  if (!place) {
    return { output: `weather: no location found for "${location}"`, status: 404 };
  }

  const current = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`,
  ).then((res) => res.json());
  const data = current.current;

  return {
    output: `${place.name}, ${place.admin1 ?? place.country}\ntemperature: ${data.temperature_2m} F\nhumidity: ${data.relative_humidity_2m}%\nwind: ${data.wind_speed_10m} mph\ncode: ${data.weather_code}`,
  };
}

async function stock(rawTicker) {
  const ticker = String(rawTicker || '').trim().toLowerCase();

  if (!ticker) {
    return { output: 'Usage: stock <ticker>', status: 400 };
  }

  const symbol = ticker.includes('.') ? ticker : `${ticker}.us`;
  const csv = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`).then((res) => res.text());
  const [header, row] = csv.trim().split('\n');
  const values = row?.split(',').map((value) => value.trim());
  const columns = header?.split(',').map((column) => column.trim()) ?? [];
  const quote = Object.fromEntries(columns.map((column, index) => [column, values?.[index] ?? 'N/D']));

  if (!row || quote.Close === 'N/D') {
    return { output: `stock: no quote found for "${rawTicker}"`, status: 404 };
  }

  return {
    output: `${quote.Symbol}\ndate: ${quote.Date} ${quote.Time}\nopen: ${quote.Open}\nhigh: ${quote.High}\nlow: ${quote.Low}\nclose: ${quote.Close}\nvolume: ${quote.Volume}`,
  };
}

function psOutput() {
  return [
    'PID   TTY      STAT  COMMAND',
    '1     tty0     Ss    portfolio-os',
    '7     tty0     S     vortex-particles',
    '12    tty0     S     command-registry',
    '31    edge     S     workers-ai-proxy',
    '48    edge     S     kv-history-writer',
  ].join('\n');
}

function topOutput(state) {
  return [
    'portfolio-os top - Cloudflare edge',
    `history entries: ${state.history.length}`,
    `files read: ${state.reads.length}`,
    'cpu: 2.4% user, 0.8% system, 96.8% idle',
    'mem: 42M used, ephemeral runtime',
    '',
    psOutput(),
  ].join('\n');
}

function normalizePath(path) {
  if (!path || path === '.') {
    return '/';
  }

  const prefixed = path.startsWith('/') ? path : `/${path}`;
  return prefixed.replace(/\/+$/, '') || '/';
}

function normalizeUrl(rawUrl) {
  return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
}

async function readState(env, sessionId) {
  if (!env.PORTFOLIO_OS) {
    return defaultState();
  }

  const state = (await env.PORTFOLIO_OS.get(`session:${sessionId}`, { type: 'json' })) ?? defaultState();
  return {
    history: Array.isArray(state.history) ? state.history : [],
    reads: Array.isArray(state.reads) ? state.reads : [],
  };
}

async function writeState(env, sessionId, state) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  await env.PORTFOLIO_OS.put(`session:${sessionId}`, JSON.stringify(state), { expirationTtl: 60 * 60 * 24 * 30 });
}

function defaultState() {
  return {
    history: [],
    reads: [],
  };
}

function appendHistory(state, command) {
  state.history.push({
    at: new Date().toISOString(),
    command,
  });

  if (state.history.length > 120) {
    state.history = state.history.slice(-120);
  }
}

function sanitizeSessionId(value) {
  const raw = String(value || 'anonymous');
  return raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 96) || 'anonymous';
}
