// Fetch wrapper tipis ke REST API Supabase (PostgREST) pakai service_role key.
// Cuma dipakai dari /api/*.js (server-side) -- service_role key TIDAK BOLEH pernah
// dikirim ke browser, beda total dari publishable key yang ada di index.html.

function qs(params) {
  return Object.entries(params || {})
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

async function sbFetch(path, options = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${options.method || 'GET'} ${path} gagal: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// params: object PostgREST filter, mis. { select: '*', id: `eq.${id}` }
async function sbSelect(table, params) {
  const query = qs(params);
  return sbFetch(`${table}${query ? '?' + query : ''}`, { method: 'GET' });
}

async function sbInsert(table, body) {
  return sbFetch(table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
}

async function sbUpdate(table, matchParams, body) {
  const query = qs(matchParams);
  return sbFetch(`${table}?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
}

async function sbUpsert(table, body, onConflictColumn) {
  return sbFetch(`${table}?on_conflict=${encodeURIComponent(onConflictColumn)}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
}

module.exports = { sbSelect, sbInsert, sbUpdate, sbUpsert };
