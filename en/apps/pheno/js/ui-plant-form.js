// Plant form: create, clone (?clone=id), edit.
import { CATEGORIES, ENVIRONMENTS, SOURCES, getStages } from './config-categories.js';
import { SEASONAL_ENVIRONMENTS } from './config-engine.js';
import { ctx, hemisphereKnown, loadAll, now, setHemisphere } from './ctx.js';
import { chipGroup, clear, field, h, icon, put } from './dom.js';
import { appendEvents, createPlant, deletePlantPermanently, updatePlantMeta } from './events.js';
import { clonePlantInput } from './model.js';
import { savePhotoFile } from './photos.js';
import { example, PROFILES } from './profile.js';
import { requestPersistence } from './pwa.js';
import { navigate, guard } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { S } from './strings.cs.js';
import { toLocalInput } from './format.js';

/** Ask once which hemisphere the user gardens in (drives the season modifier). */
export function askHemisphere() {
  return hemisphereKnown().then((known) => {
    if (known) return null;
    return new Promise((resolve) => {
      const pick = async (v) => { await setHemisphere(v); closeSheet(); resolve(v); };
      openSheet(S.ui.hemisphere, h('div', { class: 'stack' },
        h('p', { class: 'muted' }, 'Roční období ovlivňuje zálivku venku. Kde pěstuješ?'),
        h('button', { type: 'button', class: 'btn btn-primary', dataset: { hemi: 'north' }, onclick: () => pick('north') }, S.ui.north),
        h('button', { type: 'button', class: 'btn btn-secondary', dataset: { hemi: 'south' }, onclick: () => pick('south') }, S.ui.south)),
      { onClose: () => resolve(null) });
    });
  });
}

const datalist = (id, values) => h('datalist', { id }, values.map((v) => h('option', { value: v })));
const dateOnly = (iso) => toLocalInput(iso).slice(0, 10);
const toIso = (d) => (!d || d === dateOnly(now()) ? now() : new Date(`${d}T12:00:00`).toISOString());

