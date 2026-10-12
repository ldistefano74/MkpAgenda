const BASE_URL = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '');

function getCsrfToken() {
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('csrftoken='))
    ?.split('=')[1];
}

async function request(path, options = {}) {
  const url = path.startsWith('/') ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`;
  const headers = options.headers ?? {};
  const method = (options.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRFToken'] = csrfToken;
  }
  const opts = {
    credentials: 'include',
    ...options,
    headers,
  };

  // JSON body handling (no content-type for FormData)
  if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    opts.headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...opts.headers };
    opts.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  let body = null;
  if (ct.includes('application/json')) {
    try { body = await res.json(); }
    catch (e) { body = null; console.log('Failed to parse JSON response', e); }
  }
  else {
    body = await res.text();
  }

  if (!res.ok) {
    const err = new Error(body?.detail || body?.message || res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export default {
  request,
  get: (path, opts) => request(path, { method: 'GET', ...opts }),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts) => request(path, { method: 'PUT', body, ...opts }),
  patch: (path, body, opts) => request(path, { method: 'PATCH', body, ...opts }),
  delete: (path, opts) => request(path, { method: 'DELETE', ...opts }),
};