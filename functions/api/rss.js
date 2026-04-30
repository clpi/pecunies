import { buildRssXml } from './posts.js';

const headers = {
  'Content-Type': 'application/rss+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=120',
};

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const xml = await buildRssXml(env, origin);
  return new Response(xml, { headers });
}

export async function onRequest() {
  return new Response('Method not allowed', { status: 405, headers });
}
