/**
 * EDH Hipster Quotient — EDHREC CORS Proxy
 * Deploy as a Cloudflare Worker (free tier: 100k req/day).
 *
 * DEPLOY STEPS:
 * 1. dash.cloudflare.com → Workers & Pages → Create → Create Worker
 * 2. Paste this script, click Deploy
 * 3. Copy the worker URL and set PROXY_BASE in index.html to it
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Only proxy /commanders/* paths
    if (!url.pathname.startsWith('/commanders/')) {
      return new Response('Not found', { status: 404, headers: corsHeaders() });
    }

    const target = `https://edhrec.com${url.pathname}`;

    try {
      const upstream = await fetch(target, {
        headers: {
          // Use a real browser User-Agent — EDHREC blocks generic/bot agents
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://edhrec.com/',
        },
        redirect: 'follow',
      });

      const body = await upstream.text();

      // Only cache real answers (a page, or a definite 404). Caching a 429 or
      // 5xx would keep serving the error after EDHREC has recovered.
      const cacheable = upstream.ok || upstream.status === 404;
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': cacheable ? 'public, max-age=300' : 'no-store',
        ...corsHeaders(),
      };
      const retryAfter = upstream.headers.get('Retry-After');
      if (retryAfter) headers['Retry-After'] = retryAfter;

      return new Response(body, { status: upstream.status, headers });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, {
        status: 502,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Expose-Headers': 'Retry-After',
  };
}
