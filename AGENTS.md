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

## dependencies
- use @cloudflare/agents https://github.com/cloudflare/agents/tree/main/packages/agents
  - for agent tools: https://github.com/cloudflare/agents/blob/main/docs/agent-tools.md
- use @cloudflare/codemode https://github.com/cloudflare/agents/blob/main/packages/codemode/README.md
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
