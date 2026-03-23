// src/services/ajaxProxy.js
// En desarrollo, usa Metro to proxy requests. En producción, usa un backend propio.

const isDev = __DEV__; // Expo sets this automatically

/**
 * Call AJAX endpoint via a proxy to bypass CORS.
 * Falls back to direct fetch if proxy unavailable.
 */
export async function proxyAjaxTableSearch(params = {}) {
  // En dev (Expo), intenta local metro dev server primero
  // Luego fallback a direct (puede fallar por CORS, pero lo intentamos)
  
  try {
    // Intenta vía proxy local (requeriría servidor backend)
    // Por ahora: fallback directo con headers que minimicen CORS issues
    const url = new URL('https://fedvasvol.com/es/ajax/table-search');
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
      },
      credentials: 'include', // Include cookies if any
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    return text;
  } catch (error) {
    // En caso de CORS u otro error, lanzar para que el parser pueda fallback a HTML
    throw new Error(`AJAX proxy failed: ${error.message}`);
  }
}
