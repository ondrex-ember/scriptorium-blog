// Custom categories UI (R17): list, "create from…" picker, editor sheet. Everything validated again by cleanCategories().
import { CATEGORY_LIMITS, HARVEST_FIELD_VOCAB, MAX_CUSTOM_CATEGORIES, STAGE_VOCAB, baseLabel, newCategoryId } from './categories.js';
import { CATEGORIES, CATEGORY_ICON, CATEGORY_ICON_CHOICES, CYCLE_STAGES } from './config-categories.js';
import { ctx, refreshCategories, refreshTemplates } from './ctx.js';
import { chipGroup, clear, field, h, icon, put } from './dom.js';
import { saveCategories } from './events.js';
import { guard, navigate } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { listPlants } from './storage.js';
import { S } from './strings.cs.js';
import { buttons } from './ui-forms.js';
import { multiChips } from './ui-tasks.js';

const C = S.categories;

/** Choose the starting category (any live category, built-in or custom), then open the editor. */
export function pickBaseSheet(done) {
  if (Object.keys(ctx.categories).length >= MAX_CUSTOM_CATEGORIES) return toast(C.limit);
  const keys = Object.keys(CATEGORIES).filter((k) => !CATEGORIES[k].deleted);
  const base = chipGroup(keys.map((k) => [k, S.category[k]]), 'herb');
  base.el.id = 'c-base';
  openSheet(C.add, h('div', { class: 'stack' }, h('p', { class: 'muted' }, C.pickBaseHint), field(C.pickBase, base.el),
    buttons(() => { closeSheet(); categorySheet(null, base.get(), done); }, C.next)));
  return undefined;
}

/** Editor. New: `startKey` is the category to clone (a custom one is flattened to its built-in base with its overrides). */
export function categorySheet(id, startKey, done) {
  const existing = id ? ctx.categories[id] : null;
  const cfg = CATEGORIES[id ?? startKey];
  const baseKey = existing?.base ?? (ctx.categories[startKey]?.base ?? startKey);
  const label = h('input', { type: 'text', id: 'c-label', maxlength: 40, value: existing?.label ?? '', placeholder: 'např. Chilli' });
  const ic = chipGroup(CATEGORY_ICON_CHOICES.map((k) => [k, icon(k)]), existing?.icon ?? CATEGORY_ICON[startKey] ?? 'leaf');
  ic.el.id = 'c-icon';
  const life = chipGroup(Object.entries(S.lifecycle), cfg.lifecycle);
  life.el.id = 'c-lifecycle';
  const harvestable = chipGroup([[true, C.yes], [false, C.no]], cfg.harvestable);
  harvestable.el.id = 'c-harvestable';
  const stages = multiChips(STAGE_VOCAB.filter((k) => k !== 'done').map((k) => [k, S.stage[k]]), (CYCLE_STAGES[id ?? startKey] ?? []).filter((k) => k !== 'done'));
  stages.el.id = 'c-stages';
  const fields = multiChips(HARVEST_FIELD_VOCAB.map((k) => [k, S.harvestField[k]]), cfg.harvestFields.map((f) => f.key));
  fields.el.id = 'c-fields';
  const num = (key, idAttr) => h('input', { type: 'number', id: idAttr, step: key === 'baseDryingDays' ? 0.5 : 1, inputmode: 'decimal', min: CATEGORY_LIMITS[key][0], max: CATEGORY_LIMITS[key][1], value: cfg[key] });
  const fert = num('fertilizingDays', 'c-fert'), pest = num('pestCheckDays', 'c-pest'), dry = num('baseDryingDays', 'c-dry');
  openSheet(existing ? C.edit : C.add, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, C.basedOn(S.category[baseKey])),
    field(C.label, label), field(C.icon, ic.el), field(C.lifecycle, life.el), field(C.harvestable, harvestable.el),
    field(C.stages, stages.el), field(C.harvestFields, fields.el),
    field(C.fertilizingDays, fert), field(C.pestCheckDays, pest), field(C.baseDryingDays, dry),
    buttons(async () => {
      if (!label.value.trim()) return toast(S.err.name);
      const nums = { fertilizingDays: Number(fert.value), pestCheckDays: Number(pest.value), baseDryingDays: Number(dry.value) };
      for (const [k, v] of Object.entries(nums)) if (!Number.isFinite(v) || v < CATEGORY_LIMITS[k][0] || v > CATEGORY_LIMITS[k][1]) return toast(S.err.invalid);
      const lifecycle = life.get();
      if (lifecycle === 'cycle' && !stages.get().length) return toast(C.needStage);
      if (!fields.get().length) return toast(C.needField);
      const entry = { label: label.value.trim(), icon: ic.get(), base: baseKey,
        overrides: { lifecycle, harvestable: harvestable.get(), stages: stages.get(), harvestFields: fields.get(), ...nums } };
      if (existing?.deleted) entry.deleted = true;
      await saveCategories(ctx.db, { ...ctx.categories, [id ?? newCategoryId()]: entry });
      await refreshCategories();
      closeSheet(); toast(C.saved); done?.();
      return undefined;
    })));
}

