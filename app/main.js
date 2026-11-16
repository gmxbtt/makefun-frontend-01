// Router + shell wiring. Hash routes:
//   #/                              board
//   #/bounty/<slug>                 bounty page
//   #/bounty/<slug>/leaderboard     leaderboard (?view=overall|performance)
//   #/u/<handle>                    profile
// Screenshot protocol: window.__shotReady is false while a route loads, true once rendered.
import * as api from './api.js';
import { timeLeft, relTime } from './format.js';

// Views are code-split: the router loads views.js on demand (one literal
// dynamic import, cached by the browser after the first route), so the
// first load is only the shell + API client + router.
let views = null;
async function loadViews() {
  if (!views) views = await import('./views.js');
  return views;
}

const app = document.getElementById('app');
const reqinfo = document.getElementById('reqinfo');
const searchInput = document.getElementById('q');
window.__shotReady = false;

const ui = { q: '', sort: 'deadline', status: 'open', limit: 24 };
let boardCache = null; // last board payload, so search/sort re-render without a request
let tickTimer = null;

function setReady() {
  window.__shotReady = true;
  updateFooter();
}

function updateFooter() {
  const s = api.stats();
  const ago = s.lastOk ? relTime(new Date(s.lastOk).toISOString()) : 'never';
  reqinfo.textContent = s.requests + (s.requests === 1 ? ' request' : ' requests') + ' · updated ' + ago;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  if (parts.length === 0) return { view: 'board' };
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard')
    return { view: 'leaderboard', slug: decodeURIComponent(parts[1]), lbView: params.get('view') || 'performance' };
  if (parts[0] === 'bounty' && parts[1]) return { view: 'bounty', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'u' && parts[1]) return { view: 'profile', handle: decodeURIComponent(parts[1]) };
  return { view: 'board' };
}

// Live countdowns: update only the text of [data-deadline] nodes, never rebuild the view.
function startTicker() {
  stopTicker();
  const tick = () => {
    const now = Date.now();
    for (const el of app.querySelectorAll('[data-deadline]')) {
      const t = el.getAttribute('data-deadline');
      if (t) el.textContent = timeLeft(t, now);
    }
  };
  tick();
  tickTimer = setInterval(tick, 30000);
}
function stopTicker() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

function markNav(route) {
  for (const a of document.querySelectorAll('[data-nav]')) {
    a.classList.toggle('on', (route.view === 'board' && a.dataset.nav === 'board') || (route.view === 'bounty' && a.dataset.nav === 'bounty'));
  }
}

async function route() {
  const r = parseHash();
  markNav(r);
  window.__shotReady = false;
  stopTicker();
  let v;
  try {
    v = await loadViews();
  } catch (e) {
    app.innerHTML = '<p class="error">Couldn’t load this view: ' + (e.message || String(e)) + '.</p>';
    setReady();
    return;
  }
  const { boardView, bountyView, leaderboardView, profileView, loadingView, errorView } = v;
  try {
    if (r.view === 'board') {
      app.innerHTML = boardCache ? boardView(boardCache.items || [], ui) : loadingView('live bounties');
      if (!boardCache || ui._refetch) {
        const data = await api.board(ui.status);
        boardCache = data;
        ui._refetch = false;
        app.innerHTML = boardView(data.items || [], ui);
      }
      wireBoard();
    } else if (r.view === 'bounty') {
      app.innerHTML = loadingView('bounty');
      const b = await api.bounty(r.slug);
      app.innerHTML = bountyView(b);
    } else if (r.view === 'leaderboard') {
      app.innerHTML = loadingView('leaderboard');
      const data = await api.leaderboard(r.slug, r.lbView);
      app.innerHTML = leaderboardView(data, r.slug, r.lbView);
    } else if (r.view === 'profile') {
      app.innerHTML = loadingView('profile');
      const p = await api.profile(r.handle);
      app.innerHTML = profileView(p);
    }
  } catch (e) {
    app.innerHTML = errorView(e.message || String(e));
  }
  startTicker();
  setReady();
}

function wireBoard() {
  const sort = document.getElementById('sort');
  if (sort) sort.addEventListener('change', () => { ui.sort = sort.value; app.innerHTML = views.boardView(boardCache.items || [], ui); wireBoard(); });
  const tog = document.getElementById('togOpen');
  if (tog) tog.addEventListener('click', async () => {
    ui.status = ui.status === 'open' ? 'closed' : 'open';
    ui._refetch = true;
    await route();
  });
  const more = document.getElementById('more');
  if (more) more.addEventListener('click', () => { ui.limit += 24; app.innerHTML = views.boardView(boardCache.items || [], ui); wireBoard(); });
}

// Header search filters the board in place (no request); Enter goes to the board.
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    ui.q = searchInput.value.trim();
    if (parseHash().view !== 'board') { location.hash = '#/'; return; }
    if (boardCache && views) { app.innerHTML = views.boardView(boardCache.items || [], ui); wireBoard(); }
  }, 150);
});

document.getElementById('refresh').addEventListener('click', async () => {
  const r = parseHash();
  if (r.view === 'board') { api.bust('/competitions?status=' + ui.status + '&activity=times'); boardCache = null; }
  if (r.view === 'bounty') api.bust('/competitions/' + encodeURIComponent(r.slug));
  if (r.view === 'leaderboard') api.bust('/competitions/' + encodeURIComponent(r.slug) + '/leaderboard?view=' + r.lbView);
  if (r.view === 'profile') api.bust('/profiles/' + encodeURIComponent(r.handle));
  await route();
});

window.addEventListener('hashchange', route);
route();
setInterval(updateFooter, 15000);
