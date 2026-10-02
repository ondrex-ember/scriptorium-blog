// Bottom-sheet modals and toasts.
import { h, icon, put } from './dom.js';

let overlay = null;
let onCloseCb = null;

function ensure() {
  if (overlay) return overlay;
  overlay = h('div', { class: 'modal-overlay', id: 'sheet-overlay', onclick: (e) => { if (e.target === overlay) closeSheet(); } });
  document.body.append(overlay);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  return overlay;
}

export function openSheet(title, body, { onClose } = {}) {
  const ov = ensure();
  onCloseCb = onClose || null;
  ov.replaceChildren(h('div', { class: 'modal-sheet', role: 'dialog', 'aria-label': title },
    h('div', { class: 'modal-title' }, h('h2', {}, title),
      h('button', { type: 'button', 'aria-label': 'Zavřít', onclick: () => closeSheet() }, icon('close'))),
    body));
  ov.classList.add('active');
  ov.querySelector('input:not([type=file]):not([type=hidden]), textarea')?.focus?.();
}

export function closeSheet() {
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.replaceChildren();
  const cb = onCloseCb; onCloseCb = null;
  cb?.();
}

export const isSheetOpen = () => !!overlay?.classList.contains('active');

let toastTimer = null;
export function toast(text, { action, onAction } = {}) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
  put(t.replaceChildren() ?? t, h('span', {}, text), action ? h('button', { type: 'button', onclick: () => { t.classList.remove('show'); onAction?.(); } }, action) : null);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
}
