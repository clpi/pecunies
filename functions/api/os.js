import { appendAiLog, readAiLogText } from './ai-log.js';
import {
  assetPathToPostPath,
  collectAllPosts,
  deletePostFromStorage,
  postPathToAssetPath,
  recordBookingEvent,
  recordPostEvent,
  syncAssetToStorage,
  syncPostToStorage,
  upsertTagWithItems,
} from './posts.js';

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

/**
 * Accept broader Workers AI model ids instead of a tiny hardcoded list.
 * Examples: @cf/meta/llama-3.1-8b-instruct, @cf/qwen/qwen2.5-coder-32b-instruct
 */
function isValidAiModel(model) {
  if (typeof model !== 'string') return false;
  const value = model.trim();
  if (!value.startsWith('@cf/')) return false;
  return /^@cf\/[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(value);
}

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
  '/CHANGELOG.md':
    '# Changelog\n\n## v1.2.0\n- Added /CHANGELOG.md documenting terminal application changes.\n- Added tags system: /tags command to discover content by tag.\n- Added environment variables with export and echo $VAR expansion.\n- Added piping support: `command1 | command2` pipes output.\n- Added /debug toggle for verbose logging.\n- Added cd, cp, mv, ln, and /dir aliases.\n- Enhanced sudo protection for /bin, /var, /root and root files.\n\n## v1.1.0\n- Added OS filesystem simulation with /bin, /var/log, /root.\n- Added tail, less, mkdir, and logs commands.\n- Added /cat --pretty for markdown syntax highlighting.\n- Added /explain last to explain previous command output.\n\n## v1.0.0\n- Initial release of Pecunies Terminal portfolio.',
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
    '# Contact\n\n- Email: chris@pecunies.com\n- GitHub: https://github.com/clpi\n- GitLab: https://gitlab.com/clpi\n- SourceHut: https://sr.ht/~clp/\n- Codeberg: https://codeberg.org/clp\n- LinkedIn: https://linkedin.com/in/chrispecunies\n- Website: https://pecunies.com\n- Short website: https://clp.is\n- Ko-fi: https://ko-fi.com/clp\n- X: https://x.com/clpif\n- Threads: https://www.threads.com/@chris.pecunies\n- Patreon: https://patreon.com/pecunies\n- Open Collective: https://opencollective.com/clp\n- Cal.com: https://cal.com/chrisp\n- Calendly: https://calendly.com/pecunies\n- Buy Me a Coffee: https://buymeacoffee.com/pecunies\n- Instagram: https://www.instagram.com/chris.pecunies/\n- Facebook: https://www.facebook.com/chris.pecunies/\n- Location: Seattle, WA',
  '/posts/2026/04/29/terminal-portfolio-changelog.md':
    '---\ntitle: Terminal Portfolio Changelog\ndate: 2026-04-29\ntags: writing, content, terminal\ndescription: Changelog and notes for the terminal-native portfolio writing system.\n---\n\n# Terminal Portfolio Changelog\n\nInitial post placeholder for the terminal-native writing system. Posts are markdown files under `/posts`; creating, editing, or removing them requires sudo privileges.',
  '/assets/posts/2026/04/29/terminal-portfolio-changelog.md':
    '---\ntitle: Terminal Portfolio Changelog\ndate: 2026-04-29\ntags: writing, content, terminal\ndescription: Changelog and notes for the terminal-native portfolio writing system.\n---\n\n# Terminal Portfolio Changelog\n\nInitial post placeholder for the terminal-native writing system. Posts are markdown files under `/posts`; creating, editing, or removing them requires sudo privileges.',
  '/system/man.txt':
    'Portfolio OS commands: ls, cat, man, whoami, history, ps, top, pwd, echo, cp, tree, find, grep, touch, rm, mkdir, tail, less, source, logs, date, uptime, last, dark, light, rag, ask, explain, curl, ping, traceroute, trace, weather, stock, metrics, leaderboard, internet, fzf, clpsh, email, book, comment, sudo, su, 2048, jobquest, clear, chat, exit, download, theme, maximize, minimize, shutdown.',
  '/bin/clpsh': '#!/bin/clpsh\nPortfolio OS shell. Type commands at the prompt.',
  '/bin/minesweeper': '#!/bin/minesweeper\nText-mode minesweeper game.',
  '/bin/2048': '#!/bin/2048\nText-mode 2048 game.',
  '/bin/chess': '#!/bin/chess\\nLightweight text-mode chess.',
  '/bin/jobquest': '#!/bin/jobquest\nText adventure: job search / signal hunt.',
  '/bin/edit': '#!/bin/edit\\nText editor for the pecuOS filesystem.',
  '/home/guest/README.txt':
    'Home directory for guest@pecunies. See projects/ and skills/ for portfolio slices aligned with the terminal UI.',
  '/home/guest/projects/README.md':
    '# ~/projects\n\nSymlink-style view of shipped work. Use `projects` or `explain project` from the shell for full cards.',
  '/home/guest/skills/README.md':
    '# ~/skills\n\nSkill clusters mirror `skills` and resume markdown. Run `skills` or `cat /resume/skills.md`.',
  '/etc/clpsh/clpshrc': '# pecuOS clpsh shell rc\\n# Runs when clpsh initializes\\n# Use export, alias, set commands here',
  '/etc/edit/editrc': '# pecuOS edit rc\\n# Runs when /edit initializes\\n# Settings for the edit text editor',
  '/etc/themes/red.json': JSON.stringify({
    name: 'red', label: 'Red Signal', accent: '#ff6a66', accentStrong: '#ff3347',
    accentSoft: 'rgba(255, 106, 102, 0.13)', panel: 'rgba(13, 10, 11, 0.58)',
    panelStrong: 'rgba(22, 14, 16, 0.74)', text: '#f2eff0', muted: '#988f92',
    depth: '#030203', mode: 0,
  }, null, 2),
  '/etc/themes/amber.json': JSON.stringify({
    name: 'amber', label: 'Amber Phosphor', accent: '#f5b84b', accentStrong: '#ffd27a',
    accentSoft: 'rgba(245, 184, 75, 0.13)', panel: 'rgba(9, 10, 12, 0.56)',
    panelStrong: 'rgba(14, 15, 17, 0.72)', text: '#eceff1', muted: '#8b9299',
    depth: '#020305', mode: 1,
  }, null, 2),
  '/etc/themes/frost.json': JSON.stringify({
    name: 'frost', label: 'Blue Frost', accent: '#8bcaff', accentStrong: '#5da7ff',
    accentSoft: 'rgba(139, 220, 255, 0.14)', panel: 'rgba(8, 10, 13, 0.55)',
    panelStrong: 'rgba(13, 16, 19, 0.72)', text: '#f0f4f6', muted: '#8c99a3',
    depth: '#020305', mode: 2,
  }, null, 2),
  '/etc/themes/ivory.json': JSON.stringify({
    name: 'ivory', label: 'White Signal', accent: '#f4f7f8', accentStrong: '#ffffff',
    accentSoft: 'rgba(244, 247, 248, 0.12)', panel: 'rgba(10, 10, 11, 0.56)',
    panelStrong: 'rgba(16, 16, 18, 0.72)', text: '#f4f7f8', muted: '#92989d',
    depth: '#020305', mode: 3,
  }, null, 2),
  '/etc/themes/magenta.json': JSON.stringify({
    name: 'magenta', label: 'Magenta Pulse', accent: '#e066ff', accentStrong: '#d633ff',
    accentSoft: 'rgba(224, 102, 255, 0.13)', panel: 'rgba(12, 10, 13, 0.56)',
    panelStrong: 'rgba(18, 14, 19, 0.72)', text: '#f4f0f5', muted: '#9a92a3',
    depth: '#030205', mode: 0,
  }, null, 2),
  '/etc/themes/blue.json': JSON.stringify({
    name: 'blue', label: 'Deep Blue', accent: '#66b3ff', accentStrong: '#3385ff',
    accentSoft: 'rgba(102, 179, 255, 0.13)', panel: 'rgba(8, 10, 14, 0.56)',
    panelStrong: 'rgba(12, 16, 22, 0.72)', text: '#f0f2f6', muted: '#8c96a8',
    depth: '#020305', mode: 2,
  }, null, 2),
  '/etc/themes/green.json': JSON.stringify({
    name: 'green', label: 'Signal Green', accent: '#66ff99', accentStrong: '#33ff77',
    accentSoft: 'rgba(102, 255, 153, 0.13)', panel: 'rgba(9, 12, 10, 0.56)',
    panelStrong: 'rgba(14, 19, 16, 0.72)', text: '#f0f5f2', muted: '#8ca392',
    depth: '#020503', mode: 1,
  }, null, 2),
};

const DIRECTORIES = {
  '/': ['README.md', 'TODO.md', 'app/', 'assets/', 'bin/', 'etc/', 'guest/', 'home/', 'opt/', 'posts/', 'resume/', 'projects/', 'contact.md', 'system/', 'tmp/', 'usr/', 'var/', 'root/'],
  '/app': [],
  '/bin': ['clpsh', 'minesweeper', '2048', 'chess', 'jobquest'],
  '/guest': [],
  '/home': ['guest/'],
  '/home/guest': ['projects/', 'skills/', 'README.txt', '.clpshrc'],
  '/home/guest/projects': ['README.md'],
  '/home/guest/skills': ['README.md'],
  '/posts': ['2026/'],
  '/posts/2026': ['04/'],
  '/posts/2026/04': ['29/'],
  '/posts/2026/04/29': ['terminal-portfolio-changelog.md'],
  '/assets': ['posts/'],
  '/assets/posts': ['2026/'],
  '/assets/posts/2026': ['04/'],
  '/assets/posts/2026/04': ['29/'],
  '/assets/posts/2026/04/29': ['terminal-portfolio-changelog.md'],
  '/resume': ['resume.md', 'skills.md', 'projects.md'],
  '/projects': ['marketplace-aggregator.md', 'webassembly-runtime.md', 'down-nvim.md', 'pi-cluster.md'],
  '/system': ['man.txt'],
  '/tmp': [],
  '/var': ['log/'],
  '/var/log': ['system.log', 'system_public.log', 'ai.log'],
  '/root': [],
  '/etc': ['edit/', 'themes/'],
  
  '/etc/edit': ['editrc'],
  '/etc/themes': ['red.json', 'amber.json', 'frost.json', 'ivory.json', 'magenta.json', 'blue.json', 'green.json'],
  '/usr': [],
  '/opt': [],
};

const TAGS = {
  'portfolio': [
    { label: 'README.md', type: 'file', command: 'cat README.md' },
    { label: 'TODO.md', type: 'file', command: 'cat TODO.md' },
    { label: 'CHANGELOG.md', type: 'file', command: 'cat CHANGELOG.md' },
    { label: 'contact.md', type: 'file', command: 'cat contact.md' },
    { label: 'system/man.txt', type: 'file', command: 'cat system/man.txt' },
  ],
  'system': [
    { label: 'ps', type: 'command', command: 'ps' },
    { label: 'top', type: 'command', command: 'top' },
    { label: 'whoami', type: 'command', command: 'whoami' },
    { label: 'date', type: 'command', command: 'date' },
    { label: 'pwd', type: 'command', command: 'pwd' },
    { label: 'system/man.txt', type: 'file', command: 'cat system/man.txt' },
    { label: 'logs', type: 'command', command: 'logs' },
    { label: 'debug', type: 'command', command: 'debug' },
    { label: '/bin', type: 'dir', command: 'ls /bin' },
    { label: '/var', type: 'dir', command: 'ls /var' },
    { label: '/root', type: 'dir', command: 'sudo ls /root' },
    { label: '/etc', type: 'dir', command: 'sudo ls /etc' },
    { label: '/etc/themes', type: 'dir', command: 'sudo ls /etc/themes' },
  ],
  'project': [
    { label: 'Marketplace Aggregator', type: 'view', command: 'explain project market' },
    { label: 'WebAssembly Runtime', type: 'view', command: 'explain project wasm' },
    { label: 'down.nvim', type: 'view', command: 'explain project down' },
    { label: 'Raspberry Pi Cluster', type: 'view', command: 'explain project pi' },
    { label: '/projects', type: 'dir', command: 'ls /projects' },
  ],
  'games': [
    { label: '2048', type: 'command', command: '2048' },
    { label: 'chess', type: 'command', command: 'chess' },
    { label: 'minesweeper', type: 'command', command: 'minesweeper' },
    { label: 'jobquest', type: 'command', command: 'jobquest' },
    { label: 'leaderboard', type: 'command', command: 'leaderboard' },
  ],
  'cloud': [
    { label: 'weather', type: 'command', command: 'weather' },
    { label: 'stock', type: 'command', command: 'stock' },
    { label: 'curl', type: 'command', command: 'curl' },
    { label: 'ping', type: 'command', command: 'ping' },
    { label: 'trace', type: 'command', command: 'trace' },
    { label: 'internet', type: 'command', command: 'internet' },
    { label: 'Marketplace Aggregator on AWS', type: 'view', command: 'explain project market' },
  ],
  'content': [
    { label: 'README.md', type: 'file', command: 'cat README.md' },
    { label: 'TODO.md', type: 'file', command: 'cat TODO.md' },
    { label: 'CHANGELOG.md', type: 'file', command: 'cat CHANGELOG.md' },
    { label: 'posts/', type: 'dir', command: 'ls /posts' },
    { label: 'cat --pretty', type: 'command', command: 'cat --pretty README.md' },
  ],
  'career': [
    { label: 'resume.md', type: 'file', command: 'cat resume/resume.md' },
    { label: 'skills.md', type: 'file', command: 'cat resume/skills.md' },
    { label: 'projects.md', type: 'file', command: 'cat resume/projects.md' },
    { label: 'explain work', type: 'command', command: 'explain work' },
    { label: 'explain education', type: 'command', command: 'explain education' },
    { label: 'whoami', type: 'command', command: 'whoami' },
  ],
  'tooling': [
    { label: 'grep', type: 'command', command: 'grep' },
    { label: 'find', type: 'command', command: 'find' },
    { label: 'fzf', type: 'command', command: 'fzf' },
    { label: 'tree', type: 'command', command: 'tree' },
    { label: 'man', type: 'command', command: 'man' },
    { label: 'mkdir', type: 'command', command: 'mkdir' },
    { label: 'touch', type: 'command', command: 'touch' },
    { label: 'rm', type: 'command', command: 'rm' },
    { label: 'cp', type: 'command', command: 'cp' },
    { label: 'mv', type: 'command', command: 'mv' },
    { label: 'ln', type: 'command', command: 'ln' },
    { label: 'tail', type: 'command', command: 'tail' },
    { label: 'less', type: 'command', command: 'less' },
    { label: 'echo', type: 'command', command: 'echo' },
    { label: 'cd', type: 'command', command: 'cd' },
    { label: 'clpsh', type: 'command', command: 'clpsh' },
    { label: 'export', type: 'command', command: 'export' },
    { label: 'download', type: 'command', command: 'download' },
    { label: 'theme', type: 'command', command: 'theme' },
    { label: 'maximize', type: 'command', command: 'maximize' },
    { label: 'minimize', type: 'command', command: 'minimize' },
    { label: 'clear', type: 'command', command: 'clear' },
    { label: 'shutdown', type: 'command', command: 'shutdown' },
  ],
  'ai': [
    { label: 'ask', type: 'command', command: 'ask' },
    { label: 'chat', type: 'command', command: 'chat' },
    { label: 'explain', type: 'command', command: 'explain' },
  ],
  'network': [
    { label: 'curl', type: 'command', command: 'curl' },
    { label: 'ping', type: 'command', command: 'ping' },
    { label: 'trace', type: 'command', command: 'trace' },
    { label: 'internet', type: 'command', command: 'internet' },
    { label: 'email', type: 'command', command: 'email' },
    { label: 'book', type: 'command', command: 'book' },
  ],
  'social': [
    { label: 'contact.md', type: 'file', command: 'cat contact.md' },
    { label: 'comment', type: 'command', command: 'comment' },
    { label: 'email', type: 'command', command: 'email' },
    { label: 'book', type: 'command', command: 'book' },
  ],
};

