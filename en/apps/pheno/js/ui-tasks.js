// Custom tasks UI: template list (settings), per-plant assignment sheet, bulk helpers.
import { CATEGORIES, ENVIRONMENTS } from './config-categories.js';
import { ALL_STAGES, ANCHORS, MAX_TEMPLATES, TASK_ICONS, TASK_MODES, newTemplateId } from './customtasks.js';
import { ctx, refreshTemplates } from './ctx.js';
import { chipGroup, clear, field, h, icon, put } from './dom.js';
import { saveTemplates } from './events.js';
import { toLocalInput } from './format.js';
import { guard, navigate } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { S } from './strings.cs.js';
import { buttons, submit } from './ui-forms.js';

const T = S.tasks;

/** Multi-select chips: returns {el, get() → array of selected keys}. */
export function multiChips(options, selected = []) {
  const sel = new Set(selected);
  const el = h('div', { class: 'chip-group', role: 'group' });
  for (const [v, label] of options) {
    const b = h('button', { type: 'button', class: `chip${sel.has(v) ? ' selected' : ''}`, dataset: { value: v },
      onclick: () => { if (sel.has(v)) sel.delete(v); else sel.add(v); b.classList.toggle('selected', sel.has(v)); } }, label);
    el.append(b);
  }
  return { el, get: () => options.map(([v]) => v).filter((v) => sel.has(v)) };
}

const describe = (t) => [T.modes[t.mode], t.mode === 'recurring' ? T.every(t.intervalDays) : null,
  t.anchor !== 'lastDone' ? T.anchors[t.anchor] : null].filter(Boolean).join(' · ');

export function templateSheet(tpl, done) {
  const label = h('input', { type: 'text', id: 't-label', maxlength: 40, value: tpl?.label || '', placeholder: 'např. Přesadit' });
  const ic = chipGroup(TASK_ICONS.map((k) => [k, k]), tpl?.icon || 'check');
  const mode = chipGroup(TASK_MODES.map((k) => [k, T.modes[k]]), tpl?.mode || 'recurring');
  const interval = h('input', { type: 'number', id: 't-interval', min: 1, max: 365, step: 1, inputmode: 'numeric', value: tpl?.intervalDays ?? 7 });
  const anchor = chipGroup(ANCHORS.map((k) => [k, T.anchors[k]]), tpl?.anchor || 'lastDone');
  const offset = h('input', { type: 'number', id: 't-offset', min: 0, max: 365, step: 1, inputmode: 'numeric', value: tpl?.offsetDays ?? '' });
  const cats = multiChips(Object.keys(CATEGORIES).map((k) => [k, S.category[k]]), tpl?.appliesTo?.categories);
  const stages = multiChips(ALL_STAGES.map((k) => [k, S.stage[k] || k]), tpl?.appliesTo?.stages);
  const envs = multiChips(ENVIRONMENTS.map((k) => [k, S.environment[k]]), tpl?.appliesTo?.environments);
  ic.el.id = 't-icon'; mode.el.id = 't-mode'; anchor.el.id = 't-anchor';
  openSheet(tpl ? T.edit : T.add, h('div', { class: 'stack' },
    field(T.label, label), field(T.mode, mode.el), field(T.interval, interval), field(T.anchor, anchor.el), field(T.offset, offset),
    field(T.icon, ic.el), h('div', { class: 'section-title flush' }, T.applies),
    field(T.categories, cats.el), field(T.stages, stages.el), field(T.environments, envs.el),
    buttons(async () => {
      const text = label.value.trim();
      if (!text) return toast(S.err.name);
      const iv = Number(interval.value);
      if (!Number.isInteger(iv) || iv < 1 || iv > 365) return toast(S.err.invalid);
      const next = { id: tpl?.id ?? newTemplateId(), label: text, icon: ic.get(), mode: mode.get(), intervalDays: iv, anchor: anchor.get(),
        ...(anchor.get() === 'stageStart' && offset.value !== '' ? { offsetDays: Number(offset.value) } : {}),
        appliesTo: { categories: cats.get(), stages: stages.get(), environments: envs.get() } };
      const list = ctx.taskTemplates.slice();
      const i = list.findIndex((x) => x.id === next.id);
      if (i >= 0) list[i] = next; else { if (list.length >= MAX_TEMPLATES) return toast(T.limit); list.push(next); }
      await saveTemplates(ctx.db, list);
      await refreshTemplates();
      closeSheet(); toast(T.saved); done?.();
      return undefined;
    })));
}

