const PAGES_ORIGIN = 'https://pecunies-chaos-portfolio.pages.dev';
const APEX_HOST = 'pecunies.com';
const WWW_HOST = 'www.pecunies.com';
const API_HOST = 'api.pecunies.com';
const MCP_HOST = 'mcp.pecunies.com';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === WWW_HOST) {
      url.hostname = APEX_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const upstreamUrl = new URL(request.url);
    upstreamUrl.hostname = 'pecunies-chaos-portfolio.pages.dev';
    upstreamUrl.protocol = 'https:';
    upstreamUrl.port = '';

    if (url.hostname === API_HOST && !upstreamUrl.pathname.startsWith('/api/')) {
      upstreamUrl.pathname = `/api${upstreamUrl.pathname === '/' ? '/knowledge' : upstreamUrl.pathname}`;
    }

    if (url.hostname === MCP_HOST) {
      upstreamUrl.pathname = '/api/mcp';
    }

    const upstreamRequest = new Request(upstreamUrl.toString(), request);
    const response = await fetch(upstreamRequest, {
      cf: {
        cacheEverything: request.method === 'GET',
      },
    });

    const headers = new Headers(response.headers);
    headers.set('x-portfolio-edge', 'pecunies');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
