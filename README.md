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

## Posts Source Of Truth

- Canonical markdown files live in `assets/posts/<year>/<month>/<day>/<slug>.md`.
- Runtime OS mirrors each post in both `/posts/...` and `/assets/posts/...` so terminal filesystem commands stay consistent.
- D1/KV sync can be run with:

```sh
POST_SYNC_ENDPOINT="https://<your-site>/api/posts-sync" \
POST_SYNC_TOKEN="<shared-secret>" \
npm run sync:posts
```

- The sync endpoint requires `POSTS_SYNC_TOKEN` in Cloudflare Pages environment variables and updates both storage layers (`PORTFOLIO_OS` + `POSTS_DB`).
- Optional local push hook: `git config core.hooksPath .githooks` to run `npm run sync:posts` before each `git push`.
