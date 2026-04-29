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
    aliases: ['moe', 'marketplace', 'marketplace-aggregator', 'moe-marketplace', 'market'],
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
  '/resume.txt':
    `Chris Pecunies — Software Engineer — Seattle, WA
chris@pecunies.com | (206) 321-6687 | github.com/clpi | linkedin.com/in/chrispecunies | pecunies.com
U.S. Citizen

SUMMARY
Software Engineer with 4+ years of experience specializing in cloud services (AWS, Azure, GCP, OCI), workflow automation, CI/CD pipelines, and Infrastructure as Code (Ansible, Terraform, Kubernetes). Proficient in Python, C++, Rust, Go, SQL, and TypeScript. Experienced in distributed systems, databases, and full-stack cloud applications.

EXPERIENCE
DevOps Engineer — HashGraph — Remote / Seattle, WA — Sep 2025 - Nov 2025
- Managed multi-tier blockchain infrastructure across 8+ environments with Grafana and ArgoCD
- Implemented GitOps with cryptographic integrity checks for deployment manifests
- Optimized production alerting with custom Grafana dashboards and PromQL queries
- Managed GCP infrastructure with Terraform modules and Ansible Vault

Software Engineer — WiseBlocks LLC — Hybrid / Golden, CO — Jun 2022 - Apr 2024
- Developed distributed transaction database in Go with Rust WebAssembly VM integration
- Engineered cloud architecture with Ansible, Terraform, Prometheus, Grafana (99.9% uptime)
- Built Next.js front end for real-time node/block visualization with FastAPI backend
- Architected gRPC + Protocol Buffers services for secure data exchange

AWS Consultant — Impresys Software Corporation — Seattle, WA — Sep 2019 - May 2022
- Developed technical training material for Azure and AWS cloud architecture
- Collaborated with AWS engineers to implement AWS CDK infrastructure automation
- Modernized legacy workflows to Python with Qt/QML GUI and OpenCV (7x velocity increase)

Research Assistant — University of Washington — Seattle, WA — Jun 2018 - Apr 2021
- Provisioned full-stack containerized apps with AWS, React, Django, FastAPI, PostgreSQL, Docker
- Developed scientific simulations and data analysis with Python
- Led undergraduate team on ML-driven neuropeptide binding motif analysis

EDUCATION
University of Washington — B.S. Materials Science & Engineering — Aug 2015 - Jun 2019
Focus: Nanotechnology & Molecular Engineering | Dean's List (2x)

SKILLS
Languages: Python, Rust, Go, JavaScript/TypeScript, C/C++, SQL, Zig, Nix, Lua, Bash
Web: React/Next.js, FastAPI, Django, Flask, Node.js, gRPC, GraphQL, SvelteKit
Cloud: AWS, Azure, GCP, OCI, Terraform, Ansible, Kubernetes, Docker, GitHub Actions
Databases: PostgreSQL, Redis, MongoDB, MySQL, Cassandra, Kafka
AI: GitHub Copilot, Claude Code, LangChain, Cloudflare Workers AI, Anthropic/OpenAI APIs`,
  '/projects.txt':
    `Chris Pecunies — Projects

Marketplace Aggregator on AWS — moe.pecunies.com — Apr 2026 - Present
A serverless, message-oriented marketplace aggregation platform on AWS.
Stack: Lambda, Step Functions, DynamoDB, SQS, API Gateway, CloudFront, AWS CDK
- Manages eventual consistency, rate limiting, and external marketplace failures
- Engineered resilient workflows with Step Functions for transparent retry/state management
- Two-layer idempotency strategy to prevent duplicate listings
- HMAC-SHA256 verification for secure webhook ingestion, preventing timing attacks

WebAssembly Runtime in Zig — github.com/clpi/wart.git — May 2025 - Present
A performance-targeting WebAssembly runtime developed in Zig.
- Achieved state-of-the-art performance in low-level benchmarks
- Optimized memory layout and instruction dispatch logic
- Fulfills nearly full WebAssembly 3.0 and WASI 1 preview specifications`,
  '/resume/summary.txt':
    'Chris Pecunies is a Software Engineer with 4+ years across AWS, Azure, GCP, OCI, CI/CD, workflow automation, Infrastructure as Code, distributed systems, databases, and full-stack cloud applications.',
  '/resume/experience.txt':
    'HashGraph DevOps Engineer; WiseBlocks Software Engineer; Impresys AWS Consultant; University of Washington Research Assistant.',
  '/resume/skills.txt':
    'Python, Rust, Go, JavaScript/TypeScript, C/C++, SQL, Zig, Nix, C#/.NET, Dart/Flutter, Swift, Kotlin, Lua, PowerShell, Ruby, Django, FastAPI, Flask, React/Next.js, GraphQL, Node.js, SvelteKit, Vue/Nuxt, gRPC, Protocol Buffers, REST, AWS, Azure, GCP, OCI, Terraform, Ansible, Kubernetes, Docker, Grafana, Prometheus, PostgreSQL, Redis, MongoDB, Kafka, and Cloudflare Workers AI.',
  '/projects/marketplace-aggregator.txt': PROJECTS['marketplace-aggregator'].body,
  '/projects/webassembly-runtime.txt': PROJECTS['webassembly-runtime'].body,
  '/contact.txt':
    'Email: chris@pecunies.com\nPhone: (206) 321-6687\nGitHub: https://github.com/clpi\nLinkedIn: https://linkedin.com/in/chrispecunies\nWebsite: https://pecunies.com\nAddress: 818 West Crockett St\nLocation: Seattle, WA 98119\nAuthorization: U.S. Citizen',
  '/system/man.txt':
    'Portfolio OS commands: ls, cat, man, whoami, history, ps, top, ask, explain, trace, curl, ping, weather, stock, commands, email, metrics, 2048, clear, chat, exit.',
};

