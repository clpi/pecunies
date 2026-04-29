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
- Raspberry Pi Infrastructure Cluster, 2024-present: home-lab Linux infrastructure for Kubernetes, GitOps, monitoring, and resource-constrained deployment experiments.
- down.nvim, github.com/clpi/down.nvim.git, 2026-present: Neovim 0.12+ markdown note-taking plugin with planned LSP and AI-assisted workflow integration.

Education:
- University of Washington, B.S. Materials Science & Engineering, August 2015-June 2019. Coursework includes database systems, data structures and algorithms, artificial intelligence, and machine learning. Degree focus in Nanotechnology & Molecular Engineering.
`;

const PROJECTS = {
  'marketplace-aggregator': {
    aliases: ['market', 'moe', 'marketplace', 'marketplace-aggregator', 'moe-marketplace'],
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
  'pi-cluster': {
    aliases: ['pi', 'raspberry-pi', 'cluster', 'pi-cluster'],
    title: 'Raspberry Pi Infrastructure Cluster',
    body:
      'The Raspberry Pi Infrastructure Cluster is a hardware-constrained home lab for orchestration, observability, and deployment experiments. It is used to test Linux services, Kubernetes, GitOps, monitoring, and infrastructure patterns outside managed cloud defaults.',
  },
  'down-nvim': {
    aliases: ['down', 'down.nvim', 'notes', 'markdown'],
    title: 'down.nvim',
    body:
      'down.nvim is a Neovim 0.12+ plugin for markdown note-taking with planned LSP and AI integration. It focuses on terminal-native capture, navigation, backlinks, structured markdown operations, and future AI-assisted workflows.',
  },
};

const FILES = {
  '/README.md':
    '# Pecunies Terminal\n\nThis site is a one-page terminal emulator portfolio for Chris Pecunies. It renders resume, projects, timeline, links, posts, PDF, AI chat, fake OS files, games, and network commands as terminal output. Static commands are registered in the frontend command registry; stateful commands run through Cloudflare Pages Functions backed by Workers AI and KV.\n\nDesign notes: glass terminal window, dark particle vortex, theme-driven red/amber/frost/ivory accents, autocomplete with man-page help, command history, and content rendered below the command that produced it.',
  '/TODO.md':
    '# TODO\n\n- Add real long-form posts and richer RSS entries.\n- Add validated chess rules and checkmate detection.\n- Expand the fake /internet browser with more sites and back/forward navigation.\n- Add richer Cloudflare Email Routing integration for /book.\n- Add authenticated private metrics export.\n- Add richer markdown rendering for OS files.\n- Expand down.nvim project notes as the plugin evolves.',
  '/resume/resume.md':
    '# Chris Pecunies\n\nSoftware Engineer in Seattle, WA.\n\n## Summary\n\nSoftware Engineer with 4+ years across AWS, Azure, GCP, OCI, workflow automation, CI/CD, Infrastructure as Code, distributed systems, databases, and full-stack cloud applications.\n\n## Experience\n\n- **HashGraph, DevOps Engineer** - September 2025 to November 2025. Blockchain infrastructure, GitOps, ArgoCD, Grafana, PromQL, GCP, Terraform, and Ansible Vault.\n- **WiseBlocks LLC, Software Engineer** - June 2022 to April 2024. Distributed transaction database in Go, Rust WebAssembly VM, Next.js, FastAPI, gRPC, Protocol Buffers, Terraform, Ansible, Prometheus, and Grafana.\n- **Impresys Software Corporation, AWS Consultant** - September 2019 to May 2022. AWS/Azure training, AWS CDK, IaC automation, CI/CD material, and Python/Qt modernization.\n- **University of Washington, Research Assistant** - June 2018 to April 2021. AWS, React, Django, FastAPI, PostgreSQL, Docker, scientific simulations, and ML-driven analysis.\n\n## Education\n\nUniversity of Washington, B.S. Materials Science & Engineering, August 2015 - June 2019.',
  '/resume/skills.md':
    '# Skills\n\n## Languages\n\nPython, Rust, Go, JavaScript / TypeScript, C / C++, SQL, Java / Groovy, Bash / Fish / Zsh, Zig, Nix, C# / .NET, Dart / Flutter, Swift, Kotlin, Lua, PowerShell, Ruby.\n\n## Web and APIs\n\nDjango, FastAPI, Flask, React / Next.js, GraphQL, Node.js, Bun, Spring Boot, Svelte / SvelteKit, Vue.js / Nuxt.js, gRPC, Protocol Buffers, RESTful APIs, Ruby on Rails.\n\n## Cloud and Infrastructure\n\nAWS, AWS CDK, Microsoft Azure, GCP, OCI, Ansible, Terraform, Kubernetes, Docker / Podman, GitHub Actions, Azure DevOps, Jenkins, Grafana, Prometheus.\n\n## Databases\n\nPostgreSQL, MySQL, Cassandra, Kafka, MongoDB, Redis, Memcached, NoSQL, MariaDB.\n\n## Applications\n\nCloud architecture, workflow automation, distributed systems, CI/CD, observability, WebAssembly runtimes, full-stack cloud applications, and terminal-native tools.',
  '/resume/projects.md':
    '# Projects\n\n## Marketplace Aggregator on AWS\n\nServerless marketplace aggregation platform at https://moe.pecunies.com using Lambda, Step Functions, DynamoDB, SQS, API Gateway, CloudFront, and AWS CDK.\n\n## WebAssembly Runtime in Zig\n\nPerformance-targeted WebAssembly runtime at https://github.com/clpi/wart.git focused on memory layout, instruction dispatch, WebAssembly 3.0, and WASI preview support.\n\n## Raspberry Pi Infrastructure Cluster\n\nHome-lab Linux cluster for orchestration, observability, Kubernetes/GitOps experiments, and resource-constrained deployment patterns.\n\n## down.nvim\n\nNeovim 0.12+ markdown note-taking plugin at https://github.com/clpi/down.nvim.git with planned LSP and AI integration.',
  '/projects/marketplace-aggregator.md': `# ${PROJECTS['marketplace-aggregator'].title}\n\n${PROJECTS['marketplace-aggregator'].body}`,
  '/projects/webassembly-runtime.md': `# ${PROJECTS['webassembly-runtime'].title}\n\n${PROJECTS['webassembly-runtime'].body}`,
  '/projects/pi-cluster.md': `# ${PROJECTS['pi-cluster'].title}\n\n${PROJECTS['pi-cluster'].body}`,
  '/projects/down-nvim.md': `# ${PROJECTS['down-nvim'].title}\n\n${PROJECTS['down-nvim'].body}`,
  '/contact.md':
    '# Contact\n\n- Email: chris@pecunies.com\n- GitHub: https://github.com/clpi\n- GitLab: https://gitlab.com/clpi\n- SourceHut: https://sr.ht/~clp/\n- LinkedIn: https://linkedin.com/in/chrispecunies\n- Website: https://pecunies.com\n- Short website: https://clp.is\n- Ko-fi: https://ko-fi.com/clp\n- X: https://x.com/clpif\n- Patreon: https://patreon.com/pecunies\n- Open Collective: https://opencollective.com/clp\n- Cal.com: https://cal.com/chrisp\n- Calendly: https://calendly.com/pecunies\n- Buy Me a Coffee: https://buymeacoffee.com/pecunies\n- Instagram: https://www.instagram.com/chris.pecunies/\n- Facebook: https://www.facebook.com/chris.pecunies/\n- Location: Seattle, WA',
  '/posts/terminal-portfolio-changelog.md':
    '# Terminal Portfolio Changelog\n\nInitial post placeholder for the terminal-native writing system. Posts are markdown files under `/posts`; creating, editing, or removing them requires sudo privileges.',
  '/system/man.txt':
    'Portfolio OS commands: ls, cat, man, whoami, history, ps, top, pwd, echo, cp, tree, find, grep, touch, rm, date, ask, explain, curl, ping, trace, weather, stock, metrics, leaderboard, internet, fzf, email, book, comment, sudo, su, 2048, clear, chat, exit, download, theme, maximize, minimize, shutdown.',
};

