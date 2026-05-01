import { resumeData } from "./resume";

export type CatalogEntityType =
  | "tag"
  | "skill"
  | "tool"
  | "project"
  | "work"
  | "workflow"
  | "step"
  | "execution"
  | "agent"
  | "hook"
  | "trigger"
  | "user"
  | "job"
  | "systemprompt";

export type CatalogEntityRef = {
  type: CatalogEntityType;
  slug: string;
  label?: string;
};

export type CatalogEntity = {
  type: CatalogEntityType;
  slug: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  summary?: string;
  avatar?: string;
  status?: string;
  metadata?: Record<string, string>;
  details?: string[];
  related?: CatalogEntityRef[];
};

export type CatalogTypeMeta = {
  type: CatalogEntityType;
  command: string;
  routeBase: string;
  singular: string;
  plural: string;
  title: string;
  description: string;
};

export const CATALOG_TYPES: Record<CatalogEntityType, CatalogTypeMeta> = {
  tag: {
    type: "tag",
    command: "tag",
    routeBase: "tag",
    singular: "tag",
    plural: "tags",
    title: "Tag index",
    description:
      "Taxonomy across the portfolio graph, including skills, tools, projects, workflows, posts, and jobs.",
  },
  skill: {
    type: "skill",
    command: "skill",
    routeBase: "skill",
    singular: "skill",
    plural: "skills",
    title: "Skills",
    description:
      "Reusable portfolio and automation capabilities with composition, relationships, and where-used references.",
  },
  tool: {
    type: "tool",
    command: "tool",
    routeBase: "tool",
    singular: "tool",
    plural: "tools",
    title: "Tools",
    description:
      "Tooling surfaces enabled for agents, workflows, jobs, and data mutation flows.",
  },
  project: {
    type: "project",
    command: "project",
    routeBase: "project",
    singular: "project",
    plural: "projects",
    title: "Projects",
    description:
      "Shipped and active work with linked skills, tools, workflows, and portfolio metadata.",
  },
  work: {
    type: "work",
    command: "work",
    routeBase: "work",
    singular: "work item",
    plural: "work items",
    title: "Work items",
    description:
      "Operational and professional work records with descriptions, tags, and skill relationships.",
  },
  workflow: {
    type: "workflow",
    command: "workflow",
    routeBase: "workflow",
    singular: "workflow",
    plural: "workflows",
    title: "Workflows",
    description:
      "Composable automation workflows with steps, agents, tools, tags, and recent execution history.",
  },
  step: {
    type: "step",
    command: "step",
    routeBase: "step",
    singular: "step",
    plural: "steps",
    title: "Steps",
    description:
      "Reusable workflow steps used across jobs, workflows, triggers, and execution traces.",
  },
  execution: {
    type: "execution",
    command: "execution",
    routeBase: "execution",
    singular: "execution",
    plural: "executions",
    title: "Executions",
    description:
      "Workflow and job execution history with pass/fail state, logs, and upstream references.",
  },
  agent: {
    type: "agent",
    command: "agent",
    routeBase: "agent",
    singular: "agent",
    plural: "agents",
    title: "Agents",
    description:
      "Stateful agents, their prompts, enabled tools and skills, and the surfaces where they are used.",
  },
  hook: {
    type: "hook",
    command: "hook",
    routeBase: "hook",
    singular: "hook",
    plural: "hooks",
    title: "Hooks",
    description:
      "Mutation and lifecycle hooks with trigger points, side effects, and routing context.",
  },
  trigger: {
    type: "trigger",
    command: "trigger",
    routeBase: "trigger",
    singular: "trigger",
    plural: "triggers",
    title: "Triggers",
    description:
      "Event-driven triggers that fan into jobs, hooks, workflows, and notifications.",
  },
  user: {
    type: "user",
    command: "user",
    routeBase: "user",
    singular: "user",
    plural: "users",
    title: "Users",
    description:
      "Viewer and operator identities with profile metadata, tags, descriptions, and avatar references.",
  },
  job: {
    type: "job",
    command: "job",
    routeBase: "job",
    singular: "job",
    plural: "jobs",
    title: "Jobs",
    description:
      "Scheduled and background tasks with steps, agents, workflows, and tags.",
  },
  systemprompt: {
    type: "systemprompt",
    command: "systemprompt",
    routeBase: "systemprompt",
    singular: "system prompt",
    plural: "system prompts",
    title: "System prompts",
    description:
      "Prompt definitions, injected context, and where those instructions are used across the system.",
  },
};