const DIRECTORIES = {
  '/': ['resume.txt', 'projects.txt', 'resume/', 'projects/', 'contact.txt', 'system/'],
  '/resume': ['summary.txt', 'experience.txt', 'skills.txt'],
  '/projects': ['marketplace-aggregator.txt', 'webassembly-runtime.txt'],
  '/system': ['man.txt'],
};

const MANUALS = {
  ask: 'ask <question>\nSend a question to Workers AI with command history and files you have read as context. Response rendered in markdown.',
  explain: 'explain <project|skill|work|education>\nExplain a topic using Workers AI.\n  explain project <market|pi|wasm> — deep dive into a specific project\n  explain skill — overview of technical skills\n  explain work — walk through work experience\n  explain education — education background',
  ls: 'ls [path]\nList directories in the portfolio OS. Try ls /projects.',
  cat: 'cat <path>\nRead files from the portfolio OS. Try cat /resume.txt.',
  man: 'man <command>\nShow command documentation.',
  whoami: 'whoami\nPrint the current portfolio identity plus your IP, geolocation, and browser.',
  history: 'history\nShow persisted command history stored in Cloudflare KV for this browser session.',
  ps: 'ps\nList pseudo-processes running in the terminal OS.',
  top: 'top\nShow pseudo live resource usage for the terminal OS.',
  curl: 'curl <url>\nFetch a URL from the Cloudflare edge and print status plus a short text preview.',
  ping: 'ping <host>\nApproximate network reachability with an HTTP request from Cloudflare Workers.',
  weather: 'weather [location]\nShow current weather using Open-Meteo. Defaults to Seattle, WA.',
  stock: 'stock <ticker>\nShow a compact quote using Stooq market data.',
  trace: 'trace <website>\nPerform a traceroute-style HTTP probe to a website from the Cloudflare edge.',
  commands: 'commands\nList all available terminal commands.',
  email: 'email [to] [subject] [message]\nSend an email to chris@pecunies.com. If called without arguments, you will be prompted for input.',
  metrics: 'metrics\nShow site visit analytics, page breakdowns, command usage, and geographic distribution.',
  '2048': '2048\nBoot the local text-mode 2048 game. Use w/a/s/d to move, n for new, q to quit.',
};

