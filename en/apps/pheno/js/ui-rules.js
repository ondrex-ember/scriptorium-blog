// Nastavení → Pravidla a intervaly: every number the engine uses, with its default, limits and a reset.
import { DEFAULT_RULES, RULE_DEFS, RULE_GROUPS, cleanRules, resolveRules, validRule } from './config-rules.js';
import { ctx } from './ctx.js';
import { chipGroup, clear, h, icon, put } from './dom.js';
import { rebuildAll } from './events.js';
import { num } from './format.js';
import { guard, navigate } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { metaSet } from './storage.js';
import { S } from './strings.cs.js';

/** Groups of rules that must not decrease from one to the next (a minimum may not exceed its maximum, reminders stay in order). */
const ORDERED = [
  ['eval.remind1Days', 'eval.remind2Days', 'eval.remind3Days'],
  ['eval.freshRemind1Days', 'eval.freshRemind2Days'],
  ['batch.drying.minDays', 'batch.drying.maxDays'],
  ['drying.minFactor', 'drying.maxFactor'],
  ['pot.minFactor', 'pot.maxFactor']
];

/** True when setting `key` to `value` would break the order of its group. */
export function orderViolation(rules, key, value) {
  const next = { ...rules, [key]: value };
  return ORDERED.some((grp) => grp.includes(key) && grp.some((k, i) => i > 0 && next[k] < next[grp[i - 1]]));
}

/** Store overrides (valid, non-default only), refresh the live rules and rebuild every plant's cache. */
export async function saveRules(overrides) {
  const clean = cleanRules(overrides);
  await metaSet(ctx.db, 'rules', clean);
  ctx.overrides = clean;
  ctx.rules = resolveRules(clean);
  await rebuildAll(ctx.db);
  return clean;
}

export function ruleLabel(def) {
  const L = S.rules.label[def.key];
  if (L) return L;
  const parts = def.key.split('.');
  if (parts[0] === 'cat') return `${S.category[parts[1]]}: ${S.rules.cat[parts[2]]}`;
  if (def.key.startsWith('drying.env.')) return `${S.rules.dryEnv}: ${S.environment[parts[2]]}`;
  if (def.key.startsWith('pot.substrate.')) return `${S.rules.potSub}: ${S.substrate[parts[2]]}`;
  if (def.key.startsWith('season.on.')) return `${S.rules.seasonOn}: ${S.environment[parts[2]]}`;
  if (def.key.startsWith('season.')) return `${S.rules.seasonOf}: ${S.profile[parts[1]]}`;
  return def.key;
}

const defText = (def) => {
  if (def.kind === 'bool') return def.def ? S.rules.yes : S.rules.no;
  if (def.kind === 'choice') return S.rules.afterChoice[def.def];
  return `${num(def.def, 2)}${def.unit ? ` ${def.unit}` : ''}`;
};

function ruleRow(def, refresh) {
  const cur = ctx.rules[def.key];
  const changed = cur !== DEFAULT_RULES[def.key];
  const err = h('div', { class: 'form-error rule-error' });
  const apply = async (value) => {
    err.textContent = '';
    if (!validRule(def.key, value)) { err.textContent = def.kind === 'num' ? S.rules.invalid(def.min, def.max) : S.err.invalid; return false; }
    if (def.kind === 'num' && orderViolation(ctx.rules, def.key, value)) { err.textContent = S.rules.order; return false; }
    const next = { ...ctx.overrides };
    if (value === DEFAULT_RULES[def.key]) delete next[def.key]; else next[def.key] = value;
    try { await saveRules(next); toast(S.rules.saved); } catch (e) { err.textContent = e.message || S.err.invalid; return false; }
    refresh();
    return true;
  };
  let control;
  if (def.kind === 'num') {
    control = h('input', { type: 'number', class: 'rule-input', id: `rule-${def.key}`, step: String(def.step), min: String(def.min), max: String(def.max),
      inputmode: 'decimal', value: cur, dataset: { rule: def.key },
      onchange: async (e) => {
        if (e.target.value === '') return apply(DEFAULT_RULES[def.key]);
        const ok = await apply(Number(e.target.value));
        if (!ok) e.target.value = cur;
        return ok;
      } });
  } else if (def.kind === 'bool') {
    const g = chipGroup([[true, S.rules.yes], [false, S.rules.no]], cur, (v) => apply(v));
    g.el.id = `rule-${def.key}`;
    control = g.el;
  } else {
    const g = chipGroup(def.options.map((o) => [o, S.rules.afterChoice[o]]), cur, (v) => apply(v));
    g.el.id = `rule-${def.key}`;
    control = g.el;
  }
  return h('div', { class: `rule-row${changed ? ' changed' : ''}`, dataset: { rule: def.key } },
    h('div', { class: 'rule-main' },
      h('div', { class: 'rule-label' }, ruleLabel(def)),
      h('div', { class: 'rule-meta' }, `${S.rules.def}: ${defText(def)}${changed ? ` · ${S.rules.changed}` : ''}`)),
    h('div', { class: 'rule-control' }, control, def.kind === 'num' && def.unit ? h('span', { class: 'rule-unit' }, def.unit) : null,
      changed ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', dataset: { reset: def.key }, 'aria-label': S.rules.reset, title: S.rules.reset,
        onclick: () => apply(DEFAULT_RULES[def.key]) }, icon('swap')) : null),
    err);
}

export async function renderRules(root) {
  const alive = guard();
  const refresh = () => renderRules(root);
  const changedCount = RULE_DEFS.filter((d) => ctx.rules[d.key] !== d.def).length;
  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-back', 'aria-label': S.ui.back, onclick: () => navigate('/settings') }, icon('back')),
      h('h1', {}, S.rules.title), h('span')),
    h('p', { class: 'muted rules-intro' }, S.rules.intro),
    h('div', { class: 'rules-summary' }, h('strong', { id: 'rules-changed' }, S.rules.changedCount(changedCount)),
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'btn-rules-reset', disabled: !changedCount, onclick: () => resetAll(refresh) }, S.rules.resetAll)),
    RULE_GROUPS.map((g) => h('section', { class: 'card pad rules-group', dataset: { group: g } },
      h('h3', {}, S.rules.group[g]),
      h('p', { class: 'muted' }, S.rules.groupHint[g]),
      g === 'afterHarvest' ? h('p', { class: 'muted' }, S.rules.afterHint) : null,
      RULE_DEFS.filter((d) => d.group === g).map((d) => ruleRow(d, refresh)))));
  return undefined;
}

function resetAll(refresh) {
  openSheet(S.rules.resetAll, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, S.rules.resetAllAsk),
    h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-rules-reset-go', onclick: async () => {
      try { await saveRules({}); closeSheet(); toast(S.rules.resetDone); refresh(); } catch (e) { toast(e.message); }
    } }, S.rules.resetAll),
    h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel)));
}