const MANUALS = {
  ask: 'ask <question>\nSend a question to Workers AI with full app context, command history, metrics, leaderboard state, and files you have read as context. If no argument is supplied, the frontend asks for the prompt string.',
  explain: 'explain <project|skill|work|education|command> [name]\nExplain portfolio entities or terminal commands with Workers AI. Project shortcuts: market, pi, wasm, down.',
  email: 'email <your email> <subject> <message>\nCreate a structured email draft to Chris. Example: email me@example.com Hello "Interested in your work".',
  book: 'book <your email> <date> <time> <duration> <message>\nRequest a meeting. The worker records the request and attempts a transactional email notification.',
  ls: 'ls [path]\nList directories in the portfolio OS. Try ls /projects.',
  cat: 'cat <path>\nRead files from the portfolio OS. Markdown files render as formatted output in the terminal UI. Try cat /README.md or cat /resume/resume.md.',
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
  new: 'new post --title=<title> --tags=<comma,tags> [--description=<text>] <body>\nCreate a dated markdown post under /posts/YYYY/MM/DD/ (sudo required). Body is the markdown after flags.',
  upload:
    'upload image <post-slug|/posts/path.md> <https://image-url> [alt text]\nFetch an image URL, store it under /assets/posts, append a markdown image reference to the post body, and sync to D1/R2.',
  sync:
    'sync\nSync /posts markdown into D1 + R2 snapshots and sync /assets/posts files into R2 assets. Requires sudo by default; use POST_CREATION_MODE=open to allow local non-admin sync.',
  date: 'date\nPrint current Cloudflare edge time.',
  uptime: 'uptime\nShow current time, up duration, users, and load averages.',
  last: 'last [n]\nShow recent session command activity in a login-style list.',
  curl: 'curl <url>\nFetch a URL from the Cloudflare edge and print status plus a short text preview.',
  ping: 'ping <host>\nApproximate network reachability with an HTTP request from Cloudflare Workers.',
  traceroute: 'traceroute <host>\nShow a hop-style path to a host using simulated edge/network hops.',
  whois: 'whois <site>\nShow ownership/network metadata using DNS + RDAP lookups where available.',
  trace: 'trace <website>\nShow a stylized network trace from browser to Cloudflare edge to the target.',
  doctor: 'doctor\nRun a quick terminal diagnostics suite (bindings, network reachability, and DNS checks).',
  weather: 'weather [location]\nShow current weather using Open-Meteo. Defaults to Seattle, WA.',
  stock: 'stock <ticker>\nShow a compact quote using Stooq market data.',
  metrics: 'metrics\nShow site visits, page hits, command counts, and geographic breakdowns stored in KV.',
  leaderboard: 'leaderboard [game]\nShow high scores for terminal games (2048, chess, minesweeper, jobquest).',
  internet: 'internet [site]\nOpen a fake text web browser. Try internet home, internet foundry, internet moe, or internet notes.',
  fzf: 'fzf [query]\nFuzzy-find commands, files, projects, and views.',
  download: 'download [--markdown]\nDownload the resume PDF, or Markdown with --markdown.',
  theme:
    'theme [set <name>|list|random|auto|<name>]\nPin a palette (red, amber, frost, ivory, green, magenta, blue, purple) or use theme auto for view-driven colors. Try theme list.',
  maximize: 'maximize\nToggle the terminal window between default and maximized size.',
  minimize: 'minimize\nMinimize the terminal to the dock icon.',
  shutdown: 'shutdown\nVisually shut down the terminal window.',
  '2048': '2048\nBoot the local text-mode 2048 game. Use w/a/s/d to move, n for new, q to quit.',
  chess: 'chess\nBoot a lightweight text-mode chess board. Use moves like e2e4.',
  minesweeper: 'minesweeper\nBoot text-mode minesweeper. Use open A1 and flag B2.',
  jobquest:
    'jobquest\nBoot the Signal Hunt text adventure (job search). Type 1–9 or choice keywords; help re-reads the scene; n new; q quit.',
  clear: 'clear\nClear the terminal buffer.',
  chat: 'chat\nEnter chat mode backed by Workers AI.',
  exit: 'exit\nLeave chat or game mode.',
  clpsh: 'clpsh\nStart a new portfolio OS shell process.',
  logs: 'logs [--full]\nShow system log entries. Use sudo logs --full for the complete log.',
  mkdir: 'mkdir <path>\nCreate a directory. Allowed in /home, /guest, /tmp without sudo.',
  tail: 'tail [-n N] <path>\nShow the last N lines of a file. Defaults to 10 lines.',
  head: 'head [-n N] <path>\nShow the first N lines of a file. Defaults to 10 lines.',
  less: 'less <path>\nView a file content in the terminal.',
  source: 'source <path>\nRead shell commands from a file and run them in order. Comments and blank lines are skipped.',
  env:
    'env [list|view|get <KEY>|set <KEY=VALUE>]\nView, list, get, or set environment variables. Includes exports from /etc/clpsh/clpshrc and /home/<user>/.clpshrc, then overlays session exports.',
  rag:
    'rag <add|list|search|clear> [context]\nStore and retrieve RAG memory notes for AI commands. Notes are kept in session, persisted to KV when available, and semantically queried via Vectorize when configured.',
  dark: 'dark\nEnable dark mode and persist it to session config.',
  light: 'light\nEnable light mode and persist it to session config.',
  dir: 'dir [path]\nAlias for ls. List directories in the portfolio OS.',
  edit: 'edit <path>\nOpen a text editor for a portfolio OS file. Ctrl+S to save, Esc to close.',
  open: 'open <path|url>\nOpen a file, directory, or URL with the appropriate handler.',
  write: 'write <path> <content>\nWrite content to a file. Requires sudo for protected paths.',
  tags: 'tags [fragment]\nList all tags used in the portfolio OS, or show content for tags whose names match <fragment> (substring).',
  post: 'post open <slug>\nFrontend command: load a full post from /api/posts. Use posts to browse the index.',
  config:
    'config <set|get|list|reset> [key] [value]\nSession preferences: crt on|off (CRT scanline effect), theme, syntax_scheme (default|contrast|pastel), font_size, font, dark, name, environment, email, ai_model, system_prompt.\nChanging name moves the simulated home to /home/<name>, creates it if needed, migrates .clpshrc and .clpsh_history from the previous home when present, and resets cwd to the new home.',
};