const ALL_COMMANDS = [
  { name: 'resume', usage: 'resume', description: 'Load the resume-backed landing view.' },
  { name: 'experience', usage: 'experience', description: 'Show the work timeline.' },
  { name: 'skills', usage: 'skills', description: 'List skill groups.' },
  { name: 'projects', usage: 'projects', description: 'Open the project panel.' },
  { name: 'education', usage: 'education', description: 'Show education background.' },
  { name: 'contact', usage: 'contact', description: 'Open contact channels.' },
  { name: 'pdf', usage: 'pdf', description: 'Embed the resume PDF.' },
  { name: 'help', usage: 'help', description: 'Show command registry.' },
  { name: 'chat', usage: 'chat', description: 'Enter AI chat mode.' },
  { name: 'ask', usage: 'ask <question>', description: 'Ask Workers AI a question.' },
  { name: 'explain', usage: 'explain <project|skill|work|education>', description: 'Explain a topic with AI.' },
  { name: 'ls', usage: 'ls [path]', description: 'List files.' },
  { name: 'cat', usage: 'cat <path>', description: 'Read a file.' },
  { name: 'man', usage: 'man <command>', description: 'Show command docs.' },
  { name: 'whoami', usage: 'whoami', description: 'Print identity + visitor info.' },
  { name: 'history', usage: 'history', description: 'Show command history.' },
  { name: 'ps', usage: 'ps', description: 'List pseudo processes.' },
  { name: 'top', usage: 'top', description: 'Show resource usage.' },
  { name: 'trace', usage: 'trace <website>', description: 'HTTP traceroute to a site.' },
  { name: 'curl', usage: 'curl <url>', description: 'Fetch a URL.' },
  { name: 'ping', usage: 'ping <host>', description: 'Measure HTTP reachability.' },
  { name: 'weather', usage: 'weather [location]', description: 'Show current weather.' },
  { name: 'stock', usage: 'stock <ticker>', description: 'Show a market quote.' },
  { name: 'commands', usage: 'commands', description: 'List all commands.' },
  { name: 'email', usage: 'email [to] [subject] [message]', description: 'Send an email to Chris.' },
  { name: 'metrics', usage: 'metrics', description: 'Show site analytics.' },
  { name: 'themes', usage: 'themes', description: 'Preview shell palettes.' },
  { name: 'theme', usage: 'theme <amber|frost|ivory|auto>', description: 'Pin a palette.' },
  { name: '2048', usage: '2048', description: 'Play 2048 in the terminal.' },
  { name: 'clear', usage: 'clear', description: 'Clear the terminal.' },
  { name: 'exit', usage: 'exit', description: 'Exit chat mode.' },
];

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
    await recordPageView(env, request, command);
    await writeState(env, sessionId, state);
    return Response.json({ output: 'recorded' }, { headers: jsonHeaders });
  }

  const parsed = parseCommand(command);
  let result;

  try {
    result = await runCommand(parsed, state, env, visibleContext, request);
  } catch (error) {
    result = {
      output: error instanceof Error ? error.message : 'Command failed.',
      status: 500,
    };
  }

  await writeState(env, sessionId, state);
  return Response.json(
    { output: result.output, mode: result.mode, markdown: result.markdown },
    { status: result.status ?? 200, headers: jsonHeaders },
  );
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function runCommand(parsed, state, env, visibleContext, request) {
  switch (parsed.name) {
    case 'ls':
      return { output: listPath(parsed.rest || '/') };
    case 'cat':
      return catPath(parsed.rest, state);
    case 'man':
      return { output: MANUALS[parsed.args[0]] ?? 'No manual entry. Try man ask or cat /system/man.txt.' };
    case 'whoami':
      return { output: whoamiOutput(request) };
    case 'history':
      return { output: state.history.map((entry, index) => `${String(index + 1).padStart(3, ' ')}  ${entry.command}`).join('\n') || '(empty)' };
    case 'ps':
      return { output: psOutput() };
    case 'top':
      return { output: topOutput(state) };
    case 'ask':
      return askAi(parsed.rest, state, env, visibleContext);
    case 'explain':
      return explainTopic(parsed.args, state, env, visibleContext);
    case 'trace':
      return traceWebsite(parsed.rest);
    case 'curl':
      return curlUrl(parsed.rest);
    case 'ping':
      return pingHost(parsed.rest || 'pecunies.com');
    case 'weather':
      return weather(parsed.rest || 'Seattle, WA');
    case 'stock':
      return stock(parsed.rest);
    case 'commands':
      return { output: commandsList() };
    case 'email':
      return emailCommand(parsed.args, env);
    case 'metrics':
      return metricsCommand(env);
    default:
      return { output: `Unknown OS command "${parsed.name}". Try commands for a full list.`, status: 404 };
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

function whoamiOutput(request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const country = request.cf?.country || 'unknown';
  const city = request.cf?.city || 'unknown';
  const region = request.cf?.region || '';
  const colo = request.cf?.colo || 'unknown';
  const asn = request.cf?.asn || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const tlsVersion = request.cf?.tlsVersion || 'unknown';

  return [
    'chris@pecunies: Software Engineer, Seattle, WA, U.S. Citizen',
    '',
    '— Visitor info —',
    `IP: ${ip}`,
    `Location: ${city}${region ? `, ${region}` : ''}, ${country}`,
    `Cloudflare colo: ${colo}`,
    `ASN: ${asn}`,
    `TLS: ${tlsVersion}`,
    `User-Agent: ${ua}`,
  ].join('\n');
}

async function askAi(question, state, env, visibleContext) {
  if (!question) {
    return { output: 'Usage: ask <question>', status: 400 };
  }

  if (!env.AI) {
    return { output: 'Workers AI binding is not configured.', status: 500 };
  }

  const answer = await runAi(env, question, state, visibleContext);
  return { output: answer, markdown: true };
}

const EXPLAIN_TOPICS = {
  project: true,
  skill: true,
  work: true,
  education: true,
};

const PROJECT_ALIASES = {
  market: 'marketplace-aggregator',
  marketplace: 'marketplace-aggregator',
  moe: 'marketplace-aggregator',
  pi: 'raspberry-pi',
  wasm: 'webassembly-runtime',
  zig: 'webassembly-runtime',
  wart: 'webassembly-runtime',
};

async function explainTopic(args, state, env, visibleContext) {
  const topic = (args[0] || '').toLowerCase();

  if (!topic) {
    return { output: 'Usage: explain <project|skill|work|education>\n  explain project <market|pi|wasm>', status: 400 };
  }

  if (!EXPLAIN_TOPICS[topic]) {
    const project = Object.values(PROJECTS).find((entry) => entry.aliases.includes(topic));
    if (project) {
      return explainProjectDirect(project, state, env, visibleContext);
    }
    return { output: `Unknown topic "${topic}". Try: explain project, explain skill, explain work, explain education.`, status: 404 };
  }

  if (topic === 'project') {
    const projectKey = (args[1] || '').toLowerCase();
    if (!projectKey) {
      return { output: 'Usage: explain project <market|pi|wasm>', status: 400 };
    }
    const resolvedSlug = PROJECT_ALIASES[projectKey] || projectKey;
    const project = PROJECTS[resolvedSlug] || Object.values(PROJECTS).find((e) => e.aliases.includes(projectKey));

    if (projectKey === 'pi') {
      if (!env.AI) {
        return { output: 'The Raspberry Pi cluster project is a hardware-constrained infrastructure experiment.', mode: 'chat', markdown: true };
      }
      const answer = await runAi(
        env,
        'Explain what a Raspberry Pi cluster infrastructure project involves in the context of a DevOps/cloud engineer portfolio. Chris is interested in edge computing, Kubernetes on ARM, and infrastructure automation on constrained hardware. Format your response in markdown.',
        state,
        visibleContext,
      );
      return { output: answer, mode: 'chat', markdown: true };
    }

    if (!project) {
      return { output: `Unknown project "${projectKey}". Available: market, pi, wasm.`, status: 404 };
    }
    return explainProjectDirect(project, state, env, visibleContext);
  }

  if (!env.AI) {
    return { output: `Explanation for "${topic}" requires Workers AI.`, status: 500 };
  }

  const prompts = {
    skill: 'Explain Chris Pecunies\' technical skill set comprehensively. Cover his language proficiency, cloud platform expertise, web technology stack, database experience, and AI tooling. Use the provided profile context. Format your response in markdown with headers and bullet points.',
    work: 'Walk through Chris Pecunies\' work experience chronologically, explaining each role, key accomplishments, and how they build on each other. Use the provided profile context. Format your response in markdown.',
    education: 'Explain Chris Pecunies\' educational background, how his Materials Science degree connects to his software engineering career, and the research work at GEMSEC. Use the provided profile context. Format your response in markdown.',
  };

  const answer = await runAi(env, prompts[topic], state, visibleContext);
  return { output: answer, mode: 'chat', markdown: true };
}

async function explainProjectDirect(project, state, env, visibleContext) {
  if (!env.AI) {
    return { output: project.body, mode: 'chat', markdown: true };
  }

  const answer = await runAi(
    env,
    `Explain ${project.title} clearly. Include what it is, why it matters, architecture/implementation details, and what it says about Chris as an engineer. Format your response in markdown with headers, bullet points, and code blocks where appropriate.`,
    state,
    `${visibleContext}\n\nSelected project:\n${project.body}`,
  );

  return { output: answer, mode: 'chat', markdown: true };
}

async function traceWebsite(rawUrl) {
  if (!rawUrl) {
    return { output: 'Usage: trace <website>', status: 400 };
  }

  const url = normalizeUrl(rawUrl);
  const hops = [];
  const maxHops = 5;
  let currentUrl = url;

  for (let i = 0; i < maxHops; i++) {
    const started = Date.now();
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      const elapsed = Date.now() - started;
      const server = response.headers.get('server') || 'unknown';
      const location = response.headers.get('location');

      hops.push(`${i + 1}  ${new URL(currentUrl).host}  HTTP ${response.status}  ${elapsed}ms  server: ${server}`);

      if (location && response.status >= 300 && response.status < 400) {
        currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
      } else {
        break;
      }
    } catch {
      hops.push(`${i + 1}  ${new URL(currentUrl).host}  timeout/error`);
      break;
    }
  }

  return { output: `TRACE ${rawUrl}\n${hops.join('\n')}` };
}

function commandsList() {
  const maxName = Math.max(...ALL_COMMANDS.map((c) => c.usage.length));
  return ALL_COMMANDS.map(
    (c) => `  ${c.usage.padEnd(maxName + 2)}${c.description}`,
  ).join('\n');
}

async function emailCommand(args, env) {
  if (args.length < 3) {
    return {
      output: 'Usage: email <your-email> <subject> <message>\n\nExample: email user@example.com "Hello" "I\'d like to discuss a project."',
      status: 400,
    };
  }

  const [senderEmail, ...rest] = args;
  const fullRest = rest.join(' ');
  const subjectMatch = fullRest.match(/^"([^"]+)"\s+"([^"]+)"$/) || fullRest.match(/^(\S+)\s+(.+)$/);
  const subject = subjectMatch?.[1] || 'Contact from terminal';
  const message = subjectMatch?.[2] || fullRest;

  if (!env.PORTFOLIO_OS) {
    return { output: 'Email service not configured.', status: 500 };
  }

  try {
    await env.PORTFOLIO_OS.put(
      `email:${Date.now()}`,
      JSON.stringify({
        from: senderEmail,
        subject,
        message,
        at: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 60 * 24 * 90 },
    );

    return { output: `Message queued for chris@pecunies.com.\nFrom: ${senderEmail}\nSubject: ${subject}\nMessage: ${message.slice(0, 200)}` };
  } catch {
    return { output: 'Failed to queue email. Please try again.', status: 500 };
  }
}

async function metricsCommand(env) {
  if (!env.PORTFOLIO_OS) {
    return { output: 'Analytics storage not configured.', status: 500 };
  }

  try {
    const metricsRaw = await env.PORTFOLIO_OS.get('site:metrics', { type: 'json' });
    const metrics = metricsRaw || { totalVisits: 0, pages: {}, commands: {}, geo: {} };

    const pageLines = Object.entries(metrics.pages || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([page, count]) => `  ${String(count).padStart(6)}  ${page}`)
      .join('\n') || '  (no data)';

    const commandLines = Object.entries(metrics.commands || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([cmd, count]) => `  ${String(count).padStart(6)}  ${cmd}`)
      .join('\n') || '  (no data)';

    const geoLines = Object.entries(metrics.geo || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([loc, count]) => `  ${String(count).padStart(6)}  ${loc}`)
      .join('\n') || '  (no data)';

    return {
      output: [
        `Total site visits: ${metrics.totalVisits || 0}`,
        '',
        'Page breakdown:',
        pageLines,
        '',
        'Top commands:',
        commandLines,
        '',
        'Geographic distribution:',
        geoLines,
      ].join('\n'),
    };
  } catch {
    return { output: 'Failed to retrieve metrics.', status: 500 };
  }
}

async function recordPageView(env, request, command) {
  if (!env.PORTFOLIO_OS) return;

  try {
    const metricsRaw = await env.PORTFOLIO_OS.get('site:metrics', { type: 'json' });
    const metrics = metricsRaw || { totalVisits: 0, pages: {}, commands: {}, geo: {} };

    metrics.totalVisits = (metrics.totalVisits || 0) + 1;

    const parsed = parseCommand(command);
    const cmdName = parsed.name || 'unknown';
    metrics.commands = metrics.commands || {};
    metrics.commands[cmdName] = (metrics.commands[cmdName] || 0) + 1;

    const page = parsed.name;
    if (['resume', 'experience', 'skills', 'projects', 'education', 'contact', 'pdf', 'chat', 'help', 'themes'].includes(page)) {
      metrics.pages = metrics.pages || {};
      metrics.pages[page] = (metrics.pages[page] || 0) + 1;
    }

    const country = request.cf?.country || 'unknown';
    const city = request.cf?.city || '';
    const geoKey = city ? `${city}, ${country}` : country;
    metrics.geo = metrics.geo || {};
    metrics.geo[geoKey] = (metrics.geo[geoKey] || 0) + 1;

    await env.PORTFOLIO_OS.put('site:metrics', JSON.stringify(metrics), { expirationTtl: 60 * 60 * 24 * 365 });
  } catch {
    // best effort
  }
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
          'You are a concise terminal AI for Chris Pecunies portfolio. Use only the supplied profile, file, visible, and command-history context. If unknown, say so. Format your responses in clean markdown using headers (##), bullet points (-), bold (**text**), and code blocks (```) where appropriate.',
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
    '55    edge     S     metrics-collector',
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
