# AGENTS.md

## Front (pecunies.com)

### Don't touch
- The background is perfect, don't mess with it.
- The CRT effect is perfect across the board, don't mess with.
- The frosted glass effect on the navbar and the session identity popover background is perfect.

### Data
- All backend/persisted elements should go through api.pecunies.com worker.

## Learned User Preferences
- Prefers macOS-like terminal window behavior (traffic-light controls, dock-style minimize/restore).
- Prefers active theme accents to consistently drive key UI elements like nav selection and brand indicator.
- Treats visible flicker or jitter from backgrounds, CRT-style effects, gradients, particles, or noise layers as unacceptable; prefers stable visuals with performance-first passes.
- When changing backgrounds or overlays, navbar and top chrome must remain present and deliberate (do not regress nav removal).
- Prefers subdued ambient chrome overall: restrained window glow/title bar and understated navbar framing over loud or distracting treatments.
- Chat view theme should track the globally last-used site theme rather than pinning a separate per-view palette.
- Model chosen via session identity should be the active model used for AI chat replies.
- Implicit input that looks like prose (multiple words without a resolved command) should route to AI as `ask`-style querying.

## Learned Workspace Facts
- This workspace is a command-driven terminal-style personal site named pecunies with navbar routes mirroring terminal views.
- Continual-learning transcript index is stored at .cursor/hooks/state/continual-learning-index.json.
- MCP, edge routing, and booking-email are deployed as Cloudflare Workers under workers/ alongside Pages, with MCP split out from the Pages API bundle rather than inlined with it.
- Root npm run deploy is expected to publish Pages plus all Workers in this repository.

## Architecture

### Hosts
- **pecunies.com** — Main SPA (Cloudflare Pages). Serves frontend, handles SEO via edge rewrites.
- **api.pecunies.com** — Edge worker (workers/edge/). Primary API backend. All persistence routes through here.
- **www.pecunies.com** — Redirects to apex domain (301).

### Backend: Edge Worker (`workers/edge/src/index.ts`)
The single Cloudflare Worker handles ALL API and routing. It is NOT the `functions/` directory — that is a legacy bundle that gets merged into the edge worker at build time or is ignored. The edge worker:

1. **Intercepts `api.pecunies.com/*`** — Routes to internal handlers (catalog, crud, comments, history, auth, sudo, mutate, content, os, fs, posts, autocomplete, tag-usage).
2. **Proxy-falls-through** — Unmatched requests forward to `pecunies-chaos-portfolio.pages.dev` (the Pages deployment).
3. **SPA rewrite** — HTML requests to known routes get rewritten to `/` for client-side routing with SEO meta injection via HTMLRewriter.

### Route Dispatch (edge worker `fetch` handler, line 2501)
Order of dispatch:
1. `OPTIONS` → specific handler or generic CORS
2. `/api/catalog` → `handleCatalogApi` (GET + POST only)
3. `/api/crud/**` → `handleCrudApi` (full CRUD: GET/POST/PUT/DELETE)
4. `/api/auth` → `handleAuthApi`
5. `/api/comments` → `handleCommentsApi`
6. `/api/history` → `handleHistoryApi`
7. `/api/autocomplete` → `handleAutocompleteApi`
8. `/api/content` → `handleContentApi`
9. `/api/posts` → `handlePostsApi`
10. `/api/os` → `handleOsApi`
11. `/api/fs` → `handleFsApi`
12. `/api/mutate` → `handleMutateApi`
13. `/api/sudo` or `/api/auth/sudo` → `handleSudoAuth`
14. `/api/tags/:slug/usage` → `handleTagUsageApi`
15. `matchCatalogApiPath` → `handleCatalogApi` (GET/POST for `/api/{type}/{slug}`)
16. Fallback → proxy to Pages upstream

### CRUD System
Two parallel routing paths exist:

#### Path A: `/api/crud/{resource}/{id}` → `handleCrudApi`
This is the **full CRUD handler** supporting GET/POST/PUT/DELETE for:
- **catalog types** (skill, project, tool, command, view, app, link, work, workflow, step, execution, agent, hook, trigger, user, job, systemprompt, data) — internally delegates to `handleCatalogApi`
- **users** — user CRUD with sudo
- **comments** — comment CRUD with sudo
- **history** — command history CRUD
- **content** — content override CRUD
- **config** — session config via os handler
- **files** — filesystem CRUD via fs handler
- **posts** — post CRUD with sudo (syncs to R2)
- **bookings** — booking CRUD with sudo
- **scores** — leaderboard scores with sudo
- **post-events** — post interaction tracking
- **metrics** — metrics recording

#### Path B: `/api/{type}/{slug}` → `handleCatalogApi` + `matchCatalogApiPath`
Matches non-reserved catalog type slugs. Only supports **GET** and **POST**. PUT/DELETE on this path return 405.

