// Evaluation criteria per category (RCv0.191, R17). Defaults come from CATEGORIES; the user may rename, add and remove
// criteria. "overall" is always present and cannot be touched. Overrides live in meta.criteria as
// { [category]: [{ key, label, removed? }] }; a removed criterion keeps its entry so old evaluations stay readable.
import { CATEGORIES } from './config-categories.js';
import { S } from './strings.cs.js';

export const CRITERIA_MAX = 12;
export const LABEL_MAX = 40;
const KEY = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, LABEL_MAX);

const defaults = (category) => (CATEGORIES[category]?.criteria || []).map((key) => ({ key, label: S.criterion[key] || key }));
const same = (a, b) => a.length === b.length && a.every((x, i) => x.key === b[i].key && x.label === b[i].label && !x.removed);

/** Validate stored overrides; invalid entries are dropped, overrides equal to the defaults vanish. */
export function cleanCriteria(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [cat, list] of Object.entries(raw)) {
    if (!CATEGORIES[cat] || !Array.isArray(list)) continue;
    const seen = new Set(['overall']);
    const items = [];
    for (const it of list.slice(0, CRITERIA_MAX)) {
      if (!it || typeof it !== 'object' || typeof it.key !== 'string' || !KEY.test(it.key) || seen.has(it.key)) continue;
      const label = clean(it.label);
      if (!label) continue;
      seen.add(it.key);
      items.push(it.removed ? { key: it.key, label, removed: true } : { key: it.key, label });
    }
    if (!same(items, defaults(cat))) out[cat] = items;
  }
  return out;
}

/** All entries of a category, removed ones included (settings screen). */
export const criteriaEntries = (category, custom) => custom?.[category] ?? defaults(category);

/** Criteria offered for new evaluations: [{ key, label }] without "overall". */
export const activeCriteria = (category, custom) => criteriaEntries(category, custom).filter((c) => !c.removed);

/** Label of any criterion key, also for removed or foreign ones; null when nothing is known. */
export function criterionLabel(key, custom, category) {
  if (key === 'overall') return S.criterion.overall;
  const pools = category && custom?.[category] ? [custom[category]] : [];
  for (const list of [...pools, ...Object.values(custom || {})]) {
    const hit = list.find((c) => c.key === key);
    if (hit) return hit.label;
  }
  return S.criterion[key] ?? null;
}

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  .split(' ').filter(Boolean).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');

/** Fresh unique key for a new criterion. */
export function newCriterionKey(label, taken) {
  const base = `c${slug(label) ? slug(label)[0].toUpperCase() + slug(label).slice(1) : 'X'}`.slice(0, 28);
  let key = base, i = 2;
  while (taken.includes(key) || key === 'overall') key = `${base}${i++}`;
  return key;
}