async function deleteSheet(id, done) {
  const used = (await listPlants(ctx.db)).filter((p) => p.category === id).length;
  openSheet(C.delete, h('div', { class: 'stack' }, h('p', { class: 'muted' }, used ? C.deleteUsed(used) : C.deleteFree),
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
      h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-confirm-delete-category', onclick: async () => {
        const next = { ...ctx.categories };
        if (used) next[id] = { ...next[id], deleted: true }; else delete next[id];
        await saveCategories(ctx.db, next); await refreshCategories(); await refreshTemplates();
        closeSheet(); toast(C.saved); done();
      } }, C.delete))));
}

export async function renderCategories(root) {
  const alive = guard();
  await refreshCategories();
  const rerender = () => renderCategories(root);
  if (!alive()) return undefined;
  const live = Object.entries(ctx.categories).filter(([, c]) => !c.deleted);
  const hidden = Object.entries(ctx.categories).filter(([, c]) => c.deleted);
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.back, onclick: () => navigate('/settings') }, icon('back')),
      h('h1', {}, C.title),
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-new-category', 'aria-label': C.add, onclick: () => pickBaseSheet(rerender) }, icon('plus'))),
    h('p', { class: 'muted pad-x' }, C.intro),
    live.length
      ? h('div', { class: 'variety-list', id: 'category-list' }, live.map(([id, c]) => h('div', { class: 'card pad', dataset: { category: id } },
        h('div', { class: 'variety-head' }, h('strong', {}, c.label),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', dataset: { act: 'edit' }, 'aria-label': C.edit, onclick: () => categorySheet(id, null, rerender) }, icon('edit'))),
        h('div', { class: 'muted' }, C.basedOn(baseLabel(id))),
        h('div', { class: 'form-actions' },
          h('button', { type: 'button', class: 'btn btn-danger btn-sm', dataset: { act: 'delete' }, onclick: () => deleteSheet(id, rerender) }, icon('trash'), C.delete)))))
      : h('div', { class: 'empty-state', id: 'no-categories' }, C.none),
    hidden.length ? h('div', { id: 'hidden-categories' }, h('div', { class: 'section-title' }, C.hidden),
      hidden.map(([id, c]) => h('div', { class: 'card pad', dataset: { category: id } }, h('div', { class: 'variety-head' }, h('strong', {}, c.label),
        h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: 'restore' }, onclick: async () => {
          const revived = { label: c.label, icon: c.icon, base: c.base, overrides: c.overrides };
          await saveCategories(ctx.db, { ...ctx.categories, [id]: revived }); await refreshCategories(); rerender();
        } }, C.restore))))) : null);
  return undefined;
}