const TAG_DESCRIPTIONS: Record<string, string> = {
  ai: "AI-assisted behavior, inference, model selection, prompting, and automation.",
  auth: "Identity, sign-in, sign-up, operator approval, or access control behavior.",
  automation: "Background or trigger-driven flows that continue without direct user input.",
  catalog: "Portfolio graph objects, entity metadata, and cross-linked references.",
  cloudflare: "Cloudflare runtime, storage, routing, AI, or workflow platform usage.",
  comments: "Comment capture, replies, moderation, or social interaction flows.",
  content: "Posts, markdown assets, descriptions, and publish/update flows.",
  edge: "Edge worker routing, backend APIs, caching, and site delivery logic.",
  execution: "Runs, traces, logs, result state, and operational history.",
  indexing: "Search, discovery, page crawlability, and metadata surfaces.",
  interaction: "Live UI flows, forms, command interactions, or conversational surfaces.",
  portfolio: "Portfolio content model, views, profile data, or public site structure.",
  prompt: "System prompts, contextual injection, and prompt shaping.",
  publishing: "Creation, editing, syncing, deletion, or feed updates for posts or data.",
  reply: "Reply flows and comment threading behavior.",
  sandbox: "Code execution, filesystem mutation, or isolated runtime behavior.",
  scheduling: "Cron-like, queued, or deferred execution behavior.",
  seo: "Search engine metadata, canonical routing, social cards, or crawlable content.",
  tags: "Tag descriptions, discovery, inline tag rendering, and tag pages.",
  terminal: "Command-driven UI, shell semantics, route behavior, or terminal rendering.",
  voice: "Speech input, voice agent handling, or live audio interface behavior.",
  workflow: "Workflows, jobs, reusable steps, or orchestrated execution.",
};

