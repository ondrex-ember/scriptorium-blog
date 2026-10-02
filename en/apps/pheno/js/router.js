// Hash router: #/, #/plant/:id, #/plant/:id/edit, #/new?clone=id, #/varieties, #/walk, #/settings.
import { clear, h, put } from './dom.js';
import { closeSheet } from './sheet.js';
import { S } from './strings.cs.js';

const routes = [];
let root = null;
let seq = 0;
let gate = null;
/** gate(path) may return another path to redirect to (used for the onboarding gate). */
export const setGate = (fn) => { gate = fn; };

export function route(pattern, handler, nav = null) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, handler, nav });
}

/** Token for async views: false once another navigation has started (stale renders must not overwrite). */
export function guard() { const mine = seq; return () => mine === seq; }

export function navigate(path) {
  if (location.hash === '#' + path) return render();
  location.hash = '#' + path;
  return undefined;
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(query)) };
}

export const stub = (title) => (r) => {
  clear(r).append(h('div', { class: 'top-bar' }, h('h1', {}, title)), h('div', { class: 'empty-state' }, S.ui.soon));
};

export async function render() {
  if (!root) return;
  const mine = ++seq;
  const { path, query } = parseHash();
  closeSheet();
  const redirect = gate ? await gate(path) : null;
  if (mine !== seq) return;
  if (redirect && redirect !== path) { navigate(redirect); return; }
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    document.querySelectorAll('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === r.nav));
    try { await r.handler(root, params, query); } catch (err) {
      console.error(err);
      put(clear(root), h('div', { class: 'empty-state' }, `Chyba: ${err.message}`));
    }
    if (mine === seq) window.scrollTo(0, 0);
    return;
  }
  navigate('/');
}

export function startRouter(el) {
  root = el;
  window.addEventListener('hashchange', render);
  return render();
}
