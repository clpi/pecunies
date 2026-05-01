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
