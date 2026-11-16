// Renderers: each surface is one pure function of live API data -> HTML string.
// All API text goes through esc(); the only markup we build is our own.
import { esc, money, num, fmtDate, timeLeft, relTime, winRate } from './format.js';

// --- tiny markdown: headings, paragraphs, bullet lists, **bold**, `code` ---
export function md(src) {
  const lines = String(src || '').split('\n');
  let out = '';
  let list = false;
  const inline = (t) => esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const closeList = () => { if (list) { out += '</ul>'; list = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      out += '<h' + (level + 2) + '>' + inline(line.replace(/^#+\s*/, '')) + '</h' + (level + 2) + '>';
    } else if (/^[-*]\s+/.test(line)) {
      if (!list) { out += '<ul>'; list = true; }
      out += '<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>';
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out += '<p>' + inline(line) + '</p>';
    }
  }
  closeList();
  return out;
}

// API image URLs are often root-relative (/api/avatars/….webp): resolve them
// against make.fun, never against our own server. Absolute URLs pass through.
function imgUrl(u) {
  const s = String(u || '');
  if (s.startsWith('/')) return 'https://make.fun' + s;
  return s;
}

function sponsor(s) {
  if (!s) return '';
  const name = esc(s.name || s.slug || '');
  const inner = (s.logo ? '<img class="slogo" src="' + esc(imgUrl(s.logo)) + '" alt="" crossorigin="anonymous" loading="lazy">' : '') + name;
  return s.isVerified ? '<span class="sponsor" title="Verified sponsor">' + inner + ' ✓</span>' : '<span class="sponsor">' + inner + '</span>';
}

function openBadge(b) {
  const left = b.deadline ? new Date(b.deadline).getTime() - Date.now() : NaN;
  const open = b.status === 'open' && (Number.isNaN(left) || left > 0);
  return open ? '<span class="badge open">Open</span>' : '<span class="badge closed">Closed</span>';
}

// --- Board ---
export function boardView(items, ui) {
  const q = (ui.q || '').toLowerCase();
  let rows = items.filter((b) => !q || ((b.title || '') + ' ' + (b.slug || '') + ' ' + (b.category || '') + ' ' + (b.description || '')).toLowerCase().includes(q));
  const sort = ui.sort || 'deadline';
  rows = rows.slice().sort((a, b) => {
    if (sort === 'pot') return Number(b.potUsd || 0) - Number(a.potUsd || 0);
    if (sort === 'entries') return (b.submissionCount || 0) - (a.submissionCount || 0);
    const da = new Date(a.deadline || 0).getTime(), db = new Date(b.deadline || 0).getTime();
    return (Number.isNaN(da) ? Infinity : da) - (Number.isNaN(db) ? Infinity : db);
  });
  const total = rows.length;
  const shown = rows.slice(0, ui.limit || 24);
  const cards = shown.map((b) => {
    const fee = b.entryFeeUsd != null ? money(b.entryFeeUsd) + ' fee' : 'Free entry';
    return '<article class="card">'
      + '<h2><a href="#/bounty/' + esc(b.slug) + '">' + esc(b.title || b.slug) + '</a></h2>'
      + '<p class="meta">' + sponsor(b.sponsor) + (b.category ? ' · ' + esc(b.category) : '') + '</p>'
      + '<p class="desc">' + esc((b.description || '').slice(0, 160)) + '</p>'
      + '<p class="stats"><span class="pot">' + money(b.potUsd) + ' pot</span>'
      + '<span>' + esc(fee) + '</span>'
      + '<span class="cd" data-deadline="' + esc(b.deadline || '') + '">' + esc(timeLeft(b.deadline)) + '</span>'
      + '<span>' + num(b.submissionCount) + ' entries</span></p>'
      + '<p class="links"><a href="#/bounty/' + esc(b.slug) + '">Details</a> · '
      + '<a href="#/bounty/' + esc(b.slug) + '/leaderboard">Leaderboard</a></p>'
      + '</article>';
  }).join('');
  return '<section class="board">'
    + '<div class="boardhead"><h1>Live bounties</h1>'
    + '<p>' + num(total) + ' shown · pots update live from the make.fun API</p></div>'
    + '<div class="controls" role="group" aria-label="Board controls">'
    + '<label>Sort <select id="sort"><option value="deadline"' + (sort === 'deadline' ? ' selected' : '') + '>Deadline</option>'
    + '<option value="pot"' + (sort === 'pot' ? ' selected' : '') + '>Biggest pot</option>'
    + '<option value="entries"' + (sort === 'entries' ? ' selected' : '') + '>Most entries</option></select></label>'
    + '<button id="togOpen" type="button" aria-pressed="' + (ui.status === 'open') + '">' + (ui.status === 'open' ? 'Showing open · show closed' : 'Showing closed · show open') + '</button>'
    + '</div>'
    + '<div class="grid">' + (cards || '<p class="empty">No bounties match.</p>') + '</div>'
    + (total > shown.length ? '<p class="more"><button id="more" type="button">Show more (' + (total - shown.length) + ' left)</button></p>' : '')
    + '</section>';
}

// --- Bounty page ---
export function bountyView(b) {
  const rewards = (b.rewardsNow && b.rewardsNow.length ? b.rewardsNow : []).map((r) =>
    '<tr><td>#' + num(r.place) + '</td><td>' + money(r.baseUsd) + '</td><td>' + money(r.feeShareUsd) + '</td><td><strong>' + money(r.amountUsd) + '</strong></td></tr>').join('');
  const skills = (b.skills || []).map((s) => '<span class="tag">' + esc(s) + '</span>').join(' ');
  return '<article class="bounty">'
    + '<p class="crumbs"><a href="#/">Board</a> / ' + esc(b.category || 'bounty') + '</p>'
    + '<h1>' + esc(b.title || b.slug) + '</h1>'
    + '<p class="meta">' + openBadge(b) + ' ' + sponsor(b.sponsor) + ' ' + skills + '</p>'
    + '<p class="stats big"><span class="pot">' + money(b.potUsd) + ' live pot</span>'
    + '<span>' + (b.entryFeeUsd != null ? money(b.entryFeeUsd) + ' entry fee' : 'Free entry') + '</span>'
    + '<span class="cd" data-deadline="' + esc(b.deadline || '') + '">' + esc(timeLeft(b.deadline)) + '</span>'
    + '<span>' + num(b.submissionCount) + ' entries</span></p>'
    + (b.summary ? '<p class="summary">' + esc(b.summary) + '</p>' : '')
    + '<div class="desc">' + md(b.description || '') + '</div>'
    + (rewards ? '<h2>Rewards</h2><table class="rewards"><thead><tr><th>Place</th><th>Base</th><th>Fee share</th><th>Total</th></tr></thead><tbody>' + rewards + '</tbody></table>'
      + '<p class="note">Fee shares grow as more entries pay in — the pot above is live.</p>' : '')
    + '<h2>Dates &amp; status</h2><dl class="dates">'
    + '<dt>Deadline</dt><dd>' + esc(fmtDate(b.deadline)) + ' (<span class="cd" data-deadline="' + esc(b.deadline || '') + '">' + esc(timeLeft(b.deadline)) + '</span>)</dd>'
    + '<dt>Published</dt><dd>' + esc(fmtDate(b.publishedAt)) + '</dd>'
    + '<dt>Status</dt><dd>' + esc(b.status || '—') + ' — entries close at the deadline above</dd></dl>'
    + (b.rules ? '<h2>Rules</h2><div class="desc rules">' + md(b.rules) + '</div>' : '')
    + '<p class="links"><a class="btn" href="#/bounty/' + esc(b.slug) + '/leaderboard">View leaderboard →</a></p>'
    + '</article>';
}

// --- Leaderboard ---
export function leaderboardView(data, slug, view) {
  const entries = data.entries || [];
  const rows = entries.map((e) => {
    const v = e.values || {};
    const rate = v.judge != null ? winRate(v.judge) : '—';
    const lo = v.judge_low != null ? winRate(v.judge_low) : '';
    const hi = v.judge_high != null ? winRate(v.judge_high) : '';
    const interval = lo && hi ? ' <span class="iv">90% CI ' + lo + '–' + hi + '</span>' : '';
    return '<tr><td>' + num(e.rank) + '</td>'
      + '<td><a class="handle" href="#/u/' + esc(e.handle) + '">' + (e.image ? '<img class="avatar" src="' + esc(imgUrl(e.image)) + '" alt="" crossorigin="anonymous" loading="lazy">' : '') + esc(e.handle) + '</a></td>'
      + '<td>' + esc(e.title || '') + '</td>'
      + '<td><strong>' + rate + '</strong>' + interval + '</td>'
      + '<td>' + (v.valid ? '✓ valid' : '—') + '</td>'
      + '<td>' + num(v.bytes) + ' B</td>'
      + '<td>' + esc(relTime(e.received_at)) + '</td></tr>';
  }).join('');
  return '<section class="lb">'
    + '<p class="crumbs"><a href="#/">Board</a> / <a href="#/bounty/' + esc(slug) + '">' + esc(slug) + '</a> / leaderboard</p>'
    + '<h1>Leaderboard <span class="sub">— ' + esc(slug) + '</span></h1>'
    + '<div class="controls"><div class="tabs" role="group" aria-label="Leaderboard view">'
    + '<a class="tab' + (view === 'overall' ? ' on' : '') + '" href="#/bounty/' + esc(slug) + '/leaderboard?view=overall">Overall</a>'
    + '<a class="tab' + (view !== 'overall' ? ' on' : '') + '" href="#/bounty/' + esc(slug) + '/leaderboard?view=performance">Performance</a>'
    + '</div><span>' + num(entries.length) + ' entries ranked</span></div>'
    + (rows ? '<div class="tablewrap"><table class="lbtable"><thead><tr><th>#</th><th>Agent</th><th>Entry</th><th>Win rate</th><th>Valid</th><th>Dossier</th><th>Received</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="empty">No ranked entries yet.</p>')
    + '</section>';
}

// --- Profile ---
export function profileView(p) {
  const r = p.record || {};
  const stats = [['Entered', r.competitions_entered], ['Placed', r.competitions_placed], ['Won', r.competitions_won],
    ['Podiums', r.podium_finishes], ['Best place', r.best_placement], ['Prize money', r.prize_usd != null ? money(r.prize_usd) : null]];
  const sols = (p.solutions || []).map((s) => {
    const title = esc(s.title || s.slug || s.competition || 'Entry');
    const comp = s.competition || s.slug || s.competition_slug || '';
    const link = comp ? '<a href="#/bounty/' + esc(comp) + '">' + esc(comp) + '</a>' : '';
    return '<li><strong>' + title + '</strong>' + (link ? ' — ' + link : '') + (s.placement != null ? ' · placed #' + num(s.placement) : '') + '</li>';
  }).join('');
  const links = [];
  if (p.github_login) links.push('<a href="https://github.com/' + esc(p.github_login) + '">GitHub @' + esc(p.github_login) + '</a>');
  if (p.discord && p.discord.username) links.push('<a href="' + esc(p.discord.url || '#') + '">Discord ' + esc(p.discord.username) + '</a>');
  if (p.x) links.push('<a href="https://x.com/' + esc(String(p.x).replace(/^@/, '')) + '">X ' + esc(p.x) + '</a>');
  return '<article class="profile">'
    + '<header class="phead">'
    + (p.image || p.avatar ? '<img class="pavatar" src="' + esc(imgUrl(p.image || p.avatar)) + '" alt="" crossorigin="anonymous">' : '')
    + '<div><h1>' + esc(p.display_name || p.handle) + '</h1><p class="handle">@' + esc(p.handle) + '</p>'
    + (p.bio ? '<p class="bio">' + esc(p.bio) + '</p>' : '')
    + (links.length ? '<p class="plinks">' + links.join(' · ') + '</p>' : '')
    + '<p class="meta">Joined ' + esc(fmtDate(p.joined_at)) + (p.wallet ? ' · wallet <code>' + esc(String(p.wallet).slice(0, 8)) + '…' + esc(String(p.wallet).slice(-4)) + '</code>' : '') + '</p></div>'
    + '</header>'
    + '<dl class="record">' + stats.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + (v == null ? '—' : (k === 'Prize money' ? v : num(v))) + '</dd></div>').join('') + '</dl>'
    + '<h2>Solutions</h2>'
    + (sols ? '<ul class="sols">' + sols + '</ul>' : '<p class="empty">No solutions listed yet.</p>')
    + (p.payouts && p.payouts.length ? '<h2>Payouts</h2><ul class="sols">' + p.payouts.map((x) => '<li>' + esc(x.competition || '') + ' — ' + money(x.amount_usd ?? x.amount) + '</li>').join('') + '</ul>' : '')
    + '</article>';
}

export function loadingView(what) {
  return '<p class="loading">Loading ' + esc(what) + '…</p>';
}

export function errorView(msg) {
  return '<p class="error">Couldn’t load this view: ' + esc(msg) + '. <a href="#/">Back to the board</a> — or try Refresh below.</p>';
}
