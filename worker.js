/**
 * EDH Hipster Quotient — EDHREC CORS Proxy
 * Deploy this as a Cloudflare Worker (free tier: 100k req/day).
 *
 * It accepts requests like:
 *   GET https://your-worker.your-subdomain.workers.dev/commanders/the-ur-dragon
 *
 * And proxies them to:
 *   GET https://edhrec.com/commanders/the-ur-dragon
 *
 * Adding CORS headers so the GitHub Pages site can read the response.
 *
 * DEPLOY STEPS:
 * 1. Go to https://dash.cloudflare.com and sign up / log in (free)
 * 2. Click "Workers & Pages" → "Create" → "Create Worker"
 * 3. Replace the default script with this file's contents
 * 4. Click "Deploy"
 * 5. Copy the worker URL (e.g. https://edhrec-proxy.yourname.workers.dev)
 * 6. Set PROXY_BASE in index.html to that URL
 */

const EDHREC_BASE = 'https://edhrec.com';

// Only allow requests from your GitHub Pages site.
// Change this to your actual deployed URL, or set to '*' during testing.
const ALLOWED_ORIGIN = 'https://jimna-h.github.io';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only proxy /commanders/* paths
    if (!url.pathname.startsWith('/commanders/')) {
      return new Response('Not found', { status: 404 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const target = `${EDHREC_BASE}${url.pathname}`;

    try {
      const upstream = await fetch(target, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; EDHHipsterQuotient/1.0)',
        },
        // Follow redirects (EDHREC occasionally redirects slug variants)
        redirect: 'follow',
      });

      const body = await upstream.text();

      return new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // cache 5 min to reduce upstream load
          ...corsHeaders(request),
        },
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, {
        status: 502,
        headers: corsHeaders(request),
      });
    }
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGIN === '*' || origin === ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Vary': 'Origin',
  };
}
