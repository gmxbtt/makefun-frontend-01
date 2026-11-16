// Small formatting helpers. No dependencies.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Money: API amounts arrive as strings like "685.50" or numbers. Integers print
// bare ($500); non-integers keep two decimals ($685.50).
export function money(v) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (n == null || Number.isNaN(n)) return '—';
  const dec = Number.isInteger(n) ? 0 : 2;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: 2 });
}

export function num(v) {
  const n = typeof v === 'string' ? Number(v) : v;
  return n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US');
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// "2d 4h left", "37m left", "Closed 3h ago". Pure function of now, so the ticker can refresh it.
export function timeLeft(iso, now = Date.now()) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = t - now;
  const abs = Math.abs(diff);
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const s = d > 0 ? d + 'd ' + (h % 24) + 'h' : h > 0 ? h + 'h ' + (m % 60) + 'm' : m + 'm';
  return diff >= 0 ? s + ' left' : 'Closed ' + s + ' ago';
}

export function relTime(iso, now = Date.now()) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = now - t;
  if (diff < 45000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// Win rate: API stores it as micro units (950587 = 0.950587).
export function winRate(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return (Number(v) / 1e6).toFixed(3);
}