export async function renderPlantForm(root, id, query = {}) {
  const alive = guard();
  const { plants } = await loadAll();
  const editing = id ? plants.find((p) => p.id === id) : null;
  if (id && !editing) return navigate('/');
  const pre = editing ? {} : (PROFILES[ctx.profile]?.preselect || {});
  const source = editing || (query.clone ? plants.find((p) => p.id === query.clone) : null);
  const init = editing
    ? { name: editing.name, variety: editing.variety, category: editing.category, lifecycle: editing.lifecycle,
      environment: editing.cache.environment, harvestable: editing.harvestable, location: editing.location,
      source: editing.source, baseOverride: editing.baseOverride }
    : source ? clonePlantInput(source, plants.map((p) => p.name))
      : { category: null, environment: pre.environment ?? null, lifecycle: pre.lifecycle, harvestable: pre.harvestable, source: 'seed' };
  const [exName, exVariety] = example(ctx.profile, plants.length);

  const st = { category: init.category, lifecycle: init.lifecycle, environment: init.environment, source: init.source || 'seed' };
  const name = h('input', { type: 'text', id: 'f-name', value: init.name || '', placeholder: `např. ${exName}` });
  const variety = h('input', { type: 'text', id: 'f-variety', value: init.variety || '', list: 'dl-variety', placeholder: `např. ${exVariety}` });
  const location = h('input', { type: 'text', id: 'f-location', value: init.location || '', list: 'dl-location', placeholder: 'např. balkon' });
  const cat = chipGroup(Object.entries(S.category), st.category, (v) => { if (editing) return; setCategory(v); });
  cat.el.id = 'f-category';
  const life = chipGroup(Object.entries(S.lifecycle), st.lifecycle, (v) => { if (editing) return; st.lifecycle = v; fillStages(); });
  const env = chipGroup(Object.entries(S.environment), st.environment, (v) => { st.environment = v; });
  env.el.id = 'f-environment';
  const src = chipGroup(SOURCES.map((s) => [s, S.source[s]]), st.source, (v) => { st.source = v; });
  const harv = h('input', { type: 'checkbox', id: 'f-harvestable', checked: init.harvestable ?? true, disabled: !!editing });
  const stage = h('select', { id: 'f-stage', disabled: !!editing });
  const start = h('input', { type: 'date', id: 'f-start', value: dateOnly(now()) });
  const photo = h('input', { type: 'file', id: 'f-photo', accept: 'image/*', capture: 'environment' });
  const note = h('textarea', { id: 'f-note', rows: 2 });
  const base = h('input', { type: 'number', id: 'f-base', step: 'any', min: '0.5', inputmode: 'decimal',
    value: init.baseOverride ?? '', placeholder: 'ponech prázdné = automaticky' });

  function fillStages() {
    if (!st.category) { stage.replaceChildren(); return; }
    const list = getStages(st.category, st.lifecycle);
    stage.replaceChildren(...list.map((s) => h('option', { value: s }, S.stage[s])));
  }
  function setCategory(v) {
    st.category = v; cat.set(v);
    st.lifecycle = pre.lifecycle === 'perennial' ? 'perennial' : CATEGORIES[v].lifecycle; life.set(st.lifecycle);
    harv.checked = pre.harvestable ?? CATEGORIES[v].harvestable;
    fillStages();
  }
  if (st.category) { if (!st.lifecycle) st.lifecycle = CATEGORIES[st.category].lifecycle; life.set(st.lifecycle); }
  fillStages();

  const errBox = h('div', { class: 'form-error', id: 'form-error', role: 'alert' });
  const save = async () => {
    errBox.textContent = '';
    try {
      if (editing) {
        await updatePlantMeta(ctx.db, id, { name: name.value, variety: variety.value, location: location.value,
          source: st.source, baseOverride: base.value === '' ? null : Number(base.value) });
        if (st.environment && st.environment !== editing.cache.environment) {
          if (SEASONAL_ENVIRONMENTS.includes(st.environment)) await askHemisphere();
          await appendEvents(ctx.db, id, [{ type: 'environment_change', payload: { environment: st.environment } }]);
        }
        toast('Uloženo');
        return navigate(`/plant/${id}`);
      }
      if (!name.value.trim()) throw new Error(S.err.name);
      if (!st.category) throw new Error(S.err.category);
      if (!st.environment) throw new Error(S.err.environment);
      if (SEASONAL_ENVIRONMENTS.includes(st.environment)) await askHemisphere();
      const plant = await createPlant(ctx.db, {
        name: name.value, variety: variety.value, category: st.category, lifecycle: st.lifecycle,
        environment: st.environment, harvestable: harv.checked, stage: stage.value, location: location.value,
        source: st.source, startDate: toIso(start.value),
        baseOverride: base.value === '' ? null : Number(base.value),
        learnedBase: init.learnedBase || null
      });
      const extra = [];
      if (photo.files[0]) {
        const photoId = await savePhotoFile(ctx.db, plant.id, photo.files[0]);
        extra.push({ type: 'photo', payload: { photoId } });
      }
      if (note.value.trim()) extra.push({ type: 'note', payload: { text: note.value } });
      if (extra.length) await appendEvents(ctx.db, plant.id, extra);
      requestPersistence(ctx.db);
      return navigate(`/plant/${plant.id}`);
    } catch (e) {
      errBox.textContent = e.message || S.err.invalid;
      return undefined;
    }
  };

  const remove = () => {
    const typed = h('input', { type: 'text', id: 'f-confirm', placeholder: editing.name });
    openSheet(S.ui.delete, h('div', {},
      h('p', { class: 'muted' }, `${S.err.confirmName} Smaže se rostlina, její záznamy i fotky.`),
      field(S.ui.name, typed),
      h('div', { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
        h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-confirm-delete', onclick: async () => {
          try { await deletePlantPermanently(ctx.db, id, typed.value); closeSheet(); toast('Smazáno'); navigate('/'); } catch (e) { toast(e.message); }
        } }, S.ui.delete))));
  };

  if (!alive()) return undefined;
  put(clear(root), 
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.back, onclick: () => navigate(editing ? `/plant/${id}` : '/') }, icon('back')),
      h('h1', {}, editing ? S.ui.edit : (query.clone ? S.ui.clone : S.ui.newPlant)), h('span')),
    h('form', { class: 'plant-form', onsubmit: (e) => { e.preventDefault(); save(); } },
      field(`${S.ui.name} *`, name),
      field(S.ui.variety, variety),
      field(`${S.ui.category} *`, cat.el, editing ? 'Kategorii nelze měnit.' : null),
      field(S.ui.lifecycle, life.el),
      field(`${S.ui.environment} *`, env.el),
      h('label', { class: 'check-row' }, harv, h('span', {}, S.ui.harvestable)),
      editing ? null : field(S.ui.stageLabel, stage),
      field(S.ui.location, location),
      field(S.ui.sourceLabel, src.el),
      editing ? null : field(S.ui.startDate, start),
      field(S.ui.baseOverride, base),
      editing ? null : field(S.ui.photo, photo),
      editing ? null : field(S.ui.note, note),
      datalist('dl-variety', [...new Set(plants.map((p) => p.variety).filter(Boolean))]),
      datalist('dl-location', [...new Set(plants.map((p) => p.location).filter(Boolean))]),
      errBox,
      h('div', { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => navigate(editing ? `/plant/${id}` : '/') }, S.ui.cancel),
        h('button', { type: 'submit', class: 'btn btn-primary', id: 'btn-save' }, S.ui.save)),
      editing ? h('button', { type: 'button', class: 'btn btn-danger delete-plant', id: 'btn-delete', onclick: remove }, icon('trash'), S.ui.delete) : null));
  return undefined;
}