export async function renderTemplates(root) {
  const alive = guard();
  await refreshTemplates();
  const rerender = () => renderTemplates(root);
  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.back, onclick: () => navigate('/settings') }, icon('back')),
      h('h1', {}, T.title),
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-new-template', 'aria-label': T.add, onclick: () => templateSheet(null, rerender) }, icon('plus'))),
    h('p', { class: 'muted pad-x' }, T.intro),
    ctx.taskTemplates.length
      ? h('div', { class: 'variety-list', id: 'template-list' }, ctx.taskTemplates.map((t) => h('div', { class: 'card pad template-card', dataset: { template: t.id } },
        h('div', { class: 'variety-head' }, h('strong', {}, t.label), h('button', { type: 'button', class: 'btn btn-ghost btn-sm', dataset: { act: 'edit' }, 'aria-label': T.edit, onclick: () => templateSheet(t, rerender) }, icon('edit'))),
        h('div', { class: 'muted' }, describe(t)),
        h('div', { class: 'form-actions' },
          h('button', { type: 'button', class: 'btn btn-danger btn-sm', dataset: { act: 'delete' }, onclick: () => openSheet(T.delete, h('div', {}, h('p', { class: 'muted' }, T.deleteHint),
            h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
              h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-confirm-delete-template', onclick: async () => {
                await saveTemplates(ctx.db, ctx.taskTemplates.filter((x) => x.id !== t.id)); await refreshTemplates(); closeSheet(); toast(T.saved); rerender();
              } }, T.delete)))) }, icon('trash'), T.delete)))))
      : h('div', { class: 'empty-state', id: 'no-templates' }, T.none));
  return undefined;
}

/** One-off task form (label + due date) → task_once for the given plants. */
export function onceForm() {
  const label = h('input', { type: 'text', id: 'once-label', maxlength: 60 });
  const due = h('input', { type: 'date', id: 'once-due', value: toLocalInput(new Date().toISOString()).slice(0, 10) });
  return { el: h('div', { class: 'stack' }, field(T.onceLabel, label), field(T.onceDue, due)),
    get: () => ({ label: label.value.trim(), dueAt: new Date(`${due.value}T09:00:00`).toISOString() }) };
}

/** Per-plant sheet: toggle templates and add a one-off task. */
export function plantTasksSheet(plant, done) {
  const st = plant.cache.customTasks || {};
  const stateOf = (id) => st[id]?.state;
  const act = (t, action, label) => h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: action, template: t.id },
    onclick: () => submit(plant.id, [{ type: 'task_assign', payload: { templateId: t.id, action } }], `${t.label}: ${label}`, done) }, label);
  const rows = ctx.taskTemplates.map((t) => {
    const s = stateOf(t.id);
    return h('div', { class: 'settings-row task-assign-row', dataset: { template: t.id } },
      h('span', {}, h('strong', {}, t.label), h('div', { class: 'muted' }, `${describe(t)} · ${T[s === 'active' ? 'assigned' : s === 'paused' ? 'paused' : s === 'ended' ? 'ended' : 'off']}`)),
      h('span', { class: 'row-actions' },
        s !== 'active' ? act(t, 'enable', T.enable) : act(t, 'pause', T.pause),
        s && s !== 'ended' ? act(t, 'end', T.end) : null));
  });
  const once = onceForm();
  openSheet(`${T.plantTitle} – ${plant.name}`, h('div', { class: 'stack' },
    rows.length ? h('div', { id: 'plant-templates' }, rows) : h('p', { class: 'muted' }, T.noTemplates),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { closeSheet(); navigate('/settings/tasks'); } }, T.manage),
    h('div', { class: 'section-title flush' }, T.once), once.el,
    h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-add-once', onclick: () => {
      const v = once.get();
      if (!v.label) return toast(S.err.invalid);
      return submit(plant.id, [{ type: 'task_once', payload: v }], T.onceTitle, done);
    } }, T.addOnce)));
}
