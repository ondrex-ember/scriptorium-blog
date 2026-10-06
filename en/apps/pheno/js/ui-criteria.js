// Nastavení → Kritéria hodnocení: add, rename, remove and restore evaluation criteria per category (R17).
import { CATEGORIES } from './config-categories.js';
import { ctx } from './ctx.js';
import { CRITERIA_MAX, LABEL_MAX, cleanCriteria, criteriaEntries, newCriterionKey } from './criteria.js';
import { clear, h, icon, put } from './dom.js';
import { guard, navigate } from './router.js';
import { toast } from './sheet.js';
import { metaSet } from './storage.js';
import { S } from './strings.cs.js';

/** Store overrides (cleaned) and refresh the live copy. */
export async function saveCriteria(next) {
  const clean = cleanCriteria(next);
  await metaSet(ctx.db, 'criteria', clean);
  ctx.criteria = clean;
  return clean;
}

/** New override map with `list` as the entries of `category` (cleaning drops it again when it equals the defaults). */
export const withEntries = (category, list) => ({ ...ctx.criteria, [category]: list });

function categoryCard(category, refresh) {
  const entries = criteriaEntries(category, ctx.criteria);
  const active = entries.filter((e) => !e.removed);
  const removed = entries.filter((e) => e.removed);
  const commit = async (list) => {
    await saveCriteria(withEntries(category, list));
    toast(S.crit.saved);
    refresh();
  };
  const err = h('div', { class: 'form-error' });

  const rowFor = (e) => {
    const input = h('input', { type: 'text', class: 'crit-input', maxlength: String(LABEL_MAX), value: e.label, 'aria-label': S.crit.renameHint,
      dataset: { crit: e.key },
      onchange: async (ev) => {
        const label = ev.target.value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
        if (!label) { ev.target.value = e.label; return; }
        await commit(entries.map((x) => (x.key === e.key ? { ...x, label } : x)));
      } });
    return h('div', { class: 'crit-row', dataset: { key: e.key } }, input,
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: S.crit.remove, 'aria-label': S.crit.remove, dataset: { remove: e.key },
        onclick: () => commit(entries.map((x) => (x.key === e.key ? { ...x, removed: true } : x))) }, icon('trash')));
  };

  const addInput = h('input', { type: 'text', class: 'crit-input', maxlength: String(LABEL_MAX), placeholder: S.crit.addHint, id: `crit-new-${category}` });
  const add = async () => {
    err.textContent = '';
    const label = addInput.value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
    if (!label) return;
    if (entries.length >= CRITERIA_MAX) { err.textContent = S.crit.limit; return; }
    await commit([...entries, { key: newCriterionKey(label, entries.map((x) => x.key)), label }]);
  };
  addInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } });

  return h('section', { class: 'card pad crit-group', dataset: { category } },
    h('h3', {}, S.category[category]),
    h('div', { class: 'crit-row crit-fixed' }, h('span', { class: 'crit-label' }, S.crit.overall)),
    active.length ? active.map(rowFor) : h('p', { class: 'muted' }, S.crit.empty),
    h('div', { class: 'crit-row crit-add' }, addInput,
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: `crit-add-${category}`, onclick: add }, icon('plus'), S.crit.add)),
    err,
    removed.length ? h('div', { class: 'crit-removed' }, h('div', { class: 'muted' }, S.crit.removed),
      removed.map((e) => h('div', { class: 'crit-row', dataset: { removed: e.key } }, h('span', { class: 'crit-label muted' }, e.label),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', dataset: { restore: e.key },
          onclick: () => commit(entries.map((x) => (x.key === e.key ? { key: x.key, label: x.label } : x))) }, S.crit.restore)))) : null,
    ctx.criteria[category] ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', dataset: { reset: category },
      onclick: async () => { const next = { ...ctx.criteria }; delete next[category]; await saveCriteria(next); toast(S.crit.saved); refresh(); } }, icon('swap'), S.crit.reset) : null);
}

export async function renderCriteria(root) {
  const alive = guard();
  const refresh = () => renderCriteria(root);
  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-back', 'aria-label': S.ui.back, onclick: () => navigate('/settings') }, icon('back')),
      h('h1', {}, S.crit.title), h('span')),
    h('p', { class: 'muted rules-intro' }, S.crit.intro),
    Object.keys(CATEGORIES).map((c) => categoryCard(c, refresh)));
  return undefined;
}

