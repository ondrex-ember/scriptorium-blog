// Varieties, variety detail and archive (spec 5.4). Aggregation lives in stats.js.
import { CATEGORIES } from './config-categories.js';
import { loadAll } from './ctx.js';
import { clear, h, icon, put } from './dom.js';
import { fmtDate, num, plantsWord, starsText } from './format.js';
import { navigate, guard } from './router.js';
import { S } from './strings.cs.js';
import { aggregateVarieties, overviewNumbers, plantSummary } from './stats.js';
import { CAT_ICON } from './ui-dashboard.js';
import { photoUrl } from './photos.js';
import { ctx } from './ctx.js';
import { latestPhotoId } from './timeline.js';

const unitOf = (category) => {
  const key = CATEGORIES[category].harvestFields[0].key;
  return (S.harvestField[key].match(/\(([^)]+)\)/) || [])[1] || '';
};
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)} %`);
const rating = (v) => (v == null ? '—' : h('span', { class: 'stars' }, starsText(v), ` ${num(v)}`));
const kv = (label, value) => h('div', { class: 'kv' }, h('span', {}, label), h('strong', {}, value));

function varietyCard(g) {
  const unit = unitOf(g.category);
  return h('button', { type: 'button', class: 'card variety-card', dataset: { variety: g.key, category: g.category },
    onclick: () => navigate(`/variety/${g.category}/${encodeURIComponent(g.key)}`) },
    h('div', { class: 'variety-head' },
      h('div', {}, h('div', { class: 'plant-name' }, g.label),
        h('div', { class: 'plant-sub' }, `${S.category[g.category]}${g.unnamed ? ` · ${S.ui.unnamed}` : ''}`)),
      h('span', { class: 'tag' }, `${g.plantCount} ${plantsWord(g.plantCount)}`)),
    h('div', { class: 'variety-grid' },
      kv(S.ui.avgRating, rating(g.avgOverall)),
      kv(S.ui.growAgainShare, pct(g.wouldGrowAgainShare)),
      kv(S.ui.yieldTotal, g.totalYield ? `${num(g.totalYield, 2)} ${unit}` : '—'),
      kv(S.ui.avgCycle, g.avgCycleDays == null ? '—' : `${Math.round(g.avgCycleDays)} ${S.ui.days}`)));
}

async function plantCard(plant, byPlant, onclick) {
  const evs = byPlant.get(plant.id) || [];
  const url = await photoUrl(ctx.db, latestPhotoId(evs));
  const sum = plantSummary(plant, evs);
  return h('button', { type: 'button', class: 'plant-card', dataset: { plant: plant.id }, onclick },
    h('div', { class: 'plant-photo' }, url ? h('img', { src: url, alt: plant.name }) : icon(CAT_ICON[plant.category] || 'pot', 'plant-photo-icon')),
    h('div', { class: 'plant-card-body' },
      h('div', { class: 'plant-name' }, plant.name),
      h('div', { class: 'plant-sub' }, `${S.category[plant.category]} · ${fmtDate(plant.startDate)}`),
      sum.overall != null ? h('div', { class: 'stars' }, starsText(sum.overall)) : null));
}

export async function renderVarieties(root) {
  const alive = guard();
  const { plants, byPlant } = await loadAll();
  const groups = aggregateVarieties(plants, byPlant);
  const nums = overviewNumbers(plants, byPlant);
  const archived = plants.filter((p) => p.archivedAt);
  const cards = await Promise.all(archived.map((p) => plantCard(p, byPlant, () => navigate(`/plant/${p.id}`))));
  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' }, h('h1', {}, S.ui.varietiesTitle)),
    h('div', { class: 'summary-grid' },
      tile(nums.plants, 'Rostliny'), tile(nums.harvests, 'Sklizně'), tile(nums.evaluated, 'Hodnoceno'), tile(nums.archived, 'Archiv')),
    groups.length ? h('div', { class: 'variety-list' }, groups.map(varietyCard)) : h('div', { class: 'empty-state' }, S.ui.noVarieties),
    h('div', { class: 'section-title' }, `${S.ui.archiveTitle} (${archived.length})`),
    archived.length ? h('div', { class: 'plant-grid', id: 'archive-grid' }, cards) : h('div', { class: 'empty-state' }, S.ui.noPlants));
}

const tile = (n, label) => h('div', { class: 'summary-tile' }, h('div', { class: 'num' }, n), h('div', { class: 'lbl' }, label));

export async function renderVariety(root, category, key) {
  const alive = guard();
  const { plants, byPlant } = await loadAll();
  const g = aggregateVarieties(plants, byPlant).find((x) => x.category === category && x.key === key);
  if (!g) return navigate('/varieties');
  const unit = unitOf(category);
  const rows = g.items.map(({ plant, summary: s }) => h('button', { type: 'button', class: 'card variety-plant', dataset: { plant: plant.id },
    onclick: () => navigate(`/plant/${plant.id}`) },
    h('div', { class: 'variety-head' },
      h('div', {}, h('div', { class: 'plant-name' }, plant.name),
        h('div', { class: 'plant-sub' }, `${fmtDate(plant.startDate)}${plant.archivedAt ? ` · ${S.ui.archived}` : ''}`)),
      s.overall != null ? h('span', { class: 'stars' }, starsText(s.overall)) : h('span', { class: 'muted' }, '—')),
    h('div', { class: 'variety-grid' },
      kv(S.ui.harvests, s.harvestCount),
      kv(S.ui.yieldTotal, s.yield ? `${num(s.yield, 2)} ${unit}` : '—'),
      kv(S.ui.avgCycle, s.cycleDays == null ? '—' : `${s.cycleDays} ${S.ui.days}`),
      kv(S.ui.growAgainShare, s.wouldGrowAgain == null ? '—' : (s.wouldGrowAgain ? S.ui.yes : S.ui.no)))));
  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-back', 'aria-label': S.ui.back, onclick: () => navigate('/varieties') }, icon('back')),
      h('h1', {}, g.label), h('span')),
    h('div', { class: 'plant-tags pad-x' }, h('span', { class: 'tag' }, S.category[category]), g.unnamed ? h('span', { class: 'tag' }, S.ui.unnamed) : null),
    varietyCard(g),
    h('div', { class: 'section-title' }, S.ui.plantsOfVariety),
    h('div', { class: 'variety-list', id: 'variety-plants' }, rows),
    h('div', { class: 'card pad' }, kv(S.ui.cycles, g.cycles), kv(S.ui.problemsPer, num(g.problemsPerPlant))));
}