function slugify(value: string): string {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

function titleizeType(type: CatalogEntityType): string {
  return CATALOG_TYPES[type].singular;
}

function link(type: CatalogEntityType, slug: string, label?: string): CatalogEntityRef {
  return { type, slug, label };
}

const SKILLS: CatalogEntity[] = [
  {
    type: "skill",
    slug: "edge-routing",
    title: "Edge routing",
    category: "platform",
    description:
      "Route frontend and backend traffic through the edge worker, normalize canonical hosts, and attach request-aware metadata.",
    tags: ["cloudflare", "edge", "portfolio", "seo"],
    details: [
      "Owns URL normalization and request dispatch across apex, www, and API hosts.",
      "Feeds crawlable route metadata into the HTML shell for indexable pages.",
    ],
    related: [link("tool", "workers-edge"), link("workflow", "route-and-render"), link("project", "pecunies-terminal")],
  },
  {
    type: "skill",
    slug: "entity-modeling",
    title: "Entity modeling",
    category: "data",
    description:
      "Represent operational objects as typed entities with categories, tags, relationships, and editable metadata.",
    tags: ["catalog", "portfolio", "workflow", "tags"],
    details: [
      "Backs grouped index pages and instance detail pages for every data type.",
      "Supports reverse references so each page can show where it is used.",
    ],
    related: [link("workflow", "catalog-sync"), link("tool", "d1"), link("tool", "r2-assets")],
  },
  {
    type: "skill",
    slug: "markdown-delivery",
    title: "Markdown delivery",
    category: "content",
    description:
      "Render posts, descriptions, manuals, and file bodies with inline tags, safe HTML, and terminal-aware interactions.",
    tags: ["content", "terminal", "tags", "publishing"],
    related: [link("tool", "markdown-renderer"), link("workflow", "publish-post"), link("project", "pecunies-terminal")],
  },
  {
    type: "skill",
    slug: "comment-replies",
    title: "Comment replies",
    category: "interaction",
    description:
      "Capture and persist top-level comments plus operator replies with linked post context and tag metadata.",
    tags: ["comments", "reply", "interaction", "content"],
    related: [link("workflow", "reply-to-comment"), link("agent", "comment-operator"), link("trigger", "comment-created")],
  },
  {
    type: "skill",
    slug: "agent-orchestration",
    title: "Agent orchestration",
    category: "automation",
    description:
      "Compose stateful agents, prompts, tools, and workflow steps into durable multi-surface portfolio behaviors.",
    tags: ["ai", "workflow", "automation", "cloudflare"],
    related: [link("tool", "cloudflare-think"), link("tool", "cloudflare-ai-chat"), link("agent", "portfolio-assistant")],
  },
  {
    type: "skill",
    slug: "sandbox-execution",
    title: "Sandbox execution",
    category: "automation",
    description:
      "Use Cloudflare sandboxed execution for file writes, code interpretation, and controlled runtime actions.",
    tags: ["sandbox", "cloudflare", "automation"],
    related: [link("tool", "sandbox-sdk"), link("workflow", "code-and-file-eval"), link("job", "catalog-index-refresh")],
  },
  {
    type: "skill",
    slug: "auth-identity",
    title: "Auth and identity",
    category: "interaction",
    description:
      "Turn terminal identity, profile metadata, and user registration into a usable login and signup flow.",
    tags: ["auth", "user", "interaction"],
    related: [link("workflow", "signup-and-login"), link("user", "guest"), link("user", "chris-pecunies")],
  },
  {
    type: "skill",
    slug: "feed-synchronization",
    title: "Feed synchronization",
    category: "content",
    description:
      "Keep RSS and content discovery in sync whenever posts are created, updated, or removed.",
    tags: ["publishing", "seo", "content", "automation"],
    related: [link("workflow", "publish-post"), link("hook", "rss-sync-hook"), link("job", "rss-refresh")],
  },
  {
    type: "skill",
    slug: "voice-intake",
    title: "Voice intake",
    category: "interaction",
    description:
      "Accept speech input for the terminal and agent layer while keeping the interaction model session-aware.",
    tags: ["voice", "ai", "interaction"],
    related: [link("tool", "cloudflare-voice"), link("agent", "voice-intake-agent"), link("workflow", "signup-and-login")],
  },
];

const TOOLS: CatalogEntity[] = [
  {
    type: "tool",
    slug: "workers-edge",
    title: "Workers edge",
    category: "runtime",
    description:
      "Main edge runtime that fronts Pages content, API requests, canonical routing, and HTML metadata injection.",
    tags: ["cloudflare", "edge", "seo", "portfolio"],
    related: [link("skill", "edge-routing"), link("workflow", "route-and-render"), link("project", "pecunies-terminal")],
  },
  {
    type: "tool",
    slug: "d1",
    title: "D1",
    category: "storage",
    description:
      "Primary relational store for users, posts, comments, tags, metrics, and editable catalog overrides.",
    tags: ["cloudflare", "catalog", "content", "auth"],
    related: [link("skill", "entity-modeling"), link("workflow", "catalog-sync"), link("job", "catalog-index-refresh")],
  },
  {
    type: "tool",
    slug: "r2-assets",
    title: "R2 assets",
    category: "storage",
    description:
      "Durable object and markdown asset storage for posts, snapshots, and larger content payloads.",
    tags: ["cloudflare", "content", "publishing"],
    related: [link("workflow", "publish-post"), link("hook", "post-storage-hook"), link("project", "pecunies-terminal")],
  },
  {
    type: "tool",
    slug: "markdown-renderer",
    title: "Markdown renderer",
    category: "content",
    description:
      "Marked + DOMPurify rendering pipeline used for posts, files, pretty output, manuals, and inline tags.",
    tags: ["content", "terminal", "tags"],
    related: [link("skill", "markdown-delivery"), link("workflow", "inline-tag-render"), link("project", "pecunies-terminal")],
  },
  {
    type: "tool",
    slug: "cloudflare-think",
    title: "@cloudflare/think",
    category: "agent",
    description:
      "Opinionated stateful agent base class for tool loops, durable chat state, and orchestration logic.",
    tags: ["ai", "cloudflare", "workflow", "automation"],
    related: [link("skill", "agent-orchestration"), link("agent", "portfolio-assistant"), link("agent", "comment-operator")],
  },
  {
    type: "tool",
    slug: "cloudflare-ai-chat",
    title: "@cloudflare/ai-chat",
    category: "agent",
    description:
      "Persistent chat layer for browser-to-agent interaction and resumable AI conversations.",
    tags: ["ai", "cloudflare", "interaction"],
    related: [link("skill", "agent-orchestration"), link("agent", "portfolio-assistant"), link("workflow", "signup-and-login")],
  },
  {
    type: "tool",
    slug: "workspace-chat",
    title: "@cloudflare/workspace-chat",
    category: "agent",
    description:
      "Persisted workspace and conversation bridge used for operational catalog interactions and editable context surfaces.",
    tags: ["ai", "catalog", "interaction", "workflow"],
    related: [link("skill", "entity-modeling"), link("agent", "portfolio-assistant"), link("workflow", "catalog-sync")],
  },
  {
    type: "tool",
    slug: "sandbox-sdk",
    title: "@cloudflare/sandbox",
    category: "execution",
    description:
      "Cloudflare Sandbox SDK for controlled filesystem mutation, command execution, and code interpretation.",
    tags: ["sandbox", "cloudflare", "automation"],
    related: [link("skill", "sandbox-execution"), link("workflow", "code-and-file-eval"), link("job", "catalog-index-refresh")],
  },
  {
    type: "tool",
    slug: "cloudflare-voice",
    title: "@cloudflare/voice",
    category: "interaction",
    description:
      "Voice input layer for real-time speech capture and transcription into the agent and terminal surfaces.",
    tags: ["voice", "cloudflare", "interaction"],
    related: [link("skill", "voice-intake"), link("agent", "voice-intake-agent")],
  },
];

const SYSTEM_PROMPTS: CatalogEntity[] = [
  {
    type: "systemprompt",
    slug: "portfolio-default",
    title: "Portfolio default",
    category: "public",
    description:
      "Default portfolio assistant prompt: concise, terminal-native, aware of the site graph and public content model.",
    tags: ["prompt", "portfolio", "ai"],
    details: [
      "Injects entity relationships, command registry context, and public portfolio boundaries.",
    ],
    related: [link("agent", "portfolio-assistant"), link("workflow", "route-and-render")],
  },
  {
    type: "systemprompt",
    slug: "reply-writer",
    title: "Reply writer",
    category: "content",
    description:
      "Comment and reply prompt that keeps responses concise, factual, and grounded in the post context.",
    tags: ["prompt", "reply", "comments", "content"],
    related: [link("agent", "comment-operator"), link("workflow", "reply-to-comment")],
  },
  {
    type: "systemprompt",
    slug: "seo-annotator",
    title: "SEO annotator",
    category: "indexing",
    description:
      "Produces route titles, descriptions, canonical hints, and social summaries for indexable pages.",
    tags: ["prompt", "seo", "indexing"],
    related: [link("agent", "seo-summarizer"), link("workflow", "route-and-render")],
  },
  {
    type: "systemprompt",
    slug: "auth-helper",
    title: "Auth helper",
    category: "interaction",
    description:
      "Shapes signup/login copy and identity handling for the terminal auth surface.",
    tags: ["prompt", "auth", "interaction"],
    related: [link("agent", "auth-concierge"), link("workflow", "signup-and-login")],
  },
];

const AGENTS: CatalogEntity[] = [
  {
    type: "agent",
    slug: "portfolio-assistant",
    title: "Portfolio assistant",
    category: "public",
    description:
      "Primary portfolio agent that reads the catalog, explains content, and powers entity-aware AI flows.",
    tags: ["ai", "portfolio", "catalog", "cloudflare"],
    metadata: {
      model: "@cf/meta/llama-3.1-8b-instruct",
      systemPrompt: "portfolio-default",
    },
    related: [
      link("systemprompt", "portfolio-default"),
      link("tool", "cloudflare-ai-chat"),
      link("tool", "cloudflare-think"),
      link("skill", "agent-orchestration"),
      link("workflow", "catalog-sync"),
    ],
  },
  {
    type: "agent",
    slug: "comment-operator",
    title: "Comment operator",
    category: "content",
    description:
      "Handles comment reply drafting, moderation-aware context, and routing replies back to posts.",
    tags: ["comments", "reply", "content", "ai"],
    metadata: {
      model: "@cf/meta/llama-3.1-8b-instruct",
      systemPrompt: "reply-writer",
    },
    related: [
      link("systemprompt", "reply-writer"),
      link("workflow", "reply-to-comment"),
      link("trigger", "comment-created"),
    ],
  },
  {
    type: "agent",
    slug: "seo-summarizer",
    title: "SEO summarizer",
    category: "indexing",
    description:
      "Generates crawlable metadata for posts, entity pages, and major public routes.",
    tags: ["seo", "indexing", "ai"],
    metadata: {
      model: "@cf/meta/llama-3.1-8b-instruct",
      systemPrompt: "seo-annotator",
    },
    related: [link("systemprompt", "seo-annotator"), link("workflow", "route-and-render")],
  },
  {
    type: "agent",
    slug: "voice-intake-agent",
    title: "Voice intake agent",
    category: "interaction",
    description:
      "Converts microphone input into terminal and chat actions with persisted conversation context.",
    tags: ["voice", "interaction", "ai"],
    related: [link("tool", "cloudflare-voice"), link("skill", "voice-intake")],
  },
  {
    type: "agent",
    slug: "auth-concierge",
    title: "Auth concierge",
    category: "interaction",
    description:
      "Supports login/signup copy, user normalization, and identity-aware transitions back into the shell.",
    tags: ["auth", "user", "interaction", "ai"],
    related: [link("systemprompt", "auth-helper"), link("workflow", "signup-and-login")],
  },
];

const STEPS: CatalogEntity[] = [
  {
    type: "step",
    slug: "resolve-entity",
    title: "Resolve entity",
    category: "catalog",
    description:
      "Look up a catalog entity and hydrate reverse relationships for detail pages and hover cards.",
    tags: ["catalog", "tags", "workflow"],
    related: [link("workflow", "catalog-sync"), link("workflow", "inline-tag-render")],
  },
  {
    type: "step",
    slug: "save-override",
    title: "Save override",
    category: "mutation",
    description:
      "Persist an editable entity override into D1 after sudo verification.",
    tags: ["catalog", "auth", "workflow", "publishing"],
    related: [link("workflow", "catalog-sync"), link("hook", "entity-update-hook")],
  },
  {
    type: "step",
    slug: "render-inline-tags",
    title: "Render inline tags",
    category: "presentation",
    description:
      "Convert #tag text into interactive chips with click-through routes and hover previews.",
    tags: ["tags", "content", "terminal"],
    related: [link("workflow", "inline-tag-render"), link("tool", "markdown-renderer")],
  },
  {
    type: "step",
    slug: "persist-comment-reply",
    title: "Persist comment reply",
    category: "content",
    description:
      "Write comment or reply rows with post references, author identity, and created-at metadata.",
    tags: ["comments", "reply", "content"],
    related: [link("workflow", "reply-to-comment"), link("trigger", "comment-created")],
  },
  {
    type: "step",
    slug: "refresh-rss",
    title: "Refresh RSS",
    category: "publishing",
    description:
      "Recalculate the RSS surface from current stored posts after create, update, or delete events.",
    tags: ["publishing", "content", "seo"],
    related: [link("workflow", "publish-post"), link("hook", "rss-sync-hook"), link("job", "rss-refresh")],
  },
  {
    type: "step",
    slug: "compute-seo-meta",
    title: "Compute SEO metadata",
    category: "indexing",
    description:
      "Build title, description, canonical, and route summary values for server-side HTML injection.",
    tags: ["seo", "indexing", "portfolio"],
    related: [link("workflow", "route-and-render"), link("agent", "seo-summarizer")],
  },
];

const WORKFLOWS: CatalogEntity[] = [
  {
    type: "workflow",
    slug: "catalog-sync",
    title: "Catalog sync",
    category: "platform",
    description:
      "Hydrates the entity graph, applies editable overrides, and serves grouped index/detail responses.",
    tags: ["catalog", "workflow", "portfolio", "cloudflare"],
    related: [
      link("step", "resolve-entity"),
      link("step", "save-override"),
      link("tool", "d1"),
      link("agent", "portfolio-assistant"),
    ],
  },
  {
    type: "workflow",
    slug: "publish-post",
    title: "Publish post",
    category: "content",
    description:
      "Create, update, or remove a post, sync its storage, and ensure the RSS surface reflects the change.",
    tags: ["publishing", "content", "seo", "workflow"],
    related: [
      link("step", "refresh-rss"),
      link("tool", "r2-assets"),
      link("skill", "feed-synchronization"),
      link("hook", "rss-sync-hook"),
    ],
  },
  {
    type: "workflow",
    slug: "reply-to-comment",
    title: "Reply to comment",
    category: "content",
    description:
      "Resolve a post, capture the target commenter, persist the reply, and reflect it in the post detail view.",
    tags: ["comments", "reply", "workflow", "content"],
    related: [
      link("step", "persist-comment-reply"),
      link("agent", "comment-operator"),
      link("trigger", "comment-created"),
    ],
  },
  {
    type: "workflow",
    slug: "route-and-render",
    title: "Route and render",
    category: "presentation",
    description:
      "Map canonical path routes to SPA views while injecting route-aware SEO metadata into the shell response.",
    tags: ["edge", "seo", "portfolio", "workflow"],
    related: [
      link("step", "compute-seo-meta"),
      link("skill", "edge-routing"),
      link("tool", "workers-edge"),
    ],
  },
  {
    type: "workflow",
    slug: "inline-tag-render",
    title: "Inline tag render",
    category: "presentation",
    description:
      "Promote #tag text in markdown and prompt bodies into interactive tag chips with hover previews.",
    tags: ["tags", "content", "terminal", "workflow"],
    related: [
      link("step", "render-inline-tags"),
      link("tool", "markdown-renderer"),
      link("skill", "markdown-delivery"),
    ],
  },
  {
    type: "workflow",
    slug: "signup-and-login",
    title: "Signup and login",
    category: "interaction",
    description:
      "Register or resolve a user identity, merge it into the terminal session, and return to the requested route.",
    tags: ["auth", "user", "interaction", "workflow"],
    related: [
      link("agent", "auth-concierge"),
      link("skill", "auth-identity"),
      link("tool", "d1"),
    ],
  },
  {
    type: "workflow",
    slug: "code-and-file-eval",
    title: "Code and file evaluation",
    category: "automation",
    description:
      "Use sandbox execution to inspect and mutate files, or run controlled code interpretation flows.",
    tags: ["sandbox", "automation", "workflow"],
    related: [
      link("tool", "sandbox-sdk"),
      link("skill", "sandbox-execution"),
    ],
  },
];

const TRIGGERS: CatalogEntity[] = [
  {
    type: "trigger",
    slug: "comment-created",
    title: "Comment created",
    category: "content",
    description:
      "Fires when a new comment is written to a post so reply and moderation flows can respond.",
    tags: ["comments", "reply", "trigger", "content"],
    related: [link("workflow", "reply-to-comment"), link("hook", "comment-notify-hook")],
  },
  {
    type: "trigger",
    slug: "post-mutated",
    title: "Post mutated",
    category: "publishing",
    description:
      "Fires when a post is created, updated, or removed to keep discovery surfaces in sync.",
    tags: ["publishing", "content", "trigger", "seo"],
    related: [link("workflow", "publish-post"), link("hook", "rss-sync-hook")],
  },
  {
    type: "trigger",
    slug: "entity-edited",
    title: "Entity edited",
    category: "catalog",
    description:
      "Fires after an editable catalog instance is saved so views and SEO surfaces can refresh.",
    tags: ["catalog", "trigger", "seo"],
    related: [link("workflow", "catalog-sync"), link("hook", "entity-update-hook")],
  },
  {
    type: "trigger",
    slug: "voice-captured",
    title: "Voice captured",
    category: "interaction",
    description:
      "Fires when a voice utterance resolves into text for auth, ask, or command execution flows.",
    tags: ["voice", "interaction", "trigger"],
    related: [link("agent", "voice-intake-agent"), link("workflow", "signup-and-login")],
  },
];

const HOOKS: CatalogEntity[] = [
  {
    type: "hook",
    slug: "rss-sync-hook",
    title: "RSS sync hook",
    category: "publishing",
    description:
      "Ensures the RSS view stays current after post create, update, and delete operations.",
    tags: ["publishing", "seo", "content", "hook"],
    related: [link("trigger", "post-mutated"), link("step", "refresh-rss"), link("job", "rss-refresh")],
  },
  {
    type: "hook",
    slug: "entity-update-hook",
    title: "Entity update hook",
    category: "catalog",
    description:
      "Refreshes entity caches and route metadata after an editable instance changes.",
    tags: ["catalog", "seo", "hook"],
    related: [link("trigger", "entity-edited"), link("workflow", "catalog-sync")],
  },
  {
    type: "hook",
    slug: "post-storage-hook",
    title: "Post storage hook",
    category: "publishing",
    description:
      "Mirrors post markdown and snapshots into storage after content mutations.",
    tags: ["publishing", "content", "hook"],
    related: [link("tool", "r2-assets"), link("workflow", "publish-post")],
  },
  {
    type: "hook",
    slug: "comment-notify-hook",
    title: "Comment notify hook",
    category: "content",
    description:
      "Attaches operator context and follow-up actions when comment activity occurs.",
    tags: ["comments", "reply", "hook", "interaction"],
    related: [link("trigger", "comment-created"), link("agent", "comment-operator")],
  },
];

const JOBS: CatalogEntity[] = [
  {
    type: "job",
    slug: "rss-refresh",
    title: "RSS refresh",
    category: "publishing",
    description:
      "Background job that rebuilds or validates the feed surface after content mutations.",
    tags: ["publishing", "seo", "job", "content"],
    status: "active",
    related: [link("hook", "rss-sync-hook"), link("workflow", "publish-post")],
  },
  {
    type: "job",
    slug: "catalog-index-refresh",
    title: "Catalog index refresh",
    category: "catalog",
    description:
      "Refreshes computed reverse references, top-tag usage lists, and popover previews.",
    tags: ["catalog", "tags", "job", "indexing"],
    status: "active",
    related: [link("workflow", "catalog-sync"), link("workflow", "inline-tag-render")],
  },
  {
    type: "job",
    slug: "execution-retention",
    title: "Execution retention",
    category: "operations",
    description:
      "Rolls up older execution history while retaining recent visible runs for operator pages.",
    tags: ["execution", "job", "automation"],
    status: "active",
    related: [link("execution", "publish-post-2026-04-30"), link("execution", "catalog-sync-2026-04-30")],
  },
  {
    type: "job",
    slug: "voice-session-cleanup",
    title: "Voice session cleanup",
    category: "interaction",
    description:
      "Cleans up stale voice sessions and summarized transcript artifacts.",
    tags: ["voice", "job", "interaction"],
    status: "planned",
    related: [link("agent", "voice-intake-agent")],
  },
];

const EXECUTIONS: CatalogEntity[] = [
  {
    type: "execution",
    slug: "publish-post-2026-04-30",
    title: "Publish post 2026-04-30",
    category: "publishing",
    description:
      "Simulated post publication run that stored markdown, refreshed feed content, and updated metrics.",
    tags: ["execution", "publishing", "content"],
    status: "pass",
    metadata: {
      workflow: "publish-post",
      started: "2026-04-30T18:42:00Z",
      duration: "642ms",
    },
    related: [link("workflow", "publish-post"), link("job", "rss-refresh")],
  },
  {
    type: "execution",
    slug: "catalog-sync-2026-04-30",
    title: "Catalog sync 2026-04-30",
    category: "catalog",
    description:
      "Merged the catalog seed with editable overrides and rebuilt reverse references.",
    tags: ["execution", "catalog", "workflow"],
    status: "pass",
    metadata: {
      workflow: "catalog-sync",
      started: "2026-04-30T19:08:00Z",
      duration: "411ms",
    },
    related: [link("workflow", "catalog-sync"), link("job", "catalog-index-refresh")],
  },
  {
    type: "execution",
    slug: "reply-to-comment-2026-04-30",
    title: "Reply to comment 2026-04-30",
    category: "content",
    description:
      "Persisted a threaded reply to a post comment and refreshed the post detail surface.",
    tags: ["execution", "reply", "comments"],
    status: "pass",
    metadata: {
      workflow: "reply-to-comment",
      started: "2026-04-30T20:12:00Z",
      duration: "287ms",
    },
    related: [link("workflow", "reply-to-comment"), link("agent", "comment-operator")],
  },
];

const USERS: CatalogEntity[] = [
  {
    type: "user",
    slug: "guest",
    title: "Guest",
    category: "viewer",
    description:
      "Default unauthenticated terminal visitor identity used until a user signs in or signs up.",
    tags: ["user", "auth", "interaction"],
    avatar: "/favicon.svg",
    related: [link("workflow", "signup-and-login"), link("skill", "auth-identity")],
  },
  {
    type: "user",
    slug: "chris-pecunies",
    title: "Chris Pecunies",
    category: "operator",
    description:
      "Site owner and primary operator identity for posts, replies, workflows, and portfolio content.",
    tags: ["user", "portfolio", "content"],
    avatar: "/favicon.svg",
    related: [link("agent", "portfolio-assistant"), link("agent", "comment-operator")],
  },
];

const PROJECT_SKILL_MAP: Record<string, string[]> = {
  "moe-marketplace": ["edge-routing", "entity-modeling", "feed-synchronization"],
  "zig-runtime": ["entity-modeling", "markdown-delivery"],
  "pi-cluster": ["entity-modeling", "agent-orchestration"],
  "down-nvim": ["markdown-delivery", "entity-modeling"],
};

const PROJECTS: CatalogEntity[] = [
  {
    type: "project",
    slug: "pecunies-terminal",
    title: "pecunies terminal",
    category: "portfolio",
    description:
      "Command-driven personal site and terminal shell backed by Cloudflare Pages, Workers, AI, and editable content metadata.",
    tags: ["portfolio", "terminal", "cloudflare", "catalog"],
    summary:
      "The portfolio itself, including routes, content models, comments, auth, and indexable entity pages.",
    related: [
      link("skill", "edge-routing"),
      link("skill", "entity-modeling"),
      link("skill", "markdown-delivery"),
      link("workflow", "catalog-sync"),
      link("workflow", "route-and-render"),
    ],
  },
  ...resumeData.projects.map((project) => ({
    type: "project" as const,
    slug: project.slug,
    title: project.name,
    category: "portfolio",
    description: project.summary,
    summary: project.details.join(" "),
    tags: [
      "portfolio",
      "project",
      slugify(project.slug),
      ...project.name
        .split(/\s+/)
        .map((part) => slugify(part))
        .filter((tag) => tag.length > 2)
        .slice(0, 3),
    ],
    metadata: {
      period: project.period,
    },
    related: (PROJECT_SKILL_MAP[project.slug] ?? []).map((skillSlug) =>
      link("skill", skillSlug),
    ),
  })),
];

const WORK_ITEMS: CatalogEntity[] = resumeData.experience.map((entry) => ({
  type: "work" as const,
  slug: slugify(entry.role),
  title: `${entry.role} @ ${entry.company}`,
  category: "experience",
  description: entry.summary,
  tags: [
    "portfolio",
    "work",
    slugify(entry.company),
    slugify(entry.role),
    ...entry.company
      .split(/\s+/)
      .map((part) => slugify(part))
      .filter((tag) => tag.length > 2)
      .slice(0, 2),
  ],
  metadata: {
    company: entry.company,
    period: entry.period,
    location: entry.location,
  },
  details: entry.bullets,
  related:
    entry.company.includes("WiseBlocks")
      ? [link("skill", "entity-modeling"), link("project", "marketplace-aggregator")]
      : entry.company.includes("HashGraph")
        ? [link("skill", "agent-orchestration"), link("tool", "workers-edge")]
        : [link("skill", "edge-routing")],
}));

function deriveTagEntities(entities: CatalogEntity[]): CatalogEntity[] {
  const tagUse = new Map<string, CatalogEntity[]>();
  for (const entity of entities) {
    for (const tag of entity.tags) {
      const normalized = slugify(tag);
      const list = tagUse.get(normalized) ?? [];
      list.push(entity);
      tagUse.set(normalized, list);
    }
  }
  return Array.from(tagUse.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, uses]) => ({
      type: "tag" as const,
      slug,
      title: `#${slug}`,
      category: "taxonomy",
      description:
        TAG_DESCRIPTIONS[slug] ??
        `Catalog tag used to group related entities, content, and behavior across the portfolio shell.`,
      tags: ["tags", "catalog"],
      metadata: {
        uses: String(uses.length),
      },
      related: uses
        .slice(0, 12)
        .map((entity) => link(entity.type, entity.slug, entity.title)),
    }));
}