const DIRECTORIES = {
  '/': ['README.md', 'TODO.md', 'app/', 'guest/', 'home/', 'posts/', 'resume/', 'projects/', 'contact.md', 'system/'],
  '/app': [],
  '/guest': [],
  '/home': [],
  '/posts': ['terminal-portfolio-changelog.md'],
  '/resume': ['resume.md', 'skills.md', 'projects.md'],
  '/projects': ['marketplace-aggregator.md', 'webassembly-runtime.md', 'pi-cluster.md', 'down-nvim.md'],
  '/system': ['man.txt'],
};

const MANUALS = {
  ask: 'ask <question>\nSend a question to Workers AI with full app context, command history, metrics, leaderboard state, and files you have read as context. If no argument is supplied, the frontend asks for the prompt string.',
  explain: 'explain <project|skill|work|education|command> [name]\nExplain portfolio entities or terminal commands with Workers AI. Project shortcuts: market, pi, wasm, down.',
  email: 'email <your email> <subject> <message>\nCreate a structured email draft to Chris. Example: email me@example.com Hello "Interested in your work".',
  book: 'book <your email> <date> <time> <duration> <message>\nRequest a meeting. The worker records the request and attempts a transactional email notification.',
  ls: 'ls [path]\nList directories in the portfolio OS. Try ls /projects.',
  cat: 'cat <path>\nRead files from the portfolio OS. Try cat /README.md or cat /resume/summary.txt.',
  man: 'man <command>\nShow command documentation.',
  whoami: 'whoami\nPrint the current portfolio identity.',
  history: 'history\nShow persisted command history stored in Cloudflare KV for this browser session.',
  ps: 'ps\nList pseudo-processes running in the terminal OS.',
  top: 'top\nShow pseudo live resource usage for the terminal OS.',
  pwd: 'pwd\nPrint the current working directory.',
  echo: 'echo <text>\nPrint arguments back to the terminal.',
  cp: 'cp <text>\nCopy text to the browser clipboard; the worker echoes the copied value.',
  tree: 'tree [path]\nPrint a tree view of the portfolio OS.',
  find: 'find <query>\nFind files or directories by substring.',
  grep: 'grep <query>\nSearch readable OS files for text.',
  touch: 'touch <path>\nCreate an empty writable file. Static portfolio files are immutable. Creating files in /home and /guest is allowed; protected paths require sudo.',
  rm: 'rm <path>\nRemove a writable file. Static portfolio files are immutable. Removing files under /posts, /resume, /projects, /system, or root requires sudo.',
  sudo: 'sudo <command>\nAsk for the root password, then run one command with elevated privileges. Inline form also works: sudo <password> <command>.',
  su: 'su\nAsk for the root password and grant a short-lived root session for protected filesystem operations.',
  comment: 'comment <post> <name> <message>\nAdd a viewer comment to a markdown post. Example: comment terminal-portfolio-changelog alice nice post.',
  date: 'date\nPrint current Cloudflare edge time.',
  curl: 'curl <url>\nFetch a URL from the Cloudflare edge and print status plus a short text preview.',
  ping: 'ping <host>\nApproximate network reachability with an HTTP request from Cloudflare Workers.',
  trace: 'trace <website>\nShow a stylized network trace from browser to Cloudflare edge to the target.',
  weather: 'weather [location]\nShow current weather using Open-Meteo. Defaults to Seattle, WA.',
  stock: 'stock <ticker>\nShow a compact quote using Stooq market data.',
  metrics: 'metrics\nShow site visits, page hits, command counts, and geographic breakdowns stored in KV.',
  leaderboard: 'leaderboard [game]\nShow high scores for terminal games.',
  internet: 'internet [site]\nOpen a fake text web browser. Try internet home, internet foundry, internet moe, or internet notes.',
  fzf: 'fzf [query]\nFuzzy-find commands, files, projects, and views.',
  download: 'download [--markdown]\nDownload the resume PDF, or Markdown with --markdown.',
  theme: 'theme <red|amber|frost|ivory|auto>\nPin the terminal palette or return to view-driven automatic themes.',
  maximize: 'maximize\nToggle the terminal window between default and maximized size.',
  minimize: 'minimize\nMinimize the terminal to the dock icon.',
  shutdown: 'shutdown\nVisually shut down the terminal window.',
  '2048': '2048\nBoot the local text-mode 2048 game. Use w/a/s/d to move, n for new, q to quit.',
  chess: 'chess\nBoot a lightweight text-mode chess board. Use moves like e2e4.',
  minesweeper: 'minesweeper\nBoot text-mode minesweeper. Use open A1 and flag B2.',
  clear: 'clear\nClear the terminal buffer.',
  chat: 'chat\nEnter chat mode backed by Workers AI.',
  exit: 'exit\nLeave chat or game mode.',
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
  const pendingAuth = await handlePendingAuth(command, state, env, visibleContext, request);

  if (pendingAuth) {
    await writeState(env, sessionId, state);
    return Response.json({ output: pendingAuth.output, mode: pendingAuth.mode }, { status: pendingAuth.status ?? 200, headers: jsonHeaders });
  }

  appendHistory(state, sanitizeHistoryCommand(command));
  const parsed = parseCommand(stripRedirection(command).command);
  await incrementCommandMetrics(env, parsed.name, request);

  if (body?.recordOnly) {
    await writeState(env, sessionId, state);
    return Response.json({ output: 'recorded' }, { headers: jsonHeaders });
  }

  let result;

  try {
    result = await executeCommandText(command, state, env, visibleContext, request, {
      elevated: hasRoot(state),
    });
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

async function executeCommandText(commandText, state, env, visibleContext, request, options = {}) {
  const redirected = stripRedirection(commandText);
  const parsed = parseCommand(redirected.command);
  const sudoPrefix = parseSudoPrefix(parsed);

  if (sudoPrefix.needsPassword) {
    state.pendingAuth = {
      type: 'sudo',
      command: sudoPrefix.command,
      visibleContext,
      at: Date.now(),
    };
    return { output: '[sudo] password for guest:' };
  }

  if (sudoPrefix.command) {
    const authed = await verifyPassword(env, sudoPrefix.password);

    if (!authed) {
      return { output: 'sudo: authentication failure', status: 403 };
    }

    const sudoResult = await executeCommandText(sudoPrefix.command, state, env, visibleContext, request, {
      ...options,
      elevated: true,
    });

    if (!redirected.target || (sudoResult.status && sudoResult.status >= 400)) {
      return sudoResult;
    }

    return writeUserFile(env, state, redirected.target, sudoResult.output ?? '', {
      append: redirected.append,
      elevated: true,
    });
  }

  if (parsed.name === 'su') {
    if (parsed.args[0]) {
      const authed = await verifyPassword(env, parsed.args[0]);

      if (!authed) {
        return { output: 'su: authentication failure', status: 403 };
      }

      state.rootUntil = Date.now() + 5 * 60 * 1000;
      return { output: 'root session active for 5 minutes.' };
    }

    state.pendingAuth = {
      type: 'su',
      at: Date.now(),
    };
    return { output: 'Password:' };
  }

  const result = await runCommand(parsed, state, env, visibleContext, request, options);

  if (!redirected.target) {
    return result;
  }

  const write = await writeUserFile(env, state, redirected.target, result.output ?? '', {
    append: redirected.append,
    elevated: Boolean(options.elevated),
  });

  if (write.status && write.status >= 400) {
    return write;
  }

  return { output: '' };
}

async function runCommand(parsed, state, env, visibleContext, request, options = {}) {
  switch (parsed.name) {
    case 'ls':
      return listPath(parsed.rest || '/', env);
    case 'cat':
      return catPath(parsed.rest, state, env);
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
    case 'pwd':
      return { output: '/' };
    case 'echo':
      return { output: parsed.rest };
    case 'cp':
      return { output: parsed.rest ? `copied: ${parsed.rest}` : 'Usage: cp <text>', status: parsed.rest ? 200 : 400 };
    case 'tree':
      return treePath(parsed.rest || '/', env);
    case 'find':
      return findPath(parsed.rest, env);
    case 'grep':
      return grepFiles(parsed.rest, env);
    case 'touch':
      return touchFile(parsed.rest, state, env, options);
    case 'rm':
      return removeFile(parsed.rest, state, env, options);
    case 'sudo':
      return { output: 'Usage: sudo <command>', status: 400 };
    case 'su':
      return { output: 'Usage: su', status: 400 };
    case 'comment':
      return addComment(parsed.args, env);
    case 'date':
      return { output: new Date().toString() };
    case 'ask':
      return askAi(parsed.rest, state, env, visibleContext);
    case 'explain':
      return explainThing(parsed.args, state, env, visibleContext);
    case 'email':
      return emailDraft(parsed.args, parsed.rest);
    case 'book':
      return bookMeeting(parsed.args, parsed.rest, env);
    case 'curl':
      return curlUrl(parsed.rest);
    case 'ping':
      return pingHost(parsed.rest || 'pecunies.com');
    case 'trace':
      return traceHost(parsed.rest || 'pecunies.com', request);
    case 'weather':
      return weather(parsed.rest || 'Seattle, WA');
    case 'stock':
      return stock(parsed.rest);
    case 'metrics':
      return metricsOutput(env);
    case 'leaderboard':
      return leaderboardOutput(env, parsed.args[0]);
    case 'score':
      return saveLeaderboardScore(env, parsed.args);
    case 'internet':
      return internet(parsed.args[0] || 'home');
    case 'fzf':
      return fzf(parsed.rest);
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

function stripRedirection(commandText) {
  const match = /(?:^|\s)(>>|>)\s*(\S+)\s*$/.exec(commandText);

  if (!match) {
    return { command: commandText.trim(), target: null, append: false };
  }

  return {
    command: commandText.slice(0, match.index).trim(),
    target: match[2],
    append: match[1] === '>>',
  };
}

function parseSudoPrefix(parsed) {
  if (parsed.name !== 'sudo') {
    return {};
  }

  if (!parsed.args.length) {
    return { needsPassword: false, command: '', password: '' };
  }

  if (parsed.args.length >= 2 && looksLikePassword(parsed.args[0])) {
    return {
      password: parsed.args[0],
      command: parsed.args.slice(1).join(' '),
    };
  }

  return {
    needsPassword: true,
    command: parsed.rest,
  };
}

function looksLikePassword(value) {
  return value === 'PECUnies797++';
}

async function handlePendingAuth(command, state, env, visibleContext, request) {
  if (!state.pendingAuth) {
    return null;
  }

  const pending = state.pendingAuth;
  delete state.pendingAuth;
  const authed = await verifyPassword(env, command.trim());

  if (!authed) {
    return { output: `${pending.type}: authentication failure`, status: 403 };
  }

  if (pending.type === 'su') {
    state.rootUntil = Date.now() + 5 * 60 * 1000;
    return { output: 'root session active for 5 minutes.' };
  }

  return executeCommandText(pending.command, state, env, pending.visibleContext || visibleContext, request, {
    elevated: true,
  });
}

async function verifyPassword(env, value) {
  return value === (env.PECUNIES_SUDO_PASSWD || 'PECUnies797++');
}

function hasRoot(state) {
  return Number(state.rootUntil ?? 0) > Date.now();
}

function sanitizeHistoryCommand(command) {
  if (/^(sudo|su)\s+\S+/.test(command.trim())) {
    return command.replace(/^(sudo|su)\s+\S+/, '$1 ********');
  }

  return command;
}

async function listPath(path, env) {
  const normalized = normalizePath(path);
  const entries = await directoryEntries(normalized, env);

  if (!entries) {
    if (await fileExists(normalized, env)) {
      return normalized;
    }

    return { output: `ls: ${path}: no such directory`, status: 404 };
  }

  return { output: entries.join('\n') };
}

async function catPath(path, state, env) {
  if (!path) {
    return { output: 'Usage: cat <path>', status: 400 };
  }

  const normalized = normalizePath(path);
  const file = await readFile(normalized, env);

  if (file === null || file === undefined) {
    return { output: `cat: ${path}: no such file`, status: 404 };
  }

  if (!state.reads.includes(normalized)) {
    state.reads.push(normalized);
  }

  return { output: file };
}

async function askAi(question, state, env, visibleContext) {
  if (!question) {
    return { output: 'Question:', status: 200 };
  }

  if (!env.AI) {
    return { output: 'Workers AI binding is not configured.', status: 500 };
  }

  const answer = await runAi(env, question, state, visibleContext);
  return { output: answer };
}

async function explainThing(args, state, env, visibleContext) {
  const [kind = 'project', ...rest] = args;
  const target = rest.join(' ').trim();
  const normalizedKind = kind.toLowerCase();

  if (normalizedKind === 'project') {
    return explainProject(target, state, env, visibleContext);
  }

  if (normalizedKind === 'command') {
    const command = target.replace(/^\//, '');
    const manual = MANUALS[command];

    if (!manual) {
      return { output: `Unknown command "${target}". Try man ${target}.`, status: 404 };
    }

    return explainWithAiOrFallback(
      env,
      state,
      visibleContext,
      `Explain the terminal command "${command}" in practical terms. Include usage, parameters, and related commands.\n\nManual:\n${manual}`,
    );
  }

  if (normalizedKind === 'skill') {
    return explainWithAiOrFallback(
      env,
      state,
      visibleContext,
      `Explain Chris Pecunies' skill area "${target || 'cloud and systems engineering'}" using the supplied resume and app context.`,
    );
  }

  if (normalizedKind === 'work') {
    return explainWithAiOrFallback(
      env,
      state,
      visibleContext,
      `Explain Chris Pecunies' work-history entry "${target || 'overall experience'}" using the supplied resume context.`,
    );
  }

  if (normalizedKind === 'education') {
    return explainWithAiOrFallback(
      env,
      state,
      visibleContext,
      'Explain Chris Pecunies education background and how it connects to the software portfolio.',
    );
  }

  return { output: 'Usage: explain <project|skill|work|education|command> [name]', status: 400 };
}

async function explainProject(projectName, state, env, visibleContext) {
  if (!projectName) {
    return { output: 'Usage: explain project <market|pi|wasm|down>', status: 400 };
  }

  const normalized = projectName.toLowerCase();
  const project = Object.values(PROJECTS).find((entry) => entry.aliases.includes(normalized));

  if (!project) {
    return { output: `Unknown project "${projectName}". Try explain project market, pi, wasm, or down.`, status: 404 };
  }

  return explainWithAiOrFallback(
    env,
    state,
    `${visibleContext}\n\nSelected project:\n${project.body}`,
    `Explain ${project.title} clearly. Include what it is, why it matters, architecture/implementation details, and what it says about Chris as an engineer.`,
  );
}

async function explainWithAiOrFallback(env, state, visibleContext, question) {
  if (!env.AI) {
    return { output: question, mode: 'chat' };
  }

  const answer = await runAi(env, question, state, visibleContext);
  return { output: answer, mode: 'chat' };
}

async function runAi(env, question, state, visibleContext) {
  const readContext = state.reads.map((path) => `${path}\n${FILES[path]}`).join('\n\n') || '(no files read yet)';
  const commandContext = state.history
    .slice(-20)
    .map((entry) => `${entry.at}: ${entry.command}`)
    .join('\n');
  const metrics = await readMetrics(env);
  const leaderboard = await readLeaderboard(env);
  const appContext = Object.entries(MANUALS)
    .map(([name, manual]) => `${name}: ${manual}`)
    .join('\n\n');

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content:
          'You are a concise terminal AI for Chris Pecunies portfolio. Use only the supplied profile, file, visible, and command-history context. If unknown, say so.',
      },
      {
        role: 'user',
        content: `Profile:\n${PROFILE_CONTEXT}\n\nFull terminal app command context:\n${appContext}\n\nMetrics state:\n${JSON.stringify(metrics).slice(0, 3000)}\n\nLeaderboard state:\n${JSON.stringify(leaderboard).slice(0, 2000)}\n\nFiles read by user:\n${readContext}\n\nRecent commands:\n${commandContext}\n\nVisible terminal context:\n${visibleContext}\n\nQuestion:\n${question}`,
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

async function treePath(path = '/', env) {
  const root = normalizePath(path);

  if (!(await directoryEntries(root, env))) {
    return {
      output: (await fileExists(root, env)) ? root : `tree: ${path}: no such file or directory`,
      status: (await fileExists(root, env)) ? 200 : 404,
    };
  }

  const lines = [root];
  await appendTree(root, '', lines, env);
  return { output: lines.join('\n') };
}

async function appendTree(path, prefix, lines, env) {
  const entries = (await directoryEntries(path, env)) ?? [];

  for (const [index, entry] of entries.entries()) {
    const last = index === entries.length - 1;
    const branch = last ? '`-- ' : '|-- ';
    lines.push(`${prefix}${branch}${entry}`);

    if (entry.endsWith('/')) {
      const child = normalizePath(`${path}/${entry.replace(/\/$/, '')}`);
      await appendTree(child, `${prefix}${last ? '    ' : '|   '}`, lines, env);
    }
  }
}

async function findPath(query, env) {
  const needle = String(query || '').toLowerCase();

  if (!needle) {
    return { output: 'Usage: find <query>', status: 400 };
  }

  const userFiles = await listUserFiles(env);
  const entries = [...Object.keys(FILES), ...Object.keys(DIRECTORIES), ...userFiles]
    .filter((path) => path.toLowerCase().includes(needle))
    .sort();

  return { output: entries.join('\n') || `find: no matches for "${query}"` };
}

async function grepFiles(query, env) {
  const needle = String(query || '').toLowerCase();

  if (!needle) {
    return { output: 'Usage: grep <query>', status: 400 };
  }

  const userEntries = await userFileEntries(env);
  const matches = [...Object.entries(FILES), ...userEntries]
    .flatMap(([path, text]) =>
      String(text)
        .split('\n')
        .map((line, index) => ({ path, line, number: index + 1 }))
        .filter((entry) => entry.line.toLowerCase().includes(needle)),
    )
    .map((entry) => `${entry.path}:${entry.number}: ${entry.line}`);

  return { output: matches.join('\n') || `grep: no matches for "${query}"` };
}

async function touchFile(path, state, env, options) {
  if (!path) {
    return { output: 'Usage: touch <path>', status: 400 };
  }

  const normalized = normalizePath(path);
  const existing = await readFile(normalized, env);
  return writeUserFile(env, state, normalized, existing ?? '', {
    append: false,
    elevated: Boolean(options.elevated),
    createOnly: true,
  });
}

async function removeFile(path, state, env, options) {
  if (!path) {
    return { output: 'Usage: rm <path>', status: 400 };
  }

  const normalized = normalizePath(path);

  if (FILES[normalized]) {
    return { output: `rm: ${normalized}: immutable static file`, status: 403 };
  }

  if (isProtectedPath(normalized) && !options.elevated) {
    return { output: `rm: ${normalized}: permission denied; use sudo`, status: 403 };
  }

  if (!(await readUserFile(env, normalized))) {
    return { output: `rm: ${normalized}: no such file`, status: 404 };
  }

  await deleteUserFile(env, normalized);
  return { output: `removed ${normalized}` };
}

async function addComment(args, env) {
  const [post = '', name = '', ...messageParts] = args;
  const message = messageParts.join(' ').trim();

  if (!post || !name || !message) {
    return { output: 'Usage: comment <post> <name> <message>', status: 400 };
  }

  const slug = post.replace(/\.md$/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
  const path = `/posts/${slug}.md`;

  if (!(await fileExists(path, env))) {
    return { output: `comment: ${path}: no such post`, status: 404 };
  }

  if (!env.PORTFOLIO_OS) {
    return { output: 'comment: KV binding unavailable', status: 500 };
  }

  const key = `comments:${path}`;
  const comments = (await env.PORTFOLIO_OS.get(key, { type: 'json' })) ?? [];
  comments.push({
    name: name.slice(0, 60),
    message: message.slice(0, 1200),
    at: new Date().toISOString(),
  });
  await env.PORTFOLIO_OS.put(key, JSON.stringify(comments.slice(-100)));

  return { output: `comment added to ${path}` };
}

async function writeUserFile(env, _state, rawPath, content, options = {}) {
  const path = normalizePath(rawPath);

  if (!env.PORTFOLIO_OS) {
    return { output: 'write: KV binding unavailable', status: 500 };
  }

  if (FILES[path]) {
    return { output: `write: ${path}: immutable static file`, status: 403 };
  }

  if (isProtectedPath(path) && !options.elevated) {
    return { output: `write: ${path}: permission denied; use sudo`, status: 403 };
  }

  if (!canCreatePath(path, options.elevated)) {
    return { output: `write: ${path}: permission denied`, status: 403 };
  }

  const previous = options.append ? (await readUserFile(env, path)) ?? '' : '';
  const next = options.append ? `${previous}${previous ? '\n' : ''}${content}` : content;
  await env.PORTFOLIO_OS.put(userFileKey(path), next);
  return { output: `${options.createOnly ? 'touched' : 'wrote'} ${path}` };
}

async function readFile(path, env) {
  return FILES[path] ?? (await readUserFile(env, path));
}

async function fileExists(path, env) {
  const file = await readFile(path, env);
  return file !== null && file !== undefined;
}

async function readUserFile(env, path) {
  if (!env.PORTFOLIO_OS) {
    return null;
  }

  return env.PORTFOLIO_OS.get(userFileKey(path));
}

async function deleteUserFile(env, path) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  await env.PORTFOLIO_OS.delete(userFileKey(path));
}

async function directoryEntries(path, env) {
  const staticEntries = DIRECTORIES[path];
  const dynamicEntries = await dynamicDirectoryEntries(path, env);

  if (!staticEntries && !dynamicEntries.length) {
    return null;
  }

  return [...new Set([...(staticEntries ?? []), ...dynamicEntries])].sort((a, b) => a.localeCompare(b));
}

async function dynamicDirectoryEntries(path, env) {
  const files = await listUserFiles(env);
  const prefix = path === '/' ? '/' : `${path}/`;
  const entries = new Set();

  for (const file of files) {
    if (!file.startsWith(prefix) || file === path) {
      continue;
    }

    const rest = file.slice(prefix.length);
    const [head, ...tail] = rest.split('/');
    entries.add(tail.length ? `${head}/` : head);
  }

  return [...entries];
}

async function listUserFiles(env) {
  if (!env.PORTFOLIO_OS?.list) {
    return [];
  }

  const paths = [];
  let cursor;

  do {
    const page = await env.PORTFOLIO_OS.list({ prefix: 'file:', cursor, limit: 1000 });
    cursor = page.cursor;
    paths.push(...(page.keys ?? []).map((key) => key.name.replace(/^file:/, '')));
  } while (cursor);

  return paths;
}

async function userFileEntries(env) {
  const paths = await listUserFiles(env);
  const entries = [];

  for (const path of paths) {
    entries.push([path, (await readUserFile(env, path)) ?? '']);
  }

  return entries;
}

function canCreatePath(path, elevated) {
  if (path.startsWith('/home/') || path.startsWith('/guest/')) {
    return true;
  }

  if (elevated && (path.startsWith('/posts/') || path.startsWith('/resume/') || path.startsWith('/projects/') || path.startsWith('/system/'))) {
    return true;
  }

  return elevated && path.split('/').filter(Boolean).length === 1;
}

function isProtectedPath(path) {
  const rootFile = path.split('/').filter(Boolean).length === 1;
  return (
    path === '/README.md' ||
    path === '/TODO.md' ||
    path.startsWith('/posts/') ||
    path.startsWith('/resume/') ||
    path.startsWith('/projects/') ||
    path.startsWith('/system/') ||
    rootFile
  );
}

function userFileKey(path) {
  return `file:${normalizePath(path)}`;
}

function emailDraft(args, rest) {
  const [from = '', subject = '', ...messageParts] = args;
  const message = messageParts.join(' ') || rest.replace(`${from} ${subject}`, '').trim();

  if (!from || !subject || !message) {
    return { output: 'Usage: email <your email> <subject> <message>', status: 400 };
  }

  const mailto = `mailto:chris@pecunies.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`From: ${from}\n\n${message}`)}`;
  return {
    output: `email draft ready\nfrom: ${from}\nsubject: ${subject}\nmessage: ${message}\nmailto: ${mailto}`,
  };
}

async function bookMeeting(args, rest, env) {
  const [email = '', date = '', time = '', duration = '', ...messageParts] = args;
  const message = messageParts.join(' ') || rest.replace(`${email} ${date} ${time} ${duration}`, '').trim();

  if (!email || !date || !time || !duration || !message) {
    return { output: 'Usage: book <your email> <date> <time> <duration> <message>', status: 400 };
  }

  const meetLink = `https://meet.google.com/new?hs=portfolio&authuser=0`;
  const summary = `booking request\nfrom: ${email}\ndate: ${date}\ntime: ${time}\nduration: ${duration}\nmessage: ${message}\nmeet: ${meetLink}`;
  await recordBooking(env, { email, date, time, duration, message, meetLink, at: new Date().toISOString() });
  const emailStatus = await sendBookingEmail(env, { email, date, time, duration, message, meetLink });

  return {
    output: `${summary}\n\nRequest recorded. ${emailStatus}`,
  };
}

async function sendBookingEmail(env, booking) {
  if (!env.BOOKING_EMAIL_URL) {
    return 'Email worker URL is not configured in this Pages environment.';
  }

  const subject = `Portfolio booking request: ${booking.date} ${booking.time}`;
  const body = [
    'A booking request was submitted from pecunies.com.',
    '',
    `From: ${booking.email}`,
    `Date: ${booking.date}`,
    `Time: ${booking.time}`,
    `Duration: ${booking.duration}`,
    `Meet: ${booking.meetLink}`,
    '',
    booking.message,
  ].join('\n');

  try {
    const response = await fetch(env.BOOKING_EMAIL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: ['chris@pecunies.com', booking.email],
        subject,
        body,
      }),
    });

    if (!response.ok) {
      return `Email worker returned HTTP ${response.status}; use the meet link and mailto fallback.`;
    }

    return 'Email notifications were sent through the configured Cloudflare Email Worker.';
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return `Email notification failed (${detail}); use the meet link and mailto fallback.`;
  }
}

function traceHost(host, request) {
  const url = normalizeUrl(host);
  const target = new URL(url);
  const cf = request.cf ?? {};
  return {
    output: [
    `trace to ${target.host}`,
    `1  browser.local              0.4 ms`,
    `2  cloudflare-edge/${cf.colo ?? 'edge'}       ${(Math.random() * 4 + 3).toFixed(1)} ms`,
    `3  portfolio-worker           ${(Math.random() * 8 + 8).toFixed(1)} ms`,
    `4  ${target.host.padEnd(24, ' ')} ${(Math.random() * 18 + 18).toFixed(1)} ms`,
    `country: ${cf.country ?? 'unknown'} | tls: ${request.headers.get('cf-visitor') ?? 'edge'}`,
    ].join('\n'),
  };
}

async function metricsOutput(env) {
  const metrics = await readMetrics(env);
  const eventMetrics = await readMetricEvents(env);
  const effective = mergeMetrics(metrics, eventMetrics);
  const lines = [
    `site visits: ${effective.visits}`,
    '',
    'pages:',
    ...formatCounts(effective.pages),
    '',
    'commands:',
    ...formatCounts(effective.commands),
    '',
    'countries:',
    ...formatCounts(effective.countries),
  ];

  return { output: lines.join('\n') };
}

async function leaderboardOutput(env, filterGame) {
  const board = await readLeaderboard(env);
  const games = filterGame ? [filterGame] : Object.keys(board);
  const lines = [];

  for (const game of games) {
    const scores = board[game] ?? [];
    lines.push(`${game}:`);
    lines.push(...(scores.length ? scores.map((entry, index) => `${index + 1}. ${entry.name} ${entry.score} (${entry.at})`) : ['(empty)']));
    lines.push('');
  }

  return { output: lines.join('\n').trim() || '(empty)' };
}

async function saveLeaderboardScore(env, args) {
  const [game, rawScore, ...nameParts] = args;
  const score = Number(rawScore);
  const name = nameParts.join(' ').trim() || 'anonymous';

  if (!game || !Number.isFinite(score)) {
    return { output: 'Usage: score <game> <score> <name>', status: 400 };
  }

  const board = await readLeaderboard(env);
  const entries = Array.isArray(board[game]) ? board[game] : [];
  entries.push({ name: name.slice(0, 40), score, at: new Date().toISOString().slice(0, 10) });
  board[game] = entries.sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 10);
  await writeLeaderboard(env, board);

  return { output: `score saved: ${game} ${score} ${name}` };
}

function internet(site) {
  const pages = {
    home: {
      title: 'terminal://home',
      body: 'A small text web. Links: foundry, moe, notes, coffee.',
      links: ['foundry', 'moe', 'notes', 'coffee'],
    },
    foundry: {
      title: 'terminal://foundry',
      body: 'Dark particle fields, geometric systems, and a vortex-shaped navigation metaphor.',
      links: ['home', 'moe'],
    },
    moe: {
      title: 'terminal://moe',
      body: 'Moe marketplace aggregation: serverless workflows, queues, idempotency, webhooks, and AWS CDK.',
      links: ['home', 'notes'],
    },
    notes: {
      title: 'terminal://notes',
      body: 'down.nvim is where markdown note-taking, Neovim, LSP ideas, and AI-assisted terminal workflows meet.',
      links: ['home', 'coffee'],
    },
    coffee: {
      title: 'terminal://coffee',
      body: 'Presentation effects, stark typography, and sharp motion borrowed as inspiration for this terminal shell.',
      links: ['home'],
    },
  };
  const page = pages[String(site || 'home').toLowerCase()];

  if (!page) {
    return { output: `internet: site not found. Try ${Object.keys(pages).join(', ')}`, status: 404 };
  }

  return {
    output: `${page.title}\n\n${page.body}\n\nlinks:\n${page.links.map((link) => `- internet ${link}`).join('\n')}`,
  };
}

function fzf(query) {
  const haystack = [
    ...Object.keys(MANUALS).map((name) => ({ label: name, detail: MANUALS[name].split('\n')[0] })),
    ...Object.keys(FILES).map((path) => ({ label: path, detail: 'file' })),
    ...Object.values(PROJECTS).map((project) => ({ label: project.title, detail: project.body })),
  ];
  const needle = String(query || '').toLowerCase();
  const scored = haystack
    .map((entry) => ({ ...entry, score: fuzzyScore(entry.label.toLowerCase(), needle) }))
    .filter((entry) => !needle || entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 16);

  return { output: scored.map((entry) => `${entry.label} - ${entry.detail}`).join('\n') || '(empty)' };
}

function fuzzyScore(value, query) {
  if (!query) {
    return 1;
  }

  let score = 0;
  let cursor = 0;

  for (const char of query) {
    const index = value.indexOf(char, cursor);

    if (index === -1) {
      return 0;
    }

    score += index === cursor ? 2 : 1;
    cursor = index + 1;
  }

  return score;
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
    pendingAuth: state.pendingAuth && typeof state.pendingAuth === 'object' ? state.pendingAuth : null,
    rootUntil: Number(state.rootUntil ?? 0),
  };
}

async function readMetrics(env) {
  if (!env.PORTFOLIO_OS) {
    return defaultMetrics();
  }

  const metrics = (await env.PORTFOLIO_OS.get('metrics:global', { type: 'json' })) ?? defaultMetrics();
  return {
    visits: Number(metrics.visits ?? 0),
    pages: metrics.pages && typeof metrics.pages === 'object' ? metrics.pages : {},
    commands: metrics.commands && typeof metrics.commands === 'object' ? metrics.commands : {},
    countries: metrics.countries && typeof metrics.countries === 'object' ? metrics.countries : {},
  };
}

async function writeMetrics(env, metrics) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  await env.PORTFOLIO_OS.put('metrics:global', JSON.stringify(metrics));
}