/** Command → taxonomy tags (shown on man pages); keep in sync with src/data/content-tags.ts COMMAND_TAGS */
const COMMAND_TAGS = {
  ask: ['ai', 'network', 'portfolio'],
  explain: ['ai', 'portfolio', 'career'],
  chat: ['ai', 'terminal'],
  ls: ['system', 'tooling'],
  cat: ['portfolio', 'content', 'tooling'],
  man: ['terminal', 'tooling'],
  tags: ['portfolio', 'tooling', 'terminal'],
  config: ['system', 'terminal'],
  sync: ['content', 'devops', 'system'],
  theme: ['theme', 'terminal'],
  grep: ['tooling', 'devops'],
  find: ['tooling'],
  curl: ['network', 'cloud'],
  ping: ['network'],
  traceroute: ['network'],
  whois: ['network', 'cloud'],
  doctor: ['system', 'network'],
  uptime: ['system'],
  last: ['system'],
  weather: ['cloud', 'network'],
  internet: ['network', 'games'],
  fzf: ['tooling', 'terminal'],
  sudo: ['system'],
  ps: ['system'],
  logs: ['system'],
  session: ['system'],
  email: ['contact', 'social'],
  book: ['contact', 'social'],
  download: ['resume', 'document'],
  clear: ['terminal'],
  neofetch: ['system', 'terminal'],
  new: ['writing', 'content', 'terminal'],
  upload: ['writing', 'content', 'tooling'],
  post: ['writing', 'content'],
  env: ['system', 'tooling', 'terminal'],
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
  const requestedModel = typeof body?.model === 'string' ? body.model.trim() : '';
  const systemPrompt = typeof body?.systemPrompt === 'string' ? body.systemPrompt.trim().slice(0, 1200) : '';

  if (!command) {
    return Response.json({ error: 'Command is required.' }, { status: 400, headers: jsonHeaders });
  }

  const state = await readState(env, sessionId);
  ensureHomeDirectory(state);
  const pendingAuth = await handlePendingAuth(command, state, env, visibleContext, request);

  if (pendingAuth) {
    logSystemEvent(
      state,
      `auth pending: type=${String(state.pendingAuth?.type || 'unknown')} session=${sessionId}`,
      true,
    );
    await writeState(env, sessionId, state);
    return Response.json(
      {
        output: pendingAuth.output,
        mode: pendingAuth.mode,
        config: mergeConfigDefaults(state.config),
        cwd: state.cwd || userHomePath(state),
      },
      { status: pendingAuth.status ?? 200, headers: jsonHeaders },
    );
  }

  appendHistory(state, sanitizeHistoryCommand(command));
  const parsed = parseCommand(stripRedirection(command).command);
  logSystemEvent(state, `command: ${sanitizeHistoryCommand(command)}`, true);
  await incrementCommandMetrics(env, parsed.name, request);

  if (body?.recordOnly) {
    logSystemEvent(state, `record-only persisted: session=${sessionId} history=${state.history.length}`, true);
    await writeState(env, sessionId, state);
    return Response.json(
      { output: 'recorded', config: mergeConfigDefaults(state.config), cwd: state.cwd || userHomePath(state) },
      { headers: jsonHeaders },
    );
  }

  let result;

  try {
    result = await executeCommandText(command, state, env, visibleContext, request, {
      elevated: hasRoot(state),
      sessionId,
      model: requestedModel,
      systemPrompt,
    });
  } catch (error) {
    result = {
      output: error instanceof Error ? error.message : 'Command failed.',
      status: 500,
    };
  }

  logSystemEvent(
    state,
    `state persisted: session=${sessionId} history=${state.history.length} reads=${state.reads.length} rag=${Array.isArray(state.ragContext) ? state.ragContext.length : 0}`,
    true,
  );
  await writeState(env, sessionId, state);
  return Response.json(
    {
      output: result.output,
      mode: result.mode,
      config: mergeConfigDefaults(state.config),
      cwd: state.cwd || userHomePath(state),
    },
    { status: result.status ?? 200, headers: jsonHeaders },
  );
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function executeCommandText(commandText, state, env, visibleContext, request, options = {}) {
  const chained = splitAndAnd(commandText);
  if (chained.length > 1) {
    let last = { output: '' };
    for (const segment of chained) {
      const result = await executeCommandText(segment, state, env, visibleContext, request, options);
      if (result.status && result.status >= 400) {
        return result;
      }
      last = result;
    }
    return last;
  }

  /* Pipelines: split on first bare | so `ls|grep` and `a | b | c` work (left-associative chain). */
  const pipeIndex = commandText.indexOf('|');
  if (pipeIndex > 0) {
    const leftCommand = commandText.slice(0, pipeIndex).trim();
    const rightCommand = commandText.slice(pipeIndex + 1).trim();
    if (leftCommand && rightCommand) {
      const leftResult = await executeCommandText(leftCommand, state, env, visibleContext, request, options);
      if (leftResult.status && leftResult.status >= 400) {
        return leftResult;
      }
      const pipeData = leftResult.output ?? '';
      return executeCommandText(rightCommand, state, env, visibleContext, request, {
        ...options,
        inputData: pipeData,
      });
    }
  }

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

function splitAndAnd(commandText) {
  const parts = [];
  let quote = null;
  let escape = false;
  let start = 0;

  for (let i = 0; i < commandText.length; i++) {
    const ch = commandText[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && quote !== "'") {
      escape = true;
      continue;
    }

    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === '&' && commandText[i + 1] === '&') {
      const segment = commandText.slice(start, i).trim();
      if (segment) parts.push(segment);
      start = i + 2;
      i += 1;
    }
  }

  const tail = commandText.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

async function runCommand(parsed, state, env, visibleContext, request, options = {}) {
  // Path executor: /bin/xxx routes to the appropriate command
  if (parsed.name.startsWith('/bin/')) {
    const binCommand = parsed.name.replace(/^\/bin\//, '');
    if (['2048', 'chess', 'minesweeper', 'jobquest'].includes(binCommand)) {
      return { output: `Booting ${binCommand}... Type /${binCommand} to start.` };
    }
    if (binCommand === 'clpsh') {
      return { output: 'clpsh: portfolio OS shell session active' };
    }
    if (binCommand === 'edit') {
      return editFile(parsed.args.slice(1), state, env, options);
    }
    return { output: `/bin/${binCommand}: command not found`, status: 404 };
  }

  switch (parsed.name) {
    case 'ls':
    case 'dir':
      return listPath(parsed.rest || state.cwd || '/', env);
    case 'cat': {
      const pretty = parsed.args.includes('--pretty');
      const cleanRest = parsed.rest.replace('--pretty', '').replace('--pretty', '').trim() || parsed.rest;
      return catPath(cleanRest, state, env, { pretty, elevated: Boolean(options.elevated) });
    }
    case 'man': {
      const cmd = parsed.args[0];
      const body = MANUALS[cmd];
      if (!body) return { output: 'No manual entry. Try man ask or cat /system/man.txt.' };
      const tagLine =
        COMMAND_TAGS[cmd]?.length > 0 ? `\n\nTags: ${COMMAND_TAGS[cmd].join(', ')}` : '';
      return { output: `${body}${tagLine}` };
    }
    case 'whoami':
      return { output: identitySummary(state) };
    case 'history':
      if (parsed.args[0] === 'clear') {
        state.history = [];
        return { output: 'History cleared for this session.' };
      }
      return { output: state.history.map((entry, index) => `${String(index + 1).padStart(3, ' ')}  ${entry.command}`).join('\n') || '(empty)' };
    case 'ps':
      if (parsed.args.includes('aux')) {
        return { output: psAuxOutput() };
      }
      return { output: psOutput() };
    case 'top':
      return { output: topOutput(state) };
    case 'cp':
      if (parsed.args.length < 2 || !parsed.args[1]?.startsWith('/')) {
        return { output: `copied: ${parsed.rest}` };
      }
      return copyFile(parsed.args[0], parsed.args[1], state, env, options);
    case 'mv':
      return moveFile(parsed.args[0], parsed.args[1], state, env, options);
    case 'ln':
      return linkFile(parsed.args[0], parsed.args[1], state, env, options);
    case 'cd':
      return changeDir(parsed.args[0], state);
    case 'tags':
      return await tagsOutput(parsed.args[0], env);
    case 'new':
      return await createNewPost(parsed, env, options);
    case 'upload':
      return await uploadPostImage(parsed.args, env, options);
    case 'sync':
      return await syncPostsAndAssets(env, options);
    case 'export': {
      const eq = parsed.rest.indexOf('=');
      if (eq < 0) return { output: 'Usage: export KEY=VALUE', status: 400 };
      const key = parsed.rest.slice(0, eq).trim();
      const value = parsed.rest.slice(eq + 1).trim();
      if (!state.envVars) state.envVars = {};
      state.envVars[key] = value;
      return { output: `exported ${key}=${value}` };
    }
    case 'echo':
      return { output: echoOutput(parsed.rest, state) };
    case 'pwd':
      return { output: state.cwd || '/' };
    case 'tree':
      return treePath(parsed.rest || '/', env);
    case 'find':
      return findPath(parsed.rest, env);
    case 'grep':
      return grepFiles(parsed.rest, env, options.inputData);
    case 'touch':
      return touchFile(parsed.rest, state, env, options);
    case 'rm':
      return removeFile(parsed.rest, state, env, options);
    case 'mkdir':
      return mkdirPath(parsed.args, options);
    case 'head':
      return headFile(parsed.args, state, env);
    case 'tail':
      return tailFile(parsed.args, state, env);
    case 'less':
      return lessFile(parsed.args, state, env);
    case 'source':
      return sourceFile(parsed.args[0], state, env, visibleContext, request, options);
    case 'env':
      return await envHandler(parsed.args, state, env, options);
    case 'logs':
      return logsOutput(parsed.args, state, options);
    case 'clpsh':
      return { output: 'clpsh: portfolio OS shell session active' };
    case 'sudo':
      return { output: 'Usage: sudo <command>', status: 400 };
    case 'su':
      return { output: 'Usage: su', status: 400 };
    case 'comment':
      return addComment(parsed.args, env);
    case 'date':
      return { output: new Date().toString() };
    case 'dark':
      state.config = mergeConfigDefaults(state.config);
      state.config.dark = true;
      await updateGuestShellRc(env, state.config);
      return { output: 'dark mode enabled' };
    case 'light':
      state.config = mergeConfigDefaults(state.config);
      state.config.dark = false;
      await updateGuestShellRc(env, state.config);
      return { output: 'light mode enabled' };
    case 'uptime':
      return { output: uptimeOutput(state) };
    case 'last':
      return { output: lastOutput(state, parsed.args[0]) };
    case 'ask': {
      const aiOptions = extractAiOptions(parsed.rest, state, options);
      parsed = parseCommand(`ask ${aiOptions.cleanRest}`);
      const simple = parsed.args.includes('--simple');
      const cleanRest = simple ? parsed.rest.replace('--simple', '').trim() : parsed.rest;
      const question = simple ? `Explain this simply and concisely, as if to a junior developer: ${cleanRest}` : cleanRest;
      if (!question) return { output: 'Question:', status: 200 };
      logSystemEvent(state, `ask: ${question.slice(0, 80)}`, true);
      return askAi(question, state, env, visibleContext, options.sessionId, aiOptions);
    }
    case 'explain': {
      const aiOptions = extractAiOptions(parsed.rest, state, options);
      parsed = parseCommand(`explain ${aiOptions.cleanRest}`);
      const simple = parsed.args.includes('--simple');
      const sid = options.sessionId;
      if (parsed.args[0] === '--simple' && parsed.args[1] === 'last') {
        const lastEntry = state.history.at(-2);
        if (!lastEntry) return { output: 'explain last: no previous command in history' };
        return explainWithAiOrFallback(env, state, visibleContext,
          `Explain what the previous terminal command "${lastEntry.command}" does and what its output likely means. Keep it dead simple — explain like I am a beginner.`,
          { sessionId: sid, source: 'explain-last', ...aiOptions },
        );
      }
      if (parsed.args[0] === 'last') {
        const lastEntry = state.history.at(-2);
        if (!lastEntry) return { output: 'explain last: no previous command in history' };
        const question = simple
          ? `Explain what the previous terminal command "${lastEntry.command}" does and what its output likely means. Keep it dead simple — explain like I am a beginner.`
          : `Explain what the previous terminal command "${lastEntry.command}" does and what its output likely means. Be concise and practical.`;
        return explainWithAiOrFallback(env, state, visibleContext, question, { sessionId: sid, source: 'explain-last', ...aiOptions });
      }
      return explainThing(parsed.args.filter(a => a !== '--simple'), state, env, visibleContext, sid, aiOptions);
    }
    case 'email':
      return emailDraft(parsed.args, parsed.rest);
    case 'book':
      return bookMeeting(parsed.args, parsed.rest, env);
    case 'curl':
      return curlUrl(parsed.rest);
    case 'ping':
      return pingHost(parsed.rest || 'pecunies.com');
    case 'traceroute':
      return tracerouteHost(parsed.rest || 'pecunies.com', request);
    case 'whois':
      return whoisSite(parsed.rest || 'pecunies.com');
    case 'trace':
      return traceHost(parsed.rest || 'pecunies.com', request);
    case 'doctor':
      return doctorDiagnostics(env, request);
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
    case 'session':
      return sessionOutput(state, env, request);
    case 'dig':
      return digHost(parsed.args);
    case 'edit':
      return editFile(parsed.args, state, env, options);
    case 'note':
      return noteHandler(parsed.args, state);
    case 'rag':
      return await ragHandler(parsed.args, state, env, options.sessionId);
    case 'config':
      return await configHandler(parsed.args, state, env);
    case 'alias':
      return aliasHandler(parsed.args, state);
    case 'unalias':
      return unaliasHandler(parsed.args, state);
    case 'set':
      return setVarHandler(parsed.args, state);
    case 'unset':
      return unsetVarHandler(parsed.args, state);
    default:
      return { output: `Unknown OS command "${parsed.name}". Try man ${parsed.name} or help.`, status: 404 };
  }
}

function parseCommand(command) {
  const normalized = command.replace(/^\//, '').replace(/^\.\//, '').trim();
  const [name = '', ...args] = splitShellArgs(normalized);
  const aliases = {
    log: 'logs',
  };
  const canonicalName = aliases[name.toLowerCase()] || name.toLowerCase();
  return {
    name: canonicalName,
    args,
    rest: normalized.slice(name.length).trim(),
  };
}

function splitShellArgs(input) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && quote !== "'") {
      escape = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function stripRedirection(commandText) {
  let quote = null;
  let escape = false;
  let redirectIndex = -1;
  let append = false;

  for (let i = 0; i < commandText.length; i++) {
    const ch = commandText[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && quote !== "'") {
      escape = true;
      continue;
    }

    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === '>') {
      redirectIndex = i;
      append = commandText[i + 1] === '>';
      if (append) i += 1;
    }
  }

  if (redirectIndex === -1) {
    return { command: commandText.trim(), target: null, append: false };
  }

  const opLength = append ? 2 : 1;
  const targetText = commandText.slice(redirectIndex + opLength).trim();

  if (!targetText || /\s/.test(targetText)) {
    return { command: commandText.trim(), target: null, append: false };
  }

  return {
    command: commandText.slice(0, redirectIndex).trim(),
    target: targetText,
    append,
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
    const commandWithOriginalQuoting = parsed.rest.replace(/^\S+\s*/, '').trim();
    return {
      password: parsed.args[0],
      command: commandWithOriginalQuoting,
    };
  }

  return {
    needsPassword: true,
    command: parsed.rest,
  };
}

function looksLikePassword(value) {
  return value.length >= 6 && !/^\[/.test(value);
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

async function catPath(path, state, env, options = {}) {
  if (!path) {
    return { output: 'Usage: cat <path>', status: 400 };
  }

  const normalized = normalizePath(path);

  // /root/ and /etc/ require elevated to read
  if ((normalized.startsWith('/root/') || normalized.startsWith('/etc/')) && !options.elevated) {
    return { output: `cat: ${normalized}: permission denied; use sudo`, status: 403 };
  }

  const file = await readFile(normalized, env, options);

  if (file === null || file === undefined) {
    return { output: `cat: ${path}: no such file`, status: 404 };
  }

  if (!state.reads.includes(normalized)) {
    state.reads.push(normalized);
  }

  if (options.pretty) {
    return { output: prettyPrint(file, normalized) };
  }

  return { output: renderTerminalFileContent(file, normalized) };
}

async function askAi(question, state, env, visibleContext, sessionId, aiOptions = {}) {
  if (!question) {
    return { output: 'Question:', status: 200 };
  }

  if (!env.AI) {
    return { output: 'Workers AI binding is not configured.', status: 500 };
  }

  const answer = await runAi(env, question, state, visibleContext, { sessionId, source: 'ask', ...aiOptions });
  return { output: answer };
}

async function explainThing(args, state, env, visibleContext, sessionId, aiOptions = {}) {
  const [kind = 'project', ...rest] = args;
  const target = rest.join(' ').trim();
  const normalizedKind = kind.toLowerCase();

  if (normalizedKind === 'project') {
    return explainProject(target, state, env, visibleContext, sessionId, aiOptions);
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
      { sessionId, source: 'explain-command', ...aiOptions },
    );
  }

  if (normalizedKind === 'skill') {
    return explainWithAiOrFallback(
      env,
      state,
      visibleContext,
      `Explain Chris Pecunies' skill area "${target || 'cloud and systems engineering'}" using the supplied resume and app context.`,
      { sessionId, source: 'explain-skill', ...aiOptions },
    );
  }

  if (normalizedKind === 'work') {
    return explainWithAiOrFallback(
      env,
      state,
      visibleContext,
      `Explain Chris Pecunies' work-history entry "${target || 'overall experience'}" using the supplied resume context.`,
      { sessionId, source: 'explain-work', ...aiOptions },
    );
  }

  if (normalizedKind === 'education') {
    return explainWithAiOrFallback(
      env,
      state,
      visibleContext,
      'Explain Chris Pecunies education background and how it connects to the software portfolio.',
      { sessionId, source: 'explain-education', ...aiOptions },
    );
  }

  return { output: 'Usage: explain <project|skill|work|education|command> [name]', status: 400 };
}

async function explainProject(projectName, state, env, visibleContext, sessionId, aiOptions = {}) {
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
    { sessionId, source: 'explain-project', ...aiOptions },
  );
}

async function explainWithAiOrFallback(env, state, visibleContext, question, meta = {}) {
  if (!env.AI) {
    return { output: question, mode: 'chat' };
  }

  const answer = await runAi(env, question, state, visibleContext, {
    sessionId: meta.sessionId,
    source: meta.source ?? 'explain',
  });
  return { output: answer, mode: 'chat' };
}

function extractAiOptions(rest, state, options = {}) {
  let clean = String(rest || '');
  let model = String(options.model || state.config?.ai_model || MODEL).trim();
  let system = String(options.systemPrompt || state.config?.system_prompt || '').trim().slice(0, 1200);

  clean = clean.replace(/--model=(?:"([^"]+)"|'([^']+)'|(\S+))/g, (_m, a, b, c) => {
    model = String(a || b || c || model).trim();
    return '';
  });
  clean = clean.replace(/--system=(?:"([^"]*)"|'([^']*)'|(\S+))/g, (_m, a, b, c) => {
    system = String(a ?? b ?? c ?? '').trim().slice(0, 1200);
    return '';
  });

  if (!isValidAiModel(model)) {
    model = MODEL;
  }

  return {
    cleanRest: clean.replace(/\s+/g, ' ').trim(),
    model,
    system,
  };
}

