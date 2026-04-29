const STATIC_POSTS = {
  '/posts/terminal-portfolio-changelog.md':
    '# Terminal Portfolio Changelog\n\nInitial post placeholder for the terminal-native writing system. Posts are markdown files under `/posts`; creating, editing, or removing them requires sudo privileges.',
};

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export async function onRequestGet({ env }) {
  const posts = [];

  for (const [path, markdown] of Object.entries(STATIC_POSTS)) {
    posts.push(await postPayload(path, markdown, env));
  }

  if (env.PORTFOLIO_OS?.list) {
    let cursor;

    do {
      const page = await env.PORTFOLIO_OS.list({ prefix: 'file:/posts/', cursor, limit: 1000 });
      cursor = page.cursor;

      for (const key of page.keys ?? []) {
        const path = key.name.replace(/^file:/, '');
        const markdown = await env.PORTFOLIO_OS.get(key.name);

        if (markdown) {
          posts.push(await postPayload(path, markdown, env));
        }
      }
    } while (cursor);
  }

  posts.sort((a, b) => b.updated.localeCompare(a.updated));
  return Response.json({ posts }, { headers: jsonHeaders });
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function postPayload(path, markdown, env) {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? path.split('/').pop()?.replace(/\.md$/, '') ?? path;
  const comments = env.PORTFOLIO_OS
    ? (await env.PORTFOLIO_OS.get(`comments:${path}`, { type: 'json' })) ?? []
    : [];

  return {
    path,
    slug: path.split('/').pop()?.replace(/\.md$/, '') ?? path,
    title,
    markdown,
    updated: new Date().toISOString(),
    comments: Array.isArray(comments) ? comments : [],
  };
}
