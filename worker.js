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

    const slug = url.pathname.slice('/commanders/'.length);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return new Response('Invalid commander slug', { status: 400, headers: corsHeaders() });
    }
    try {
      const requestHeaders = {
          // Use a real browser User-Agent — EDHREC blocks generic/bot agents
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://edhrec.com/',
      };
      let upstream = await fetch(`https://json.edhrec.com/pages/commanders/${slug}.json`, {
        headers: requestHeaders,
        redirect: 'follow',
      });

      // Some valid commander pair pages are available on edhrec.com even
      // when the corresponding static JSON page is missing. Fall back to the
      // rendered page so the browser parser can read its embedded page data.
      if (upstream.status === 404) {
        upstream = await fetch(`https://edhrec.com/commanders/${slug}`, {
          headers: {
            ...requestHeaders,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
        });
      }

      let body = await upstream.text();
      if (upstream.ok && (upstream.headers.get('Content-Type') || '').includes('json')) {
        let hasCommanderCard = false;
        try {
          const data = JSON.parse(body);
          hasCommanderCard = !!(
            data?.container?.json_dict?.card
            || data?.props?.pageProps?.data?.container?.json_dict?.card
            || data?.props?.pageProps?.container?.json_dict?.card
            || data?.props?.pageProps?.data?.card
          );
        } catch {}
        if (!hasCommanderCard) {
          upstream = await fetch(`https://edhrec.com/commanders/${slug}`, {
            headers: {
              ...requestHeaders,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'follow',
          });
          body = await upstream.text();
        }
      }

      // Only cache real answers (a page, or a definite 404). Caching a 429 or
      // 5xx would keep serving the error after EDHREC has recovered.
      const cacheable = upstream.ok || upstream.status === 404;
      const headers = {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
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
