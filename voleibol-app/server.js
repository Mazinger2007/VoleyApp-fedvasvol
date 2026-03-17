/* eslint-disable no-console */
// Proxy AJAX local para evitar CORS en dev

const http = require('http');
const axios = require('axios');
const url = require('url');

const PROXY_PORT = process.env.PROXY_PORT || 3001;
const FEDVAS_BASE = 'https://fedvasvol.com';

// Cache simple en memoria para evitar duplicados
const requestCache = new Map();
const CACHE_TTL = 60000; // 1 min

async function handleAjaxRequest(queryParams) {
  const cacheKey = new url.URLSearchParams(queryParams).toString();
  const cached = requestCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    console.log('[proxy] ✓ CACHE HIT:', { type: queryParams.type, id: queryParams.id });
    return cached.data;
  }

  try {
    console.log('[proxy] → REQUEST:', {
      type: queryParams.type,
      id: queryParams.id,
      data: queryParams.data ? '***TOKEN***' : 'NO_TOKEN',
      rows: queryParams.rows,
      input: queryParams.input || '(empty)',
    });

    const response = await axios.get(`${FEDVAS_BASE}/es/ajax/table-search`, {
      params: queryParams,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });

    const data = response.data;
    
    // Log si es un error de Fedvas
    if (data && data.code && data.code !== 0) {
      console.log('[proxy] ⚠️ FEDVAS ERROR:', {
        code: data.code,
        toast: data.toast,
      });
    } else {
      console.log('[proxy] ✓ SUCCESS:', {
        type: queryParams.type,
        id: queryParams.id,
        contentLength: data.content ? data.content.length : 0,
      });
    }

    requestCache.set(cacheKey, { data, time: Date.now() });
    return data;
  } catch (error) {
    console.error('[proxy] ✗ NETWORK ERROR:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers para que React Native pueda llamar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url.startsWith('/proxy/ajax')) {
    try {
      const parsedUrl = url.parse(req.url, true);
      const queryParams = parsedUrl.query;

      console.log(`[proxy] GET /proxy/ajax`, queryParams);

      const result = await handleAjaxRequest(queryParams);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('[proxy] ✗ CATCH ERROR:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message, code: -1 }));
    }
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PROXY_PORT, () => {
  console.log(`[proxy] listening on http://localhost:${PROXY_PORT}`);
  console.log(`[proxy] use: http://localhost:${PROXY_PORT}/proxy/ajax?type=12&id=...`);
});