**Key insight**: `handleCatalogApi` only handles GET and POST. For PUT/DELETE on catalog entities, the `/api/crud/{type}/{slug}` path must be used. The `handleCrudApi` internally re-dispatches to `handleCatalogApi` with the appropriate `action` field in the body.

### Data Storage
- **D1 Database** (`pecunies-db`) — `catalog_entities` (type/slug/payload_json/deleted/updated_at), `users`, `comments`, `command_history`, `autocomplete_cache`, `content_overrides`, `bookings`
- **R2 Buckets** — `pecunies-posts` (POSTS binding), `pecunies-assets` (STATIC binding)
- **KV Namespace** — `PORTFOLIO_OS` (terminal OS state, leaderboard)

### Catalog Entity Model
```typescript
type CatalogEntity = {
  type: string;        // "skill" | "project" | "tool" | "command" | "view" | "app" | "link" | "tag" | ...
  slug: string;        // URL-safe identifier
  title: string;
  category: string;
  description: string;
  tags: string[];
  yearsOfExperience?: number;
  summary?: string;
  avatar?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
  related?: Array<{ type: string; slug: string; label?: string }>;
};
```
- **Static seed**: `buildCatalogSeed()` from `src/data/catalog.ts` — hardcoded entities
- **Dynamic overrides**: stored in D1 `catalog_entities` table as JSON in `payload_json`
- **Merge**: `mergedCatalog()` combines seed + D1 rows (deleted=false wins over seed) + dynamic users
- **Soft delete**: sets `deleted=1` rather than removing rows

### Sudo Authentication
- Password stored in `env.PECUNIES_SUDO_PASSWD`
- Frontend verifies via `POST /api/sudo` with `{ password }` body
- Once verified, frontend caches password in `this.sudoPassword` and reuses it
- All write operations require `sudoPassword` in request body
- `requireSudo()` helper returns 403 on failure

### Frontend (`src/`)
- **`src/api.ts`** — API client. `apiFetch()` for generic calls, `apiCrudFetch()` for catalog/CRUD operations
- **`src/terminal/app.ts`** — Main terminal application class (~6000 lines). Handles view rendering, command execution, popover UI, sudo modal, entity mutations, tag management
- **`src/terminal/registry.ts`** — Command definitions and handlers
- **`src/data/catalog.ts`** — Catalog type definitions, seed data, normalization functions
- **`src/data/resume.ts`** — Resume data (signals, experience, projects, skills, contact, education)

### API Client Patterns
```typescript
// Generic API call
apiFetch<T>("/api/catalog", { method: "GET" })

// CRUD call (routes to /api/{path})
apiCrudFetch<{ items: CatalogEntity[] }>(["skill"])       // GET /api/skill
apiCrudFetch(["skill", "my-skill"])                       // GET /api/skill/my-skill
apiCrudFetch(["skill", "my-skill"], {                     // PUT /api/skill/my-skill
  method: "PUT",
  body: JSON.stringify({ entity, sudoPassword })
})
apiCrudFetch(["skill", "my-skill"], {                     // DELETE /api/skill/my-skill
  method: "DELETE",
  body: JSON.stringify({ sudoPassword })
})
```

### Workers Directory Structure
- `workers/edge/` — Main edge worker (routing, API, SEO, proxy)
- `workers/mcp/` — MCP (Model Context Protocol) worker
- `workers/booking-email/` — Booking email notification worker

### Deployment
- `npm run deploy` — Publishes Pages + all Workers
- Edge worker routes: `pecunies.com/*`, `www.pecunies.com/*`, `api.pecunies.com/*`
- `functions/` directory is used by Pages for function-based routes but the edge worker takes precedence for all `api.pecunies.com` traffic

## dependencies
- use @cloudflare/agents https://github.com/cloudflare/agents/tree/main/packages/agents
  - for agent tools: https://github.com/cloudflare/agents/blob/main/docs/agent-tools.md
- use @cloudflare/codemode https://github.com/cloudflare/agents/tree/main/packages/codemode/README.md
- use @cloudflare/ai-chat https://github.com/cloudflare/agents/tree/main/packages/ai-chat
- use @cloudflare/worker-bundler https://github.com/cloudflare/agents/tree/main/packages/worker-bundler
- use @cloudflare/think https://github.com/cloudflare/agents/tree/main/packages/think
- use @cloudflare/shell https://github.com/cloudflare/agents/tree/main/packages/shell
- use workflows: https://developers.cloudflare.com/workflows/
- for browser/web: https://developers.cloudflare.com/agents/api-reference/browse-the-web/
- durable execution: https://developers.cloudflare.com/agents/api-reference/durable-execution/
- callable methods: https://developers.cloudflare.com/agents/api-reference/callable-methods/
- sessions: https://developers.cloudflare.com/agents/api-reference/sessions/
- store/sync: https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/
- use cloudflare/voice: https://github.com/cloudflare/agents/tree/main/packages/voice
- follow patterns: https://developers.cloudflare.com/agents/patterns/
