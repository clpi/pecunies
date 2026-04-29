# Pecunies Terminal Portfolio

One-page terminal emulator portfolio for Chris Pecunies.

## What It Does

- Renders resume, work history, projects, skills, timeline, links, posts, contact, chat, and PDF views as terminal output.
- Provides a command registry in `src/terminal/registry.ts` so new commands and views can be added from one place.
- Uses Cloudflare Pages Functions for stateful OS commands, Workers AI chat/explain/ask flows, metrics, leaderboard state, and the fake filesystem.
- Uses a theme-aware particle vortex background and a glass terminal window with autocomplete, man pages, and local TUI games.

## Local Development

```sh
npm ci
npm run build
npm run dev
```

## Deploy

```sh
npm run deploy:cloudflare
```

The Cloudflare project expects the `PORTFOLIO_OS` KV binding and `AI` Workers AI binding configured in `wrangler.jsonc`.