export function buildCatalogSeed(): CatalogEntity[] {
  const seeded = [
    ...SKILLS,
    ...TOOLS,
    ...SYSTEM_PROMPTS,
    ...AGENTS,
    ...STEPS,
    ...WORKFLOWS,
    ...TRIGGERS,
    ...HOOKS,
    ...JOBS,
    ...EXECUTIONS,
    ...USERS,
    ...PROJECTS,
    ...WORK_ITEMS,
  ];
  const tags = deriveTagEntities(seeded);
  return [...seeded, ...tags].sort((a, b) =>
    a.type === b.type
      ? a.title.localeCompare(b.title)
      : a.type.localeCompare(b.type),
  );
}

export function normalizeCatalogType(value: string): CatalogEntityType | null {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const aliases: Record<string, CatalogEntityType> = {
    tag: "tag",
    tags: "tag",
    skill: "skill",
    skills: "skill",
    tool: "tool",
    tools: "tool",
    project: "project",
    projects: "project",
    work: "work",
    workitem: "work",
    workitems: "work",
    workflow: "workflow",
    workflows: "workflow",
    step: "step",
    steps: "step",
    execution: "execution",
    executions: "execution",
    agent: "agent",
    agents: "agent",
    hook: "hook",
    hooks: "hook",
    trigger: "trigger",
    triggers: "trigger",
    user: "user",
    users: "user",
    job: "job",
    jobs: "job",
    systemprompt: "systemprompt",
    systemprompts: "systemprompt",
  };
  return aliases[raw] ?? null;
}

export function commandForEntity(entity: CatalogEntity): string {
  return `${CATALOG_TYPES[entity.type].command} ${entity.slug}`;
}

export function routeForEntity(entity: CatalogEntity): string {
  return `${CATALOG_TYPES[entity.type].routeBase}/${entity.slug}`;
}

export function baseRouteForType(type: CatalogEntityType): string {
  return CATALOG_TYPES[type].routeBase;
}

export function baseCommandForType(type: CatalogEntityType): string {
  return CATALOG_TYPES[type].command;
}

export function catalogSeoTitle(entity: CatalogEntity | null, type?: CatalogEntityType): string {
  if (entity) return `${entity.title} | ${titleizeType(entity.type)} | pecunies`;
  if (type) return `${CATALOG_TYPES[type].title} | pecunies`;
  return "pecunies";
}

export function catalogSeoDescription(entity: CatalogEntity | null, type?: CatalogEntityType): string {
  if (entity) return entity.description;
  if (type) return CATALOG_TYPES[type].description;
  return "Command-driven portfolio and terminal shell for Chris Pecunies.";
}
