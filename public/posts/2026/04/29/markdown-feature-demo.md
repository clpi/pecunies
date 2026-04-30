---
title: Markdown Feature Demo
date: 2026-04-29
tags: writing, content, terminal, demo
description: Demo post showing markdown syntax, metadata, and syntax-highlighted code blocks.
---

# Markdown Feature Demo

This demo post exists to validate the full markdown rendering pipeline used by the published `/posts` view.

## Metadata Checklist

- `title`, `date`, `tags`, and `description` are present in frontmatter.
- This file follows the canonical path format in `public/posts/YYYY/MM/DD/slug.md`.
- The same content should be mirrored into OS `/posts` and synced into D1.

## Text Formatting

**Bold text**, *italic text*, ***bold italic***, ~~strikethrough~~, and inline code like `npm run build`.

> Blockquote test: terminal-native writing supports quote blocks for callouts.

### Ordered + Unordered Lists

1. First ordered item
2. Second ordered item
   - Nested bullet A
   - Nested bullet B
3. Third ordered item

---

## Links and Table

- Portfolio home: [pecunies.com](https://pecunies.com)
- Cloudflare docs: [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)

| Feature | Status | Notes |
| --- | --- | --- |
| Frontmatter parsing | Working | Includes title/date/tags/description |
| Markdown rendering | Working | Headings, lists, links, quote, table |
| Syntax highlighting | Working | See code blocks below |

## Code Blocks

```ts
type Theme = 'auto' | 'red' | 'amber' | 'frost' | 'green' | 'magenta' | 'blue';

export function resolveTheme(route: string): Theme {
  const map: Record<string, Theme> = {
    home: 'blue',
    about: 'green',
    resume: 'green',
    projects: 'orange' as Theme,
    posts: 'red',
  };
  return map[route] ?? 'auto';
}
```

```js
async function syncPosts(endpoint, token, posts) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ posts, prune: true }),
  });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  return res.json();
}
```

```bash
# local sync example
POST_SYNC_ENDPOINT="https://example.com/api/posts-sync" \
POST_SYNC_TOKEN="***" \
npm run sync:posts
```

```json
{
  "post": "markdown-feature-demo",
  "published": true,
  "source": "/public/posts/2026/04/29/markdown-feature-demo.md"
}
```

## Closing

If this post appears in `/posts` and opens correctly, markdown + code rendering + metadata ingest are all operating as expected.
