// Display of derived metrics (RCv0.193): plant tab, variety detail, statistics overview, group view.
import { ctx } from './ctx.js';
import { h } from './dom.js';
import { num } from './format.js';
import { METRICS, fmtMetric, metricDef, metricLabel, stageStats } from './metrics.js';
import { resolveMethods } from './stockcfg.js';
import { S } from './strings.cs.js';

const T = S.metrics;
const note = (a) => (a.n < 3 ? T.provisional : a.mixedEnv ? `${T.provisional}, ${T.mixedEnv}` : null);
const tags = (a) => [h('span', { class: 'tag' }, T.n(a.n)), note(a) ? h('span', { class: 'tag tag-warn' }, note(a)) : null];

/** Rows for the aggregates of a variety or group: one per metric with n and the honesty flags. */
export const metricRows = (aggregates) => aggregates.filter((a) => a.n > 0).map((a) => h('div', { class: 'kv metric-row', dataset: { metric: a.key } },
  h('span', {}, metricLabel(a.key)), h('span', { class: 'metric-val' }, h('strong', {}, fmtMetric(metricDef(a.key), a.mean)), ...tags(a))));

export function metricsCard(aggregates, id = 'metrics-card') {
  const rows = metricRows(aggregates);
  return rows.length ? h('div', { class: 'card pad', id }, rows) : h('div', { class: 'empty-state', id }, T.none);
}

/** One plant: its own value next to the variety average (only when the variety has other plants with a value). */
export function plantMetricsCard(values, aggregates) {
  const rows = METRICS.filter((m) => values[m.key] != null);
  if (!rows.length) return h('div', { class: 'empty-state', id: 'metrics-card' }, T.none);
  const agg = Object.fromEntries(aggregates.map((a) => [a.key, a]));
  return h('div', { class: 'card pad', id: 'metrics-card' }, rows.map((m) => {
    const a = agg[m.key];
    return h('div', { class: 'kv metric-row', dataset: { metric: m.key } }, h('span', {}, metricLabel(m.key)),
      h('span', { class: 'metric-val' }, h('strong', {}, fmtMetric(m, values[m.key])),
        a && a.n >= 2 ? h('span', { class: 'muted' }, ` · Ø ${fmtMetric(m, a.mean)}`) : null, ...(a && a.n >= 2 ? tags(a) : [])));
  }));
}

/** Stage durations of a variety (and of one plant when `ownId` is given). */
export function stagesCard(items, byPlant, ownId) {
  const st = stageStats(items, byPlant);
  if (!st.length) return null;
  return h('div', {},
    h('div', { class: 'section-title flush' }, T.stages), h('p', { class: 'muted pad-x' }, T.stagesHint),
    h('div', { class: 'card pad', id: 'stages-card' }, st.map((s) => {
      const own = ownId ? s.byPlant[ownId] : null;
      return h('div', { class: 'kv', dataset: { stage: s.stage } }, h('span', {}, S.stage[s.stage] || s.stage),
        h('span', { class: 'metric-val' },
          own != null ? h('strong', {}, `${num(own, 1)} ${S.ui.days}`) : null,
          h('span', own != null ? { class: 'muted' } : {}, own != null ? ` · Ø ${num(s.mean, 1)}` : `Ø ${num(s.mean, 1)} ${S.ui.days}`),
          h('span', { class: 'tag' }, T.n(s.n)), s.provisional ? h('span', { class: 'tag tag-warn' }, T.provisional) : null));
    })));
}

/** Observed patterns (never a cause). */
export function patternsCard(list) {
  if (!list.length) return null;
  return h('div', {},
    h('div', { class: 'section-title' }, T.patterns), h('p', { class: 'muted pad-x' }, T.patternsHint),
    h('div', { class: 'card pad', id: 'patterns-card' }, list.map((p) => h('div', { class: 'kv pattern-row', dataset: { pattern: p.id, category: p.category } },
      h('span', {}, `${S.category[p.category]}: ${T.patternText[p.id][p.direction]}`),
      h('span', { class: 'metric-val' }, h('span', { class: 'tag' }, T.strength[p.strength]), h('span', { class: 'tag' }, T.n(p.n)))))));
}

/** Storage methods: how much was thrown away and the real shelf life. */
export function storageCard(list) {
  if (!list.length) return null;
  const label = (m) => resolveMethods(ctx.stockCfg)[m]?.label ?? S.stock.method.other;
  return h('div', {},
    h('div', { class: 'section-title' }, T.storage), h('p', { class: 'muted pad-x' }, T.storageHint),
    h('div', { class: 'card pad', id: 'storage-card' }, list.map((s) => h('div', { class: 'kv', dataset: { method: s.method } },
      h('span', {}, `${label(s.method)} · ${s.n} ${T.containers}`),
      h('span', { class: 'metric-val' }, `${T.loss} ${Math.round(s.lossShare * 100)} %`,
        s.shelfLifeDays != null ? ` · ${T.life} ${s.shelfLifeDays} ${S.ui.days} (n = ${s.spoiledN})` : '',
        s.provisional ? h('span', { class: 'tag tag-warn' }, T.provisional) : null)))));
}
