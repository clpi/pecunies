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

  const route = String(body?.route ?? 'unknown').replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 80) || 'unknown';
  const metrics = await readMetrics(env);
  metrics.visits += 1;
  metrics.pages[route] = Number(metrics.pages[route] ?? 0) + 1;
  const country = request.cf?.country ?? 'XX';
  metrics.countries[country] = Number(metrics.countries[country] ?? 0) + 1;
  await writeMetrics(env, metrics);
  await writeMetricEvent(env, { type: 'page', route, country, at: new Date().toISOString() });

  return Response.json({ ok: true }, { headers: jsonHeaders });
}

export async function onRequest() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
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

function defaultMetrics() {
  return {
    visits: 0,
    pages: {},
    commands: {},
    countries: {},
  };
}

async function writeMetricEvent(env, event) {
  if (!env.PORTFOLIO_OS) {
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.PORTFOLIO_OS.put(`metric:event:${id}`, JSON.stringify(event), {
    expirationTtl: 60 * 60 * 24 * 365,
  });
}
