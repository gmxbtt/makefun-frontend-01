// make.fun public API client: GET only, ETag revalidation, dedupe, tiny cache.
// Base is the only absolute URL the app uses; everything else is a relative path.
export const API = 'https://make.fun/api';

const mem = new Map(); // path -> { etag, body, at }
const inflight = new Map(); // path -> Promise
let requests = 0; // network requests actually sent
let lastOk = 0;

function readStore(path) {
  try {
    const raw = sessionStorage.getItem('mf:' + path);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && v.body !== undefined ? v : null;
  } catch { return null; }
}

function writeStore(path, entry) {
  try { sessionStorage.setItem('mf:' + path, JSON.stringify(entry)); } catch { /* storage full/blocked: memory cache still works */ }
}

export function stats() {
  return { requests, lastOk };
}

// Fetch JSON with ETag revalidation. ttlMs bounds how stale a cached copy may be
// before we even revalidate (board data changes every minute at most: ETags are minute-bound).
export async function getJSON(path, ttlMs = 60000) {
  const cached = mem.get(path) || readStore(path);
  if (cached) mem.set(path, cached);
  if (cached && Date.now() - cached.at < ttlMs) return cached.body;
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    const headers = {};
    if (cached && cached.etag) headers['If-None-Match'] = cached.etag;
    requests++;
    const res = await fetch(API + path, { headers });
    if (res.status === 304 && cached) {
      cached.at = Date.now();
      mem.set(path, cached);
      writeStore(path, cached);
      lastOk = Date.now();
      return cached.body;
    }
    if (!res.ok) throw new Error('API ' + res.status + ' for ' + path);
    const body = await res.json();
    const entry = { etag: res.headers.get('ETag') || null, body, at: Date.now() };
    mem.set(path, entry);
    writeStore(path, entry);
    lastOk = Date.now();
    return body;
  })();
  inflight.set(path, p);
  try { return await p; } finally { inflight.delete(path); }
}

export const board = (status = 'open') =>
  getJSON('/competitions?status=' + status + '&activity=times');
export const bounty = (slug) => getJSON('/competitions/' + encodeURIComponent(slug));
export const leaderboard = (slug, view = 'overall') =>
  getJSON('/competitions/' + encodeURIComponent(slug) + '/leaderboard?view=' + view);
export const profile = (handle) => getJSON('/profiles/' + encodeURIComponent(handle));

// Force a fresh copy next time (Refresh button): drop cache, keep counts.
export function bust(path) {
  mem.delete(path);
  try { sessionStorage.removeItem('mf:' + path); } catch { /* ignore */ }
}