async function runAi(env, question, state, visibleContext, meta = {}) {
  const sessionId = meta.sessionId ?? 'anonymous';
  const source = meta.source ?? 'os';
  const activeModel = isValidAiModel(meta.model) ? meta.model : MODEL;
  const systemInjection = String(meta.system || '').trim().slice(0, 1200);
  logSystemEvent(
    state,
    `ai invoke: source=${source} model=${activeModel} session=${sessionId} promptChars=${String(question || '').length}`,
    true,
  );
  const readContext = state.reads.map((path) => `${path}\n${FILES[path]}`).join('\n\n') || '(no files read yet)';
  const commandContext = state.history
    .slice(-20)
    .map((entry) => `${entry.at}: ${entry.command}`)
    .join('\n');
  const ragContext = Array.isArray(state.ragContext)
    ? state.ragContext.slice(-20).map((entry) => `${entry.at}: ${entry.text}`).join('\n')
    : '';
  const metrics = await readMetrics(env);
  const leaderboard = await readLeaderboard(env);
  const ragKnowledge = await gatherRagKnowledge(question, state, env, sessionId, metrics);
  const appContext = Object.entries(MANUALS)
    .map(([name, manual]) => `${name}: ${manual}`)
    .join('\n\n');

  const persistentContext = JSON.stringify({
    config: mergeConfigDefaults(state.config),
    cwd: state.cwd,
    rootActive: hasRoot(state),
    reads: state.reads,
  }).slice(0, 2500);

  const userContent = `Profile:\n${PROFILE_CONTEXT}\n\nFull terminal app command context:\n${appContext}\n\nPersistent session/app state:\n${persistentContext}\n\nPersistent RAG/session context notes:\n${ragContext || '(none)'}\n\nRetrieved RAG memory (session + state + metrics + AI search + Vectorize):\n${ragKnowledge || '(none)'}\n\nMetrics state:\n${JSON.stringify(metrics).slice(0, 3000)}\n\nLeaderboard state:\n${JSON.stringify(leaderboard).slice(0, 2000)}\n\nFiles read by user:\n${readContext}\n\nRecent commands:\n${commandContext}\n\nVisible terminal context:\n${visibleContext}\n\nQuestion:\n${question}`;

  try {
    const result = await env.AI.run(activeModel, {
      messages: [
        {
          role: 'system',
          content:
            `You are a concise terminal AI for Chris Pecunies portfolio. Use only the supplied profile, file, visible, session, metrics, leaderboard, and command-history context. If unknown, say so.${systemInjection ? `\n\nSession system prompt injection:\n${systemInjection}` : ''}`,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    const out =
      typeof result?.response === 'string' ? result.response : 'No text response returned by Workers AI.';

    await appendAiLog(env, {
      source,
      sessionId,
      query: question,
      contextExcerpt: userContent,
      response: out,
      model: activeModel,
    });
    logSystemEvent(
      state,
      `ai success: source=${source} model=${activeModel} session=${sessionId} responseChars=${out.length}`,
      true,
    );
    await persistRagMemory(env, sessionId, `Q: ${String(question || '').slice(0, 1200)}\nA: ${String(out || '').slice(0, 2400)}`, {
      source: 'ai-chat',
      model: activeModel,
    });
    await upsertVectorMemory(env, `Q: ${String(question || '').slice(0, 900)}\nA: ${String(out || '').slice(0, 1500)}`, {
      sessionId,
      source: 'ai-chat',
      model: activeModel,
      at: new Date().toISOString(),
    });

    return out;
  } catch (err) {
    await appendAiLog(env, {
      source,
      sessionId,
      query: question,
      contextExcerpt: userContent,
      error: err instanceof Error ? err.message : String(err),
      model: activeModel,
    });
    logSystemEvent(
      state,
      `ai error: source=${source} model=${activeModel} session=${sessionId} message=${String(err instanceof Error ? err.message : err).slice(0, 140)}`,
      true,
    );
    throw err;
  }
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

function tracerouteHost(host, request) {
  const url = normalizeUrl(host);
  const target = new URL(url);
  const cf = request.cf ?? {};
  const hops = [
    ['router.local', 0.3, 0.7],
    [`${cf.colo ?? 'edge'}-cf-gw`, 2.8, 5.9],
    ['portfolio-worker', 6.2, 12.5],
    [target.host, 16.5, 34.2],
  ];
  const lines = [`traceroute to ${target.host} (${target.host}), ${hops.length} hops max`];

  hops.forEach((hop, index) => {
    const [name, min, max] = hop;
    const p1 = (Math.random() * (max - min) + min).toFixed(3);
    const p2 = (Math.random() * (max - min) + min).toFixed(3);
    const p3 = (Math.random() * (max - min) + min).toFixed(3);
    lines.push(`${String(index + 1).padStart(2, ' ')}  ${String(name).padEnd(24, ' ')}  ${p1} ms  ${p2} ms  ${p3} ms`);
  });

  return { output: lines.join('\n') };
}

async function whoisSite(rawHost) {
  const url = normalizeUrl(rawHost);
  const host = new URL(url).host.toLowerCase();
  const lines = [`WHOIS ${host}`];

  try {
    const dns = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`, {
      signal: AbortSignal.timeout(4500),
    }).then((res) => res.json());
    const answers = Array.isArray(dns?.Answer) ? dns.Answer : [];
    const ips = answers.map((a) => String(a?.data || '').trim()).filter(Boolean);
    if (ips.length) {
      lines.push(`A: ${ips.slice(0, 4).join(', ')}`);
    } else {
      lines.push('A: (none returned)');
    }
  } catch {
    lines.push('A: lookup failed');
  }

  try {
    const rdap = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, {
      signal: AbortSignal.timeout(5500),
      headers: { Accept: 'application/rdap+json, application/json' },
    });
    if (rdap.ok) {
      const data = await rdap.json();
      const handle = String(data?.handle || data?.ldhName || host);
      const registrar = Array.isArray(data?.entities)
        ? data.entities.find((e) => Array.isArray(e?.roles) && e.roles.includes('registrar'))
        : null;
      const registrarName = String(
        registrar?.vcardArray?.[1]?.find?.((x) => Array.isArray(x) && x[0] === 'fn')?.[3] || '',
      ).trim();
      const events = Array.isArray(data?.events) ? data.events : [];
      const reg = events.find((e) => e?.eventAction === 'registration')?.eventDate;
      const exp = events.find((e) => e?.eventAction === 'expiration')?.eventDate;
      lines.push(`Domain: ${handle}`);
      if (registrarName) lines.push(`Registrar: ${registrarName}`);
      if (reg) lines.push(`Registered: ${String(reg).slice(0, 10)}`);
      if (exp) lines.push(`Expires: ${String(exp).slice(0, 10)}`);
    } else {
      lines.push(`RDAP: unavailable (${rdap.status})`);
    }
  } catch {
    lines.push('RDAP: lookup failed');
  }

  return { output: lines.join('\n') };
}

async function doctorDiagnostics(env, request) {
  const checks = [];
  const record = (label, ok, detail) => {
    checks.push(`${ok ? 'ok' : 'fail'}  ${label}${detail ? ` — ${detail}` : ''}`);
  };

  record('Workers AI binding', Boolean(env.AI), env.AI ? 'configured' : 'missing');
  record('KV binding (PORTFOLIO_OS)', Boolean(env.PORTFOLIO_OS), env.PORTFOLIO_OS ? 'configured' : 'missing');
  record('D1 binding', Boolean(env.DB || env.POSTS_DB), env.DB || env.POSTS_DB ? 'configured' : 'missing');
  record('R2 posts bucket', Boolean(env.POSTS || env.POSTS_BUCKET), env.POSTS || env.POSTS_BUCKET ? 'configured' : 'missing');
  record('R2 static bucket', Boolean(env.STATIC), env.STATIC ? 'configured' : 'missing');
  record('Vectorize binding', Boolean(getVectorIndex(env)), getVectorIndex(env) ? 'configured' : 'missing');

  try {
    const res = await fetch('https://pecunies.com', { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    record('External reachability', res.ok, `pecunies.com ${res.status}`);
  } catch {
    record('External reachability', false, 'request failed');
  }

  try {
    const dns = await fetch('https://dns.google/resolve?name=cloudflare.com&type=A', {
      signal: AbortSignal.timeout(4000),
    }).then((res) => res.json());
    const ok = Array.isArray(dns?.Answer) && dns.Answer.length > 0;
    record('DNS resolution', ok, ok ? 'cloudflare.com resolved' : 'no A answers');
  } catch {
    record('DNS resolution', false, 'lookup failed');
  }

  const cf = request.cf ?? {};
  const region = [cf.city, cf.region, cf.country].filter(Boolean).join(', ') || 'unknown';
  record('Edge context', true, `${cf.colo || 'n/a'} · ${region}`);

  return { output: `Doctor diagnostics\n\n${checks.join('\n')}` };
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

async function grepFiles(query, env, inputData) {
  const needle = String(query || '').toLowerCase();

  if (!needle) {
    return { output: 'Usage: grep <query>', status: 400 };
  }

  // If inputData is provided (from pipe), search that instead of files
  if (inputData) {
    const lines = String(inputData).split('\n');
    const matches = lines
      .map((line, index) => ({ line, number: index + 1 }))
      .filter((entry) => entry.line.toLowerCase().includes(needle))
      .map((entry) => `stdin:${entry.number}: ${entry.line}`);
    return { output: matches.join('\n') || `grep: no matches for "${query}"` };
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

  /* Refuse to remove the root filesystem */
  if (normalized === '/' || normalized === '') {
    return { output: 'rm: refusing to operate on / — this is a simulated filesystem', status: 403 };
  }

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

  const path = await resolvePostIdentifierToPath(post, env);

  if (!path) {
    return { output: `comment: no post matching "${post}"`, status: 404 };
  }

  const db = env.POSTS_DB || env.DB || null;
  const savedComment = {
    name: name.slice(0, 60),
    message: message.slice(0, 1200),
    at: new Date().toISOString(),
  };

  if (db) {
    await recordPostEvent(env, path, 'message', {
      name: savedComment.name,
      message: savedComment.message,
      kind: 'comment',
    });
    return { output: `comment added to ${path}` };
  }

  if (!env.PORTFOLIO_OS) {
    return { output: 'comment: storage unavailable', status: 500 };
  }

  const key = `comments:${path}`;
  const comments = (await env.PORTFOLIO_OS.get(key, { type: 'json' })) ?? [];
  comments.push({ ...savedComment });
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
  const mirrorPath = postMirrorPath(path);
  if (mirrorPath) {
    await env.PORTFOLIO_OS.put(userFileKey(mirrorPath), next);
  }
  const canonicalPostPath = canonicalPostPathForStorage(path);
  if (canonicalPostPath && canonicalPostPath.toLowerCase().endsWith('.md')) {
    await syncPostToStorage(env, canonicalPostPath, next);
  } else if (canonicalPostPath) {
    await syncAssetToStorage(env, canonicalPostPath, next);
  } else {
    const staticBucket = env.STATIC || null;
    if (staticBucket) {
      await staticBucket.put(`fs${path}`, next, {
        httpMetadata: { contentType: 'text/plain; charset=utf-8' },
        customMetadata: { path },
      });
    }
  }
  return { output: `${options.createOnly ? 'touched' : 'wrote'} ${path}` };
}

async function readFile(path, env, options = {}) {
  // Intercept log files to return dynamic content from state
  if (path === '/var/log/system.log') {
    if (!options.elevated) return 'permission denied; use sudo cat /var/log/system.log';
    return Array.isArray(options.logEntries) ? options.logEntries.join('\n') || '(no log entries)' : '';
  }
  if (path === '/var/log/ai.log') {
    if (!options.elevated) return 'permission denied; use sudo cat /var/log/ai.log';
    return readAiLogText(env);
  }
  if (path === '/var/log/system_public.log') {
    return Array.isArray(options.publicLogEntries) ? options.publicLogEntries.join('\n') || '(no public log entries)' : '';
  }
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
  const primary = await env.PORTFOLIO_OS.get(userFileKey(path));
  if (primary !== null && primary !== undefined) {
    return primary;
  }
  const mirror = postMirrorPath(path);
  if (mirror) {
    const mirrored = await env.PORTFOLIO_OS.get(userFileKey(mirror));
    if (mirrored !== null && mirrored !== undefined) {
      return mirrored;
    }
  }
  const staticBucket = env.STATIC || null;
  if (staticBucket) {
    const obj = await staticBucket.get(`fs${path}`);
    if (obj) {
      return await obj.text();
    }
  }
  return null;
}

async function deleteUserFile(env, path) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  await env.PORTFOLIO_OS.delete(userFileKey(path));
  const mirrorPath = postMirrorPath(path);
  if (mirrorPath) {
    await env.PORTFOLIO_OS.delete(userFileKey(mirrorPath));
  }
  const canonicalPostPath = canonicalPostPathForStorage(path);
  if (canonicalPostPath && canonicalPostPath.toLowerCase().endsWith('.md')) {
    await deletePostFromStorage(env, canonicalPostPath);
  } else {
    const staticBucket = env.STATIC || null;
    if (staticBucket) {
      await staticBucket.delete(`fs${path}`);
    }
  }
}

function canonicalPostPathForStorage(path) {
  const normalized = normalizePath(path);
  if (normalized.startsWith('/posts/') || normalized.startsWith('/assets/posts/')) {
    return assetPathToPostPath(normalized);
  }
  return null;
}

function postMirrorPath(path) {
  const normalized = normalizePath(path);
  if (normalized.startsWith('/posts/')) {
    return postPathToAssetPath(normalized);
  }
  if (normalized.startsWith('/assets/posts/')) {
    return assetPathToPostPath(normalized);
  }
  return null;
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
  if (path.startsWith('/home/') || path.startsWith('/guest/') || path.startsWith('/tmp/')) {
    return true;
  }

  if (elevated && (path.startsWith('/posts/') || path.startsWith('/assets/posts/') || path.startsWith('/resume/') || path.startsWith('/projects/') || path.startsWith('/system/') || path.startsWith('/bin/') || path.startsWith('/root/') || path.startsWith('/etc/') || path.startsWith('/usr/') || path.startsWith('/opt/'))) {
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
    path.startsWith('/assets/posts/') ||
    path.startsWith('/resume/') ||
    path.startsWith('/projects/') ||
    path.startsWith('/system/') ||
    path.startsWith('/bin/') ||
    path.startsWith('/var/') ||
    path.startsWith('/root/') ||
    path.startsWith('/etc/') ||
    path.startsWith('/usr/') || path === '/usr' ||
    path.startsWith('/opt/') || path === '/opt' ||
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
  await recordBookingEvent(env, { email, date, time, duration, message, meetLink });
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

function formatUptimeDuration(ms) {
  const totalSeconds = Math.max(1, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function uptimeOutput(state) {
  const now = new Date();
  const firstEvent = state.history[0]?.at ? Date.parse(state.history[0].at) : NaN;
  const fallback = Date.now() - (3 * 60 * 60 + 27 * 60) * 1000;
  const bootMs = Number.isFinite(firstEvent) ? firstEvent : fallback;
  const upFor = Math.max(1000, Date.now() - bootMs);
  const users = 1;
  const load1 = (Math.random() * 0.8 + 0.08).toFixed(2);
  const load5 = (Math.random() * 0.6 + 0.05).toFixed(2);
  const load15 = (Math.random() * 0.4 + 0.04).toFixed(2);
  return `${now.toTimeString().slice(0, 8)} up ${formatUptimeDuration(upFor)}, ${users} user, load averages: ${load1} ${load5} ${load15}`;
}

function lastOutput(state, rawLimit) {
  const limit = Math.min(Math.max(Number.parseInt(String(rawLimit ?? ''), 10) || 10, 1), 50);
  const rows = state.history
    .slice(-limit)
    .reverse()
    .map((entry) => {
      const at = new Date(entry.at || Date.now());
      const datePart = at.toDateString().slice(0, 10);
      const timePart = at.toTimeString().slice(0, 5);
      const cmd = String(entry.command || '').slice(0, 36);
      return `guest    ttys000  edge-gateway  ${datePart} ${timePart}   still logged in   (${cmd})`;
    });
  return rows.length ? rows.join('\n') : 'wtmp begins: no session history yet';
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

async function seedTagsToDb(env) {
  const db = env.POSTS_DB || env.DB || null;
  if (!db) {
    return;
  }
  for (const [slug, items] of Object.entries(TAGS)) {
    await upsertTagWithItems(db, slug, items, 'system');
  }
}

async function mergeTagRegistryWithPosts(env) {
  const merged = { ...TAGS };
  const db = env.POSTS_DB || env.DB || null;
  if (db) {
    try {
      const rows = await db.prepare('SELECT t.slug, ti.label, ti.type, ti.command FROM tags t JOIN tag_items ti ON t.slug = ti.tag_slug').all();
      for (const row of rows?.results ?? []) {
        const slug = String(row?.slug || '').toLowerCase().trim();
        if (!slug) {
          continue;
        }
        if (!merged[slug]) {
          merged[slug] = [];
        }
        const item = { label: String(row.label || ''), type: String(row.type || ''), command: String(row.command || '') };
        const exists = merged[slug].some((e) => e.command === item.command);
        if (!exists) {
          merged[slug].push(item);
        }
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const posts = await collectAllPosts(env);
    for (const p of posts) {
      for (const raw of p.tags || []) {
        const t = String(raw).toLowerCase().trim();
        if (!t) {
          continue;
        }
        if (!merged[t]) {
          merged[t] = [];
        }
        const item = { label: p.title, type: 'post', command: `post open ${p.slug}` };
        const exists = merged[t].some((e) => e.command === item.command);
        if (!exists) {
          merged[t].push(item);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return merged;
}

async function resolvePostIdentifierToPath(identifier, env) {
  const raw = String(identifier).trim();
  if (raw.startsWith('/posts/') && raw.endsWith('.md')) {
    const n = normalizePath(raw);
    if (await fileExists(n, env)) {
      return n;
    }
  }
  const slug = raw.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 160);
  const flat = `/posts/${slug.split('/').pop()}.md`;
  if (await fileExists(flat, env)) {
    return flat;
  }
  const all = await listUserFiles(env);
  const hits = all.filter(
    (p) =>
      p.startsWith('/posts/') &&
      (p === `/posts/${slug}.md` || p.endsWith(`/${slug}.md`) || p.split('/').pop()?.replace(/\.md$/i, '') === slug.split('/').pop()),
  );
  if (hits.length === 1) {
    return hits[0];
  }
  return null;
}

function parseNewPostFlags(rest) {
  const flags = { title: '', tags: '', description: '', body: '' };
  let s = rest.trim();
  let guard = 0;
  while (guard++ < 64) {
    let m = s.match(/^--(title|tags|description)="([^"]*)"\s*/);
    if (m) {
      flags[m[1]] = m[2];
      s = s.slice(m[0].length).trim();
      continue;
    }
    m = s.match(/^--(title|tags|description)='([^']*)'\s*/);
    if (m) {
      flags[m[1]] = m[2];
      s = s.slice(m[0].length).trim();
      continue;
    }
    m = s.match(/^--(title|tags|description)=(\S+)\s*/);
    if (m) {
      flags[m[1]] = m[2];
      s = s.slice(m[0].length).trim();
      continue;
    }
    break;
  }
  flags.body = s.trim();
  return flags;
}

function normalizePostTags(raw) {
  return String(raw || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .map((tag) => tag.replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean);
}

function slugifyPostTitle(title) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 96) || 'post'
  );
}

function yamlEscapeLine(s) {
  return String(s).replace(/"/g, '\\"');
}

async function createNewPost(parsed, env, options) {
  if ((parsed.args[0] || '').toLowerCase() !== 'post') {
    return {
      output: 'Usage: new post --title=<title> --tags=<a,b> [--description=<text>] <body markdown>',
      status: 400,
    };
  }
  const postCreationMode = String(env.POST_CREATION_MODE || 'sudo').trim().toLowerCase();
  const requiresAdmin = postCreationMode !== 'open';
  if (requiresAdmin && !options.elevated) {
    return {
      output:
        'new post: admin mode required for /posts writes. Use sudo new post … (or su), or set POST_CREATION_MODE=open for local development.',
      status: 403,
    };
  }
  const rest = parsed.rest.replace(/^post\b/i, '').trim();
  const flags = parseNewPostFlags(rest);
  if (!flags.title) {
    return { output: 'new post: --title= is required', status: 400 };
  }
  const tags = normalizePostTags(flags.tags);
  if (!tags.length) {
    return { output: 'new post: --tags= is required (comma-separated list)', status: 400 };
  }
  const body = String(flags.body || '').trim();
  if (!body) {
    return { output: 'new post: markdown body is required', status: 400 };
  }
  const description = String(flags.description || '').trim();
  if (!description) {
    return { output: 'new post: --description= is required', status: 400 };
  }

  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dateStr = `${y}-${mo}-${d}`;
  let baseSlug = slugifyPostTitle(flags.title);
  let relPath = `/posts/${y}/${mo}/${d}/${baseSlug}.md`;
  let n = 2;
  while (await readUserFile(env, relPath)) {
    relPath = `/posts/${y}/${mo}/${d}/${baseSlug}-${n}.md`;
    n += 1;
  }

  const md = `---
title: "${yamlEscapeLine(flags.title)}"
date: ${dateStr}
tags: ${tags.join(', ')}
description: "${yamlEscapeLine(description)}"
---

# ${flags.title}

${body}
`;

  const write = await writeUserFile(env, {}, relPath, md, { elevated: true });
  if (write.status && write.status >= 400) {
    return write;
  }
  const slug = relPath.split('/').pop()?.replace(/\.md$/i, '') ?? 'post';
  return { output: `created ${relPath}\nRun posts or post open ${slug} to view.` };
}

async function uploadPostImage(args, env, options = {}) {
  const [kind = '', postRef = '', imageUrl = '', ...altParts] = args;
  if (kind.toLowerCase() !== 'image' || !postRef || !imageUrl) {
    return {
      output: 'Usage: upload image <post-slug|/posts/path.md> <https://image-url> [alt text]',
      status: 400,
    };
  }

  const postCreationMode = String(env.POST_CREATION_MODE || 'sudo').trim().toLowerCase();
  const requiresAdmin = postCreationMode !== 'open';
  if (requiresAdmin && !options.elevated) {
    return {
      output:
        'upload: admin mode required for post assets. Use sudo upload image … (or su), or set POST_CREATION_MODE=open for local development.',
      status: 403,
    };
  }

  const resolvedPostPath = await resolvePostIdentifierToPath(postRef, env);
  if (!resolvedPostPath) {
    return { output: `upload: post "${postRef}" not found`, status: 404 };
  }

  let source;
  try {
    source = new URL(imageUrl);
  } catch {
    return { output: 'upload: image URL is invalid', status: 400 };
  }

  const response = await fetch(source.toString());
  if (!response.ok) {
    return { output: `upload: failed to fetch image (${response.status})`, status: 400 };
  }
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('image/')) {
    return { output: `upload: remote content is not an image (${contentType || 'unknown'})`, status: 400 };
  }
  const binary = await response.arrayBuffer();
  const extGuess = contentType.includes('png')
    ? 'png'
    : contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : contentType.includes('svg')
            ? 'svg'
            : 'bin';
  const postSlug = resolvedPostPath.split('/').pop()?.replace(/\.md$/i, '') || 'post';
  const sourceName = source.pathname.split('/').pop() || '';
  const sourceStem = sourceName.replace(/\.[a-z0-9]+$/i, '') || `image-${Date.now()}`;
  const safeStem = sourceStem.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'image';
  const ext = (sourceName.split('.').pop() || extGuess).toLowerCase().replace(/[^a-z0-9]/g, '') || extGuess;
  const directory = resolvedPostPath.slice(0, resolvedPostPath.lastIndexOf('/'));
  const assetPath = postPathToAssetPath(`${directory}/${postSlug}-${safeStem}.${ext}`);

  if (env.PORTFOLIO_OS) {
    await env.PORTFOLIO_OS.put(userFileKey(assetPath), binary);
  }
  await syncAssetToStorage(env, assetPathToPostPath(assetPath), binary);

  const currentMarkdown = await readUserFile(env, resolvedPostPath);
  if (typeof currentMarkdown !== 'string') {
    return { output: `upload: could not read post ${resolvedPostPath} for markdown update`, status: 500 };
  }
  const alt = altParts.join(' ').trim() || safeStem.replace(/[-_]+/g, ' ');
  const imageLine = `![${alt}](${assetPath})`;
  const nextMarkdown = `${currentMarkdown.trimEnd()}\n\n${imageLine}\n`;
  const write = await writeUserFile(env, {}, resolvedPostPath, nextMarkdown, { elevated: true });
  if (write.status && write.status >= 400) {
    return write;
  }

  return {
    output: `uploaded ${assetPath}\nlinked in ${resolvedPostPath}`,
  };
}

async function syncPostsAndAssets(env, options = {}) {
  const hasDb = Boolean(env.POSTS_DB || env.DB);
  const hasBucket = Boolean(env.POSTS_BUCKET || env.POSTS);
  const postCreationMode = String(env.POST_CREATION_MODE || 'sudo').trim().toLowerCase();
  const requiresAdmin = postCreationMode !== 'open';
  if (requiresAdmin && !options.elevated) {
    return {
      output:
        'sync: admin mode required for content sync. Use sudo sync (or su), or set POST_CREATION_MODE=open for local development.',
      status: 403,
    };
  }
  if (!hasDb && !hasBucket) {
    return {
      output: 'sync: no storage bindings configured (POSTS_DB|DB and POSTS_BUCKET|POSTS missing).',
      status: 500,
    };
  }

  const allPaths = new Set(Object.keys(FILES));
  const userPaths = await listUserFiles(env);
  for (const p of userPaths) allPaths.add(p);

  const postTargets = new Map();
  const assetTargets = new Set();

  for (const path of allPaths) {
    const normalized = normalizePath(path);
    if (normalized.startsWith('/posts/') && normalized.toLowerCase().endsWith('.md')) {
      postTargets.set(assetPathToPostPath(normalized), normalized);
      continue;
    }
    if (normalized.startsWith('/assets/posts/')) {
      if (normalized.toLowerCase().endsWith('.md')) {
        postTargets.set(assetPathToPostPath(normalized), normalized);
      } else {
        assetTargets.add(normalized);
      }
    }
  }

  let syncedPosts = 0;
  let syncedAssets = 0;
  const failures = [];

  for (const [canonicalPath, sourcePath] of postTargets.entries()) {
    try {
      const markdown = await readFile(sourcePath, env, { elevated: true });
      if (typeof markdown !== 'string' || !markdown.trim()) {
        continue;
      }
      await syncPostToStorage(env, canonicalPath, markdown);
      syncedPosts += 1;
    } catch (error) {
      failures.push(`post ${canonicalPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const assetPath of assetTargets) {
    try {
      const content = await readFile(assetPath, env, { elevated: true });
      if (content === null || content === undefined) {
        continue;
      }
      await syncAssetToStorage(env, assetPathToPostPath(assetPath), content);
      syncedAssets += 1;
    } catch (error) {
      failures.push(`asset ${assetPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const lines = [
    `sync complete`,
    `posts: ${syncedPosts}`,
    `assets: ${syncedAssets}`,
  ];
  if (failures.length) {
    lines.push(`failures: ${failures.length}`);
    lines.push(...failures.slice(0, 8));
    return { output: lines.join('\n'), status: 500 };
  }
  return { output: lines.join('\n') };
}

async function tagsOutput(tagFilter, env) {
  await seedTagsToDb(env).catch(() => {});
  const REG = await mergeTagRegistryWithPosts(env);
  const keys = Object.keys(REG);
  if (!tagFilter) {
    const lines = keys.sort().map((tag) => `${tag.padEnd(16)} (${REG[tag].length} items)`);
    return { output: lines.join('\n') || '(no tags)' };
  }
  const needle = tagFilter.toLowerCase();
  const matchingKeys = keys.filter((k) => k === needle || k.includes(needle));
  if (!matchingKeys.length) {
    return {
      output: `No tags matching "${tagFilter}". Run tags with no argument to list all tags.`,
    };
  }
  const merged = [];
  const seen = new Set();
  for (const k of matchingKeys.sort()) {
    for (const item of REG[k]) {
      const id = `${item.label}|${item.command}`;
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(item);
      }
    }
  }
  const header =
    matchingKeys.length > 1 ? `Tags matched: ${matchingKeys.join(', ')}\n\n` : '';
  const body = merged.map((e) => `  ${e.type.padEnd(8)} ${e.label}  →  ${e.command}`).join('\n');
  return { output: `${header}${body}` };
}

function changeDir(path, state) {
  if (!path || path === '~') {
    state.cwd = userHomePath(state);
    return { output: '' };
  }
  if (path === '/') {
    state.cwd = '/';
    return { output: '' };
  }
  if (path === '..') {
    const parts = (state.cwd || '/').split('/').filter(Boolean);
    parts.pop();
    state.cwd = '/' + parts.join('/') || '/';
    return { output: '' };
  }
  if (path === '-') {
    const prev = state.previousCwd || '/';
    state.previousCwd = state.cwd;
    state.cwd = prev;
    return { output: '' };
  }
  const base = (state.cwd || '/').replace(/\/$/, '');
  const target = path.startsWith('/') ? normalizePath(path) : normalizePath(`${base}/${path}`);
  if (DIRECTORIES[target]) {
    state.previousCwd = state.cwd || '/';
    state.cwd = target;
    return { output: '' };
  }
  return { output: `cd: ${path}: no such directory`, status: 404 };
}

async function copyFile(src, dest, state, env, options = {}) {
  if (!src || !dest) return { output: 'Usage: cp <source> <destination>', status: 400 };
  const srcPath = normalizePath(src);
  const destPath = normalizePath(dest);
  const content = await readFile(srcPath, env);
  if (content === null || content === undefined) return { output: `cp: ${src}: no such file`, status: 404 };
  const allowed = ['/home/', '/guest/', '/tmp/'];
  const inAllowed = allowed.some(p => destPath.startsWith(p));
  if (!inAllowed && !options.elevated) return { output: `cp: ${destPath}: permission denied; use sudo`, status: 403 };
  if (FILES[destPath] || DIRECTORIES[destPath]) {
    if (!options.force) return { output: `cp: ${destPath}: file exists (use -f to force)`, status: 400 };
  }
  FILES[destPath] = content;
  const parentDir = destPath.substring(0, destPath.lastIndexOf('/')) || '/';
  if (DIRECTORIES[parentDir] && !DIRECTORIES[parentDir].some(e => e.replace(/\/$/, '') === destPath.split('/').pop())) {
    DIRECTORIES[parentDir].push(destPath.split('/').pop());
  }
  return { output: `copied ${srcPath} → ${destPath}` };
}

async function moveFile(src, dest, state, env, options = {}) {
  if (!src || !dest) return { output: 'Usage: mv <source> <destination>', status: 400 };
  const srcPath = normalizePath(src);
  const destPath = normalizePath(dest);
  const content = await readFile(srcPath, env);
  if (content === null || content === undefined) return { output: `mv: ${src}: no such file`, status: 404 };
  const protectedPaths = ['/bin/', '/var/', '/root/', '/CHANGELOG.md', '/README.md', '/system/', '/etc/'];
  const isProtected = protectedPaths.some(p => srcPath.startsWith(p) || srcPath === p.replace(/\/$/, ''));
  if (isProtected && !options.elevated) return { output: `mv: ${srcPath}: permission denied; use sudo`, status: 403 };
  const newAllowed = ['/home/', '/guest/', '/tmp/'];
  const destAllowed = newAllowed.some(p => destPath.startsWith(p));
  if (!destAllowed && !options.elevated) return { output: `mv: ${destPath}: permission denied; use sudo`, status: 403 };
  FILES[destPath] = content;
  delete FILES[srcPath];
  const srcDir = srcPath.substring(0, srcPath.lastIndexOf('/')) || '/';
  if (DIRECTORIES[srcDir]) {
    DIRECTORIES[srcDir] = DIRECTORIES[srcDir].filter(e => e.replace(/\/$/, '') !== srcPath.split('/').pop());
  }
  const destDir = destPath.substring(0, destPath.lastIndexOf('/')) || '/';
  const fileName = destPath.split('/').pop();
  if (DIRECTORIES[destDir] && !DIRECTORIES[destDir].includes(fileName)) {
    DIRECTORIES[destDir].push(fileName);
  }
  return { output: `moved ${srcPath} → ${destPath}` };
}

async function linkFile(src, dest, state, env, options = {}) {
  if (!src || !dest) return { output: 'Usage: ln [-s] <source> <destination>', status: 400 };
  const symlink = options.symlink !== false;
  const srcPath = normalizePath(src);
  const destPath = normalizePath(dest);
  if (!FILES[srcPath] && !DIRECTORIES[srcPath]) return { output: `ln: ${src}: no such file or directory`, status: 404 };
  const allowed = ['/home/', '/guest/', '/tmp/'];
  const inAllowed = allowed.some(p => destPath.startsWith(p));
  if (!inAllowed && !options.elevated) return { output: `ln: ${destPath}: permission denied; use sudo`, status: 403 };
  FILES[destPath] = symlink ? `→ ${srcPath}` : (FILES[srcPath] || `(dir: ${srcPath})`);
  const destDir = destPath.substring(0, destPath.lastIndexOf('/')) || '/';
  if (DIRECTORIES[destDir] && !DIRECTORIES[destDir].includes(destPath.split('/').pop())) {
    DIRECTORIES[destDir].push(destPath.split('/').pop());
  }
  return { output: `linked ${destPath} → ${srcPath}${symlink ? ' (symbolic)' : ''}` };
}

function expandEnvVars(text, state) {
  if (!text) return '';
  const envVars = state.envVars || {};
  return text.replace(/\$\{?(\w+)\}?/g, (match, name) => {
    if (name === '?') return String(typeof process !== 'undefined' ? process.exitCode ?? 0 : 0);
    if (name === 'PWD') return state.cwd || '/';
    if (name === 'HOME') return userHomePath(state);
    if (name === 'USER') return sanitizeUsername(mergeConfigDefaults(state.config).name);
    return envVars[name] ?? '';
  });
}

function echoOutput(rest, state) {
  const words = parseEchoWords(rest, state);
  let newline = true;
  let escapes = false;
  let index = 0;

  while (index < words.length && /^-[neE]+$/.test(words[index])) {
    for (const ch of words[index].slice(1)) {
      if (ch === 'n') newline = false;
      if (ch === 'e') escapes = true;
      if (ch === 'E') escapes = false;
    }
    index += 1;
  }

  const output = words.slice(index).join(' ');
  const rendered = escapes ? applyEchoEscapes(output) : output;

  // Terminal responses are line records, so there is no visible trailing newline to preserve.
  return newline ? rendered : rendered;
}

function parseEchoWords(rest, state) {
  const words = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let sawToken = false;

  const push = () => {
    if (sawToken) {
      words.push(current);
      current = '';
      sawToken = false;
    }
  };

  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];

    if (escaped) {
      current += ch;
      sawToken = true;
      escaped = false;
      continue;
    }

    if (ch === '\\' && quote !== "'") {
      escaped = true;
      sawToken = true;
      continue;
    }

    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        current += ch;
        sawToken = true;
      }
      continue;
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null;
        sawToken = true;
      } else if (ch === '$') {
        const expanded = readEnvExpansion(rest, i, state);
        current += expanded.value;
        sawToken = true;
        i = expanded.end;
      } else {
        current += ch;
        sawToken = true;
      }
      continue;
    }

    if (/\s/.test(ch)) {
      push();
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      sawToken = true;
      continue;
    }

    if (ch === '$') {
      const expanded = readEnvExpansion(rest, i, state);
      current += expanded.value;
      sawToken = true;
      i = expanded.end;
      continue;
    }

    current += ch;
    sawToken = true;
  }

  if (escaped) {
    current += '\\';
  }

  push();
  return words;
}

function readEnvExpansion(text, start, state) {
  if (text[start + 1] === '{') {
    const close = text.indexOf('}', start + 2);
    if (close !== -1) {
      const name = text.slice(start + 2, close);
      return { value: envValue(name, state), end: close };
    }
  }

  const match = /^(\?|\w+)/.exec(text.slice(start + 1));
  if (!match) {
    return { value: '$', end: start };
  }

  return {
    value: envValue(match[1], state),
    end: start + match[1].length,
  };
}

function envValue(name, state) {
  const envVars = state.envVars || {};
  if (name === '?') return String(typeof process !== 'undefined' ? process.exitCode ?? 0 : 0);
  if (name === 'PWD') return state.cwd || '/';
  if (name === 'HOME') return userHomePath(state);
  if (name === 'USER') return sanitizeUsername(mergeConfigDefaults(state.config).name);
  return envVars[name] ?? '';
}

function applyEchoEscapes(text) {
  let output = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch !== '\\') {
      output += ch;
      continue;
    }

    const next = text[++i];
    if (next === undefined) {
      output += '\\';
      continue;
    }

    if (next === 'c') break;
    if (next === 'a') output += '\x07';
    else if (next === 'b') output += '\b';
    else if (next === 'e' || next === 'E') output += '\x1b';
    else if (next === 'f') output += '\f';
    else if (next === 'n') output += '\n';
    else if (next === 'r') output += '\r';
    else if (next === 't') output += '\t';
    else if (next === 'v') output += '\v';
    else if (next === '\\') output += '\\';
    else output += `\\${next}`;
  }

  return output;
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
    '7     tty0     S     ambient-dust',
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

function logSystemEvent(state, message, isPublic = false) {
  const entry = `[${new Date().toISOString()}] ${message}`;
  if (!Array.isArray(state.logEntries)) state.logEntries = [];
  state.logEntries.push(entry);
  if (isPublic) {
    if (!Array.isArray(state.publicLogEntries)) state.publicLogEntries = [];
    state.publicLogEntries.push(entry);
  }
}

function logsOutput(args, state, options) {
  if (args.includes('--full')) {
    if (!options.elevated) return { output: 'logs --full: permission denied; use sudo', status: 403 };
    return { output: (Array.isArray(state.logEntries) ? state.logEntries.join('\n') : '') || '(no log entries)' };
  }
  return { output: (Array.isArray(state.publicLogEntries) ? state.publicLogEntries.join('\n') : '') || '(no public log entries)' };
}

async function tailFile(args, state, env) {
  const path = args.find((a) => !a.startsWith('-'));
  if (!path) return { output: 'Usage: tail [-n N] <path>', status: 400 };
  const n = args.includes('-n') ? Number(args[args.indexOf('-n') + 1]) || 10 : 10;
  const normalized = normalizePath(path);
  const content = await readFile(normalized, env);
  if (content === null || content === undefined) return { output: `tail: ${path}: no such file`, status: 404 };
  const lines = content.split('\n');
  return { output: lines.slice(-n).join('\n') };
}

async function headFile(args, state, env) {
  const path = args.find((a) => !a.startsWith('-'));
  if (!path) return { output: 'Usage: head [-n N] <path>', status: 400 };
  const n = args.includes('-n') ? Number(args[args.indexOf('-n') + 1]) || 10 : 10;
  const normalized = normalizePath(path);
  const content = await readFile(normalized, env);
  if (content === null || content === undefined) return { output: `head: ${path}: no such file`, status: 404 };
  const lines = content.split('\n');
  return { output: lines.slice(0, n).join('\n') };
}

async function lessFile(args, state, env) {
  const path = args[0];
  if (!path) return { output: 'Usage: less <path>', status: 400 };
  const normalized = normalizePath(path);
  const content = await readFile(normalized, env);
  if (content === null || content === undefined) return { output: `less: ${path}: no such file`, status: 404 };
  return { output: renderTerminalFileContent(content, normalized) };
}

async function sourceFile(path, state, env, visibleContext, request, options = {}) {
  if (!path) return { output: 'Usage: source <path>', status: 400 };
  if (Number(options.sourceDepth ?? 0) > 2) {
    return { output: 'source: maximum source depth exceeded', status: 400 };
  }
  const normalized = normalizePath(path);
  const content = await readFile(normalized, env, options);
  if (content === null || content === undefined) return { output: `source: ${path}: no such file`, status: 404 };
  const commands = String(content)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (!commands.length) return { output: `source: ${normalized}: no commands` };
  const output = [`sourcing ${normalized}`];
  for (const line of commands.slice(0, 40)) {
    if (/^(sudo|su)\b/.test(line)) {
      output.push(`$ ${line}`);
      output.push('source: skipped privileged command');
      continue;
    }
    const result = await executeCommandText(line, state, env, visibleContext, request, {
      ...options,
      elevated: Boolean(options.elevated),
      sourceDepth: Number(options.sourceDepth ?? 0) + 1,
    });
    output.push(`$ ${line}`);
    if (result.output) output.push(result.output);
    if (result.status && result.status >= 400) break;
  }
  return { output: output.join('\n') };
}

async function envHandler(args, state, env, options = {}) {
  const action = String(args[0] || 'list').toLowerCase();
  const envVars = await collectEffectiveEnvVars(state, env, options);

  if (action === 'list' || action === 'view') {
    const lines = Object.keys(envVars)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${key}=${envVars[key]}`);
    return { output: lines.join('\n') || '(no environment variables set)' };
  }

  if (action === 'get') {
    const key = String(args[1] || '').trim();
    if (!key) return { output: 'Usage: env get <KEY>', status: 400 };
    if (!(key in envVars)) return { output: `env: ${key} is not set`, status: 404 };
    return { output: `${key}=${envVars[key]}` };
  }

  if (action === 'set') {
    const assignment = args.slice(1).join(' ').trim();
    const eq = assignment.indexOf('=');
    if (eq < 1) return { output: 'Usage: env set <KEY=VALUE>', status: 400 };
    const key = assignment.slice(0, eq).trim();
    const value = assignment.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { output: 'env set: invalid key. Use shell-style names like MY_VAR.', status: 400 };
    }
    if (!state.envVars || typeof state.envVars !== 'object') state.envVars = {};
    state.envVars[key] = value;
    return { output: `set ${key}=${value}` };
  }

  return { output: 'Usage: env [list|view|get <KEY>|set <KEY=VALUE>]', status: 400 };
}

async function collectEffectiveEnvVars(state, env, options = {}) {
  const result = {};
  for (const path of ['/etc/clpsh/clpshrc', `${userHomePath(state)}/.clpshrc`]) {
    const content = await readFile(path, env, options);
    if (content === null || content === undefined) continue;
    const parsed = parseExportLines(String(content));
    Object.assign(result, parsed);
  }
  Object.assign(result, state.envVars && typeof state.envVars === 'object' ? state.envVars : {});
  return result;
}

function parseExportLines(content) {
  const out = {};
  const lines = String(content || '').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = String(match[2] || '').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function mkdirPath(args, options) {
  const path = args[0];
  if (!path) return { output: 'Usage: mkdir <path>', status: 400 };
  const normalized = normalizePath(path);
  const allowed = normalized.startsWith('/home/') || normalized.startsWith('/guest/') || normalized.startsWith('/tmp/');
  if (!allowed && !options.elevated) return { output: `mkdir: ${normalized}: permission denied; allowed in /home, /guest, /tmp`, status: 403 };
  if (DIRECTORIES[normalized]) return { output: `mkdir: ${normalized}: directory exists` };
  DIRECTORIES[normalized] = [];
  return { output: `created directory ${normalized}` };
}



function renderTerminalFileContent(content, path) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'md' || ext === 'markdown') {
    return content;
  }
  if (
    [
      'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
      'json', 'jsonc',
      'css', 'scss', 'sass', 'less',
      'html', 'xml', 'svg',
      'py', 'pyi',
      'go', 'rs',
      'java', 'kt', 'kts', 'scala',
      'cs',
      'c', 'h', 'cpp', 'cc', 'cxx', 'hpp',
      'php', 'rb', 'swift', 'zig',
      'sh', 'bash', 'zsh', 'fish', 'ps1',
      'sql',
      'yml', 'yaml', 'toml', 'ini', 'env',
    ].includes(ext)
  ) {
    return `\`\`\`${ext}
${content}
\`\`\``;
  }
  return content;
}

function prettyPrint(content, path) {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'md') {
    return content
      .replace(/^### (.+)$/gm, '  ┃ $1')
      .replace(/^## (.+)$/gm, '  ┃▎$1')
      .replace(/^# (.+)$/gm, '  ╍━━━ $1 ━━━╍')
      .replace(/\*\*(.+?)\*\*/g, '«$1»')
      .replace(/`(.+?)`/g, '⟨$1⟩')
      .replace(/^[-*] /gm, '  • ');
  }
  if (
    [
      'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
      'py', 'pyi', 'go', 'rs',
      'java', 'kt', 'kts', 'scala', 'cs',
      'c', 'h', 'cpp', 'cc', 'cxx', 'hpp',
      'php', 'rb', 'swift', 'zig',
      'sh', 'bash', 'zsh', 'fish', 'ps1',
      'sql',
      'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'env',
      'css', 'scss', 'sass', 'less', 'html', 'xml', 'svg',
    ].includes(ext)
  ) {
    const lines = content.split('\n');
    const width = String(lines.length).length;
    return lines.map((line, i) => `${String(i + 1).padStart(width)} │ ${line}`).join('\n');
  }
  return content;
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

function mergeConfigDefaults(raw) {
  return {
    theme: 'orange',
    syntax_scheme: 'default',
    font_size: 14,
    font: 'monospace',
    dark: true,
    name: 'guest',
    environment: 'pecunies',
    email: '',
    crt: true,
    ai_model: '@cf/meta/llama-3.1-8b-instruct',
    system_prompt: '',
    ...(raw && typeof raw === 'object' ? raw : {}),
  };
}

/** Filesystem-safe username segment for /home/<username> (aligned with frontend identity rules). */
function sanitizeUsername(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return s.slice(0, 24) || 'guest';
}

function userHomePath(cfgSource) {
  const cfg = mergeConfigDefaults(cfgSource?.config ?? cfgSource);
  return `/home/${sanitizeUsername(cfg.name)}`;
}

function ensureHomeDirectory(cfgSource) {
  const home = userHomePath(cfgSource);
  if (!DIRECTORIES[home]) {
    DIRECTORIES[home] = [];
  }
}

async function migrateHomeDotfiles(env, fromUserRaw, toUserRaw) {
  const from = sanitizeUsername(fromUserRaw);
  const to = sanitizeUsername(toUserRaw);
  if (from === to || !env.PORTFOLIO_OS) {
    return '';
  }

  ensureHomeDirectory({ config: { name: to } });
  const oldHome = `/home/${from}`;
  const newHome = `/home/${to}`;
  const copied = [];

  for (const fname of ['.clpshrc', '.clpsh_history']) {
    const oldPath = `${oldHome}/${fname}`;
    const newPath = `${newHome}/${fname}`;
    const oldContent = await readUserFile(env, oldPath);
    if (oldContent === null || oldContent === undefined || oldContent === '') {
      continue;
    }
    const newContent = await readUserFile(env, newPath);
    if (newContent === null || newContent === undefined || newContent === '') {
      await env.PORTFOLIO_OS.put(userFileKey(newPath), oldContent);
      copied.push(fname);
    }
  }

  return copied.length ? `migrated: ${copied.join(', ')}` : '';
}

async function persistClpshHistoryFile(env, state) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  ensureHomeDirectory(state);
  const home = userHomePath(state);
  const lines = state.history.map((entry, index) => {
    const idx = String(index + 1).padStart(3, ' ');
    return `${idx}  ${entry.command}`;
  });
  await env.PORTFOLIO_OS.put(userFileKey(`${home}/.clpsh_history`), lines.join('\n'));
}

function normalizeState(state) {
  const s = state && typeof state === 'object' ? state : {};
  const cfg = mergeConfigDefaults(s.config);
  const defaultCwd = userHomePath({ config: cfg });
  return {
    history: Array.isArray(s.history) ? s.history : [],
    reads: Array.isArray(s.reads) ? s.reads : [],
    pendingAuth: s.pendingAuth && typeof s.pendingAuth === 'object' ? s.pendingAuth : null,
    rootUntil: Number(s.rootUntil ?? 0),
    logEntries: Array.isArray(s.logEntries) ? s.logEntries : [],
    publicLogEntries: Array.isArray(s.publicLogEntries) ? s.publicLogEntries : [],
    cwd: typeof s.cwd === 'string' ? s.cwd : defaultCwd,
    previousCwd: typeof s.previousCwd === 'string' ? s.previousCwd : null,
    envVars: s.envVars && typeof s.envVars === 'object' ? s.envVars : {},
    ragContext: Array.isArray(s.ragContext) ? s.ragContext : [],
    config: cfg,
  };
}

async function readState(env, sessionId) {
  const db = stateDb(env);
  if (db) {
    await ensureStateInfra(env);
    const row = await db.prepare('SELECT state_json FROM session_state WHERE session_id = ? LIMIT 1').bind(sessionId).first();
    const rawJson = String(row?.state_json || '');
    if (rawJson) {
      try {
        return normalizeState(JSON.parse(rawJson));
      } catch {
        // Fall back to KV/default below.
      }
    }
  }
  if (!env.PORTFOLIO_OS) {
    return defaultState();
  }

  const raw = (await env.PORTFOLIO_OS.get(`session:${sessionId}`, { type: 'json' })) ?? {};
  return normalizeState(raw);
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
    jobquest: Array.isArray(board.jobquest) ? board.jobquest : [],
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
    jobquest: [],
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

  await persistClpshHistoryFile(env, state);
  await env.PORTFOLIO_OS.put(`session:${sessionId}`, JSON.stringify(state), { expirationTtl: 60 * 60 * 24 * 30 });
}

function defaultState() {
  return normalizeState({});
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
    `CREATE TABLE IF NOT EXISTS rag_memory (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT,
      at TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL
    )`,
  ).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_rag_memory_session ON rag_memory(session_id, created_at DESC)').run();
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



function identitySummary(state) {
  const config = mergeConfigDefaults(state?.config);
  const name = String(config.name || 'guest').trim() || 'guest';
  const env = String(config.environment || 'pecunies').trim() || 'pecunies';
  return `${name}@${env}: visitor shell session`;
}

function sanitizeSessionId(value) {
  const raw = String(value || 'anonymous');
  return raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 96) || 'anonymous';
}

// ── Session info ──
async function sessionOutput(state, env, request) {
  const metrics = await readMetrics(env);
  const cf = request?.cf ?? {};
  const topCmd = Object.entries(metrics.commands).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return {
    output: [
      '=== Session Info ===',
      `commands run: ${state.history.length}`,
      `files read: ${state.reads.length}`,
      `root active: ${hasRoot(state) ? 'yes' : 'no'}`,
      '',
      '=== Connection ===',
      `country: ${cf.country ?? 'unknown'}`,
      `colo: ${cf.colo ?? 'unknown'}`,
      `tls: ${cf.tlsVersion ?? 'unknown'}`,
      '',
      '=== Whoami ===',
      identitySummary(state),
      '',
      '=== Site Metrics ===',
      `total visits: ${metrics.visits}`,
      `unique countries: ${Object.keys(metrics.countries).length}`,
      `top command: ${topCmd ? `${topCmd[0]} (${topCmd[1]})` : 'none'}`,
    ].join('\n'),
  };
}

// ── ps aux ──
function psAuxOutput() {
  return [
    'USER       PID  %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
    'root         1   0.0  0.1   4096  1024 tty0     Ss   00:00   0:01 portfolio-os',
    'guest        7   0.2  0.3  16384  3072 tty0     S    00:01   0:12 ambient-dust',
    'guest       12   0.1  0.2  12288  2048 tty0     S    00:01   0:05 command-registry',
    'guest       31   0.0  0.4  20480  4096 edge     S    00:02   0:03 workers-ai-proxy',
    'guest       48   0.0  0.2   8192  2048 edge     S    00:02   0:01 kv-history-writer',
    'guest       55   0.0  0.1   4096  1024 edge     S    now     0:00 clpsh-session',
    'guest       67   0.0  0.1   4096  1024 edge     R    now     0:00 ps-aux',
  ].join('\n');
}

// ── dig ──
function digHost(args) {
  const host = args[0];
  if (!host) return { output: 'Usage: dig <hostname>', status: 400 };
  const mock = {
    'pecunies.com': { ip: '172.67.168.89', ttl: 300, ns: 'alec.ns.cloudflare.com' },
    'clp.is': { ip: '104.21.42.196', ttl: 300, ns: 'alec.ns.cloudflare.com' },
    'github.com': { ip: '140.82.112.3', ttl: 60, ns: 'dns1.p08.nsone.net' },
  };
  const result = mock[host.toLowerCase()] || {
    ip: `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    ttl: 300,
    ns: 'unknown',
  };
  return {
    output: [
      `; <<>> pecuOS dig <<>> ${host}`,
      `;; global options: +cmd`,
      `;; Got answer:`,
      `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ${Math.floor(Math.random() * 60000)}`,
      `;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1`,
      '',
      `;; QUESTION SECTION:`,
      `;${host}.                    IN      A`,
      '',
      `;; ANSWER SECTION:`,
      `${host}.             ${result.ttl}     IN      A       ${result.ip}`,
      '',
      `;; Query time: ${Math.floor(Math.random() * 30 + 5)} msec`,
      `;; SERVER: 1.1.1.1#53(1.1.1.1)`,
      `;; WHEN: ${new Date().toUTCString()}`,
      `;; MSG SIZE  rcvd: 56`,
    ].join('\n'),
  };
}

// ── edit ──
async function editFile(args, state, env, options) {
  const path = args[0];
  if (!path) return { output: 'Usage: edit <path>', status: 400 };
  const normalized = normalizePath(path);
  const content = await readFile(normalized, env, options);
  if (content === null || content === undefined) {
    return { output: `New file: ${normalized}\n\n[empty buffer — use write to save or :q to quit]` };
  }
  return {
    output: `Editing: ${normalized}\n\n${content}\n\n[edit mode — run write <path> <content> to save, or :q to exit]`,
  };
}

// ── note ──
function noteHandler(args, state) {
  if (!state.notes) state.notes = [];
  const sub = args[0]?.toLowerCase();
  if (sub === 'add' || sub === 'new') {
    const text = args.slice(1).join(' ').trim();
    if (!text) return { output: 'Usage: note add <text>', status: 400 };
    state.notes.push({ text, at: new Date().toISOString() });
    return { output: `Note ${state.notes.length} added.` };
  }
  if (sub === 'list') {
    if (!state.notes.length) return { output: 'No notes yet. Use note add <text> to create one.' };
    return { output: state.notes.map((n, i) => `${i + 1}. [${n.at.slice(0, 10)}] ${n.text}`).join('\n') };
  }
  if (sub === 'clear') {
    state.notes = [];
    return { output: 'All notes cleared.' };
  }
  return { output: 'Usage: note <add|list|clear>', status: 400 };
}

async function ragHandler(args, state, env, sessionId = 'anonymous') {
  if (!Array.isArray(state.ragContext)) state.ragContext = [];
  const sub = args[0]?.toLowerCase();
  if (sub === 'add' || sub === 'remember') {
    const text = args.slice(1).join(' ').trim();
    if (!text) return { output: 'Usage: rag add <context>', status: 400 };
    const clipped = text.slice(0, 1200);
    const at = new Date().toISOString();
    state.ragContext.push({ text: clipped, at });
    state.ragContext = state.ragContext.slice(-40);
    await persistRagMemory(env, sessionId, clipped, { source: 'rag-add', at });
    await upsertVectorMemory(env, clipped, { sessionId, source: 'rag-add', at });
    return { output: `rag: stored context note ${state.ragContext.length}` };
  }
  if (sub === 'search') {
    const query = args.slice(1).join(' ').trim();
    if (!query) return { output: 'Usage: rag search <query>', status: 400 };
    const knowledge = await gatherRagKnowledge(query, state, env, sessionId);
    return { output: knowledge || 'rag: no memory matches for query' };
  }
  if (sub === 'list' || !sub) {
    if (!state.ragContext.length) return { output: 'rag: no session context notes stored' };
    return {
      output: state.ragContext
        .map((entry, index) => `${index + 1}. [${entry.at.slice(0, 10)}] ${entry.text}`)
        .join('\n'),
    };
  }
  if (sub === 'clear') {
    state.ragContext = [];
    return { output: 'rag: session context notes cleared' };
  }
  return { output: 'Usage: rag <add|list|search|clear> [context]', status: 400 };
}

function tokenizeForSearch(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((token) => token.length > 2),
  );
}

function overlapScore(query, candidate) {
  const q = tokenizeForSearch(query);
  if (!q.size) return 0;
  const c = tokenizeForSearch(candidate);
  let score = 0;
  for (const token of q) {
    if (c.has(token)) score += 1;
  }
  return score;
}

async function gatherRagKnowledge(question, state, env, sessionId = 'anonymous', metricsInput = null) {
  const candidates = [];
  const metrics = metricsInput ?? await readMetrics(env);
  const cfg = mergeConfigDefaults(state.config);
  const stateSnapshot = [
    `user=${sanitizeUsername(cfg.name)}`,
    `environment=${cfg.environment}`,
    `cwd=${state.cwd || '/'}`,
    `rootActive=${hasRoot(state)}`,
    `historyCount=${Array.isArray(state.history) ? state.history.length : 0}`,
    `readsCount=${Array.isArray(state.reads) ? state.reads.length : 0}`,
  ].join(' ');
  const metricsSnapshot = `visits=${Number(metrics?.visits || 0)} topPages=${Object.entries(metrics?.pages || {}).slice(0, 5).map(([k, v]) => `${k}:${v}`).join(', ')}`;
  candidates.push({ source: 'stateful-data', text: stateSnapshot });
  candidates.push({ source: 'metrics', text: metricsSnapshot });

  if (Array.isArray(state.ragContext)) {
    for (const entry of state.ragContext.slice(-80)) {
      candidates.push({ source: 'session-rag', text: `${entry.at || ''} ${entry.text || ''}`.trim() });
    }
  }

  const persisted = await readPersistedRagMemories(env, sessionId, 80);
  for (const item of persisted) {
    candidates.push({ source: 'kv-rag', text: `${item.at || ''} ${item.text || ''}`.trim() });
  }

  const vectorHits = await queryVectorMemory(env, question, sessionId);
  for (const item of vectorHits) {
    candidates.push({ source: 'vectorize', text: item });
  }

  const scored = candidates
    .map((item) => ({ ...item, score: overlapScore(question, item.text) }))
    .filter((item) => item.score > 0 || item.source === 'stateful-data' || item.source === 'metrics')
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return scored
    .map((item, idx) => `${idx + 1}. [${item.source}] ${String(item.text || '').slice(0, 900)}`)
    .join('\n');
}

async function persistRagMemory(env, sessionId, text, meta = {}) {
  const db = stateDb(env);
  if (db) {
    await ensureStateInfra(env);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await db
      .prepare(
        `INSERT INTO rag_memory (id, session_id, text, source, at, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        sessionId,
        String(text || '').slice(0, 4000),
        String(meta.source || 'rag'),
        String(meta.at || new Date().toISOString()),
        JSON.stringify(meta || {}),
        new Date().toISOString(),
      )
      .run();
  }
  if (!env?.PORTFOLIO_OS) return;
  const key = `rag:memory:${sessionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    sessionId,
    text: String(text || '').slice(0, 4000),
    at: meta.at || new Date().toISOString(),
    source: meta.source || 'rag',
    model: meta.model || null,
  };
  await env.PORTFOLIO_OS.put(key, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 45 });
}

async function readPersistedRagMemories(env, sessionId, limit = 60) {
  const db = stateDb(env);
  if (db) {
    await ensureStateInfra(env);
    const rows = await db
      .prepare(
        `SELECT text, source, at, created_at
         FROM rag_memory
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(sessionId, Math.max(1, Math.min(200, Number(limit) || 60)))
      .all();
    const list = Array.isArray(rows?.results)
      ? rows.results.map((row) => ({
          text: String(row?.text || ''),
          source: String(row?.source || 'rag'),
          at: String(row?.at || row?.created_at || new Date().toISOString()),
        }))
      : [];
    if (list.length) {
      return list;
    }
  }
  if (!env?.PORTFOLIO_OS?.list) return [];
  const out = [];
  let cursor = undefined;
  do {
    const page = await env.PORTFOLIO_OS.list({ prefix: `rag:memory:${sessionId}:`, cursor, limit: 1000 });
    for (const key of page.keys || []) {
      const value = await env.PORTFOLIO_OS.get(key.name, { type: 'json' });
      if (value && typeof value.text === 'string') out.push(value);
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out.slice(-limit);
}

async function getEmbeddingVector(env, text) {
  if (!env?.AI || !text) return null;
  try {
    const res = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [String(text).slice(0, 2000)] });
    const vector =
      res?.data?.[0] ||
      res?.result?.data?.[0] ||
      res?.embedding ||
      res?.embeddings?.[0] ||
      null;
    return Array.isArray(vector) ? vector : null;
  } catch {
    return null;
  }
}

function getVectorIndex(env) {
  return env?.RAG_VECTORIZE || env?.VECTORIZE || env?.VECTORIZE_INDEX || null;
}

async function upsertVectorMemory(env, text, metadata = {}) {
  const index = getVectorIndex(env);
  if (!index?.upsert) return;
  const values = await getEmbeddingVector(env, text);
  if (!values) return;
  const id = `rag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  try {
    await index.upsert([
      {
        id,
        values,
        metadata: {
          text: String(text || '').slice(0, 1500),
          ...metadata,
        },
      },
    ]);
  } catch {
    /* best-effort: binding may exist with different API shape */
  }
}

async function queryVectorMemory(env, query, sessionId) {
  const index = getVectorIndex(env);
  if (!index?.query) return [];
  const values = await getEmbeddingVector(env, query);
  if (!values) return [];
  try {
    const result = await index.query(values, { topK: 6, returnMetadata: true });
    const matches = result?.matches || result?.result?.matches || [];
    return matches
      .map((entry) => entry?.metadata)
      .filter((meta) => meta && (!meta.sessionId || meta.sessionId === sessionId))
      .map((meta) => String(meta.text || '').trim())
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}



function renderGuestShellRc(config) {
  const c = mergeConfigDefaults(config);
  return [
    '# pecuOS guest shell rc',
    '# Auto-generated from session identity/config',
    `export USER=${String(c.name || 'guest')}`,
    `export ENVIRONMENT=${String(c.environment || 'pecunies')}`,
    `export AI_MODEL=${String(c.ai_model || '@cf/meta/llama-3.1-8b-instruct')}`,
    `export THEME=${String(c.theme || 'orange')}`,
    `export SYNTAX_SCHEME=${String(c.syntax_scheme || 'default')}`,
    `export DARK_MODE=${String(c.dark !== false)}`,
    `export SYSTEM_PROMPT=${JSON.stringify(String(c.system_prompt || ''))}`,
    '',
  ].join('\n');
}

async function updateGuestShellRc(env, config) {
  if (!env.PORTFOLIO_OS) {
    return;
  }
  const c = mergeConfigDefaults(config);
  ensureHomeDirectory({ config: c });
  const home = userHomePath({ config: c });
  await env.PORTFOLIO_OS.put(userFileKey(`${home}/.clpshrc`), renderGuestShellRc(c));
}

// ── config ──
async function configHandler(args, state, env) {
  state.config = mergeConfigDefaults(state.config);
  const sub = args[0]?.toLowerCase();
  if (sub === 'list' || sub === 'get') {
    const prop = args[1];
    if (prop) return { output: `${prop}: ${state.config[prop] ?? '(not set)'}` };
    return { output: Object.entries(state.config).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n') };
  }
  if (sub === 'set' && args[1]) {
    const key = args[1];
    let val = args.slice(2).join(' ');
    const prevNameSan = sanitizeUsername(String(mergeConfigDefaults(state.config).name));
    if (key === 'crt') {
      const s = String(val).toLowerCase();
      if (s === 'on' || s === 'true') val = true;
      else if (s === 'off' || s === 'false') val = false;
    } else {
      if (key === 'name') {
        val = sanitizeUsername(String(val));
      } else if (key === 'syntax_scheme') {
        const normalized = String(val || '').trim().toLowerCase();
        val = ['default', 'contrast', 'pastel'].includes(normalized) ? normalized : 'default';
      } else if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (key !== 'email' && key !== 'environment' && key !== 'system_prompt' && /^\d+$/.test(val)) {
        val = Number(val);
      }
    }
    state.config[key] = val;
    const shouldRedact = key === 'system_prompt' || key === 'email';
    const renderedValue = shouldRedact ? '[redacted]' : JSON.stringify(val);
    logSystemEvent(state, `config set: ${key}=${renderedValue}`, true);
    let extra = '';
    if (key === 'name') {
      const nextNameSan = sanitizeUsername(String(state.config.name));
      if (prevNameSan !== nextNameSan) {
        extra = await migrateHomeDotfiles(env, prevNameSan, nextNameSan);
        state.cwd = userHomePath(state);
      }
    }
    await updateGuestShellRc(env, state.config);
    const suffix = extra ? `\n${extra}` : '';
    return { output: `config: ${key} = ${JSON.stringify(val)}${suffix}` };
  }
  if (sub === 'reset') {
    state.config = mergeConfigDefaults();
    state.cwd = userHomePath(state);
    logSystemEvent(state, 'config reset: defaults restored', true);
    await updateGuestShellRc(env, state.config);
    return { output: 'Config reset to defaults.' };
  }
  return { output: 'Usage: config <set|get|list|reset> [key] [value]', status: 400 };
}

// ── alias ──
function aliasHandler(args, state) {
  if (!state.aliases) state.aliases = {};
  if (args.length === 0) {
    const entries = Object.entries(state.aliases);
    if (!entries.length) return { output: 'No aliases defined.' };
    return { output: entries.map(([k, v]) => `alias ${k}='${v}'`).join('\n') };
  }
  const name = args[0];
  const value = args.slice(1).join(' ');
  if (!value) return { output: `alias ${name}='${state.aliases[name] ?? '(not set)'}'` };
  state.aliases[name] = value;
  return { output: `alias ${name}='${value}'` };
}

function unaliasHandler(args, state) {
  if (!state.aliases) state.aliases = {};
  if (args.length === 0) return { output: 'Usage: unalias <name>', status: 400 };
  const name = args[0];
  if (!(name in state.aliases)) return { output: `unalias: ${name}: not found`, status: 404 };
  delete state.aliases[name];
  return { output: `unalias ${name}: removed` };
}

// ── set / unset (config vars) ──
function setVarHandler(args, state) {
  if (!state.shellVars) state.shellVars = {};
  if (args.length < 2) return { output: 'Usage: set <key> <value>', status: 400 };
  const key = args[0];
  const value = args.slice(1).join(' ');
  state.shellVars[key] = value;
  return { output: `set ${key}=${value}` };
}

function unsetVarHandler(args, state) {
  if (!state.shellVars) state.shellVars = {};
  if (args.length < 1) return { output: 'Usage: unset <key>', status: 400 };
  const key = args[0];
  if (!(key in state.shellVars)) return { output: `unset: ${key}: not found`, status: 404 };
  delete state.shellVars[key];
  return { output: `unset ${key}: removed` };
}
