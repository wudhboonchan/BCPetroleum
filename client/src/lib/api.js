async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  const ct = res.headers.get('content-type');
  const data = ct?.includes('application/json') ? await res.json() : { error: `${res.status} ${res.statusText}` };

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/login';
      return;
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  get: (url, params) => {
    if (params) url += '?' + new URLSearchParams(params);
    return request(url);
  },
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put:  (url, body) => request(url, { method: 'PUT',  body: JSON.stringify(body) }),
  del:  (url)       => request(url, { method: 'DELETE' }),
};