async function incrementCommandMetrics(env, command, request) {
  const metrics = await readMetrics(env);
  metrics.commands[command] = Number(metrics.commands[command] ?? 0) + 1;
  const country = request.cf?.country ?? 'XX';
  metrics.countries[country] = Number(metrics.countries[country] ?? 0) + 1;
  await writeMetrics(env, metrics);

  if (env.PORTFOLIO_OS) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await env.PORTFOLIO_OS.put(
      `metric:event:${id}`,
      JSON.stringify({ type: 'command', command, country, at: new Date().toISOString() }),
      { expirationTtl: 60 * 60 * 24 * 365 },
    );
  }
}

function defaultMetrics() {
  return {
    visits: 0,
    pages: {},
    commands: {},
    countries: {},
  };
}

function formatCounts(counts) {
  const entries = Object.entries(counts ?? {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 12);

  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`) : ['(empty)'];
}

function mergeMetrics(summary, events) {
  if (!events) {
    return summary;
  }

  return {
    visits: Math.max(Number(summary.visits ?? 0), Number(events.visits ?? 0)),
    pages: mergeCountMaps(summary.pages, events.pages),
    commands: mergeCountMaps(summary.commands, events.commands),
    countries: mergeCountMaps(summary.countries, events.countries),
  };
}

function mergeCountMaps(a = {}, b = {}) {
  const merged = { ...a };

  for (const [key, value] of Object.entries(b)) {
    merged[key] = Math.max(Number(merged[key] ?? 0), Number(value));
  }

  return merged;
}

async function readMetricEvents(env) {
  if (!env.PORTFOLIO_OS?.list) {
    return null;
  }

  const aggregate = defaultMetrics();
  let cursor;

  do {
    const page = await env.PORTFOLIO_OS.list({ prefix: 'metric:event:', cursor, limit: 1000 });
    cursor = page.cursor;

    for (const key of page.keys ?? []) {
      const event = await env.PORTFOLIO_OS.get(key.name, { type: 'json' });

      if (!event || typeof event !== 'object') {
        continue;
      }

      if (event.type === 'page') {
        aggregate.visits += 1;
        aggregate.pages[event.route] = Number(aggregate.pages[event.route] ?? 0) + 1;
      }

      if (event.type === 'command') {
        aggregate.commands[event.command] = Number(aggregate.commands[event.command] ?? 0) + 1;
      }

      const country = event.country ?? 'XX';
      aggregate.countries[country] = Number(aggregate.countries[country] ?? 0) + 1;
    }
  } while (cursor);

  return aggregate;
}

async function readLeaderboard(env) {
  if (!env.PORTFOLIO_OS) {
    return defaultLeaderboard();
  }

  const board = (await env.PORTFOLIO_OS.get('leaderboard:global', { type: 'json' })) ?? defaultLeaderboard();
  return {
    '2048': Array.isArray(board['2048']) ? board['2048'] : [],
    chess: Array.isArray(board.chess) ? board.chess : [],
    minesweeper: Array.isArray(board.minesweeper) ? board.minesweeper : [],
  };
}

async function writeLeaderboard(env, board) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  await env.PORTFOLIO_OS.put('leaderboard:global', JSON.stringify(board));
}

function defaultLeaderboard() {
  return {
    '2048': [],
    chess: [],
    minesweeper: [],
  };
}

async function recordBooking(env, booking) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.PORTFOLIO_OS.put(`booking:${id}`, JSON.stringify(booking), { expirationTtl: 60 * 60 * 24 * 180 });
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
    pendingAuth: null,
    rootUntil: 0,
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
