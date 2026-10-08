// Plant groups: list, detail with bulk actions, and the bulk sheets reused by dashboard clusters.
import { MOISTURE_ANSWERS } from './config-categories.js';
import { SEASONAL_ENVIRONMENTS } from './config-engine.js';
import { ctx, loadAll, refreshGroups } from './ctx.js';
import { chipGroup, clear, field, h, icon, put } from './dom.js';
import { assignGroup, saveGroups } from './events.js';
import { num, plantsWord } from './format.js';
import { varietyMetrics } from './metrics.js';
import { metricRows } from './ui-metrics.js';
import { GROUP_KINDS, MAX_GROUPS, commonStages, compareAcrossGroups, groupStats, groupsFromLocations, membersOf, newGroupId } from './groups.js';
import { guard, navigate } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { S } from './strings.cs.js';
import { buttons, dateField, submitBulk } from './ui-forms.js';
import { askHemisphere } from './ui-plant-form.js';
import { onceForm } from './ui-tasks.js';

const G = S.groups;

/** Bulk sheet for one kind of action on the given plants. `done` runs after the write (re-render). */
export function bulkSheet(kind, plants, done) {
  const active = plants.filter((p) => !p.archivedAt);
  if (!active.length) return toast(G.pickSome);
  const ids = active.map((p) => p.id);
  const d = dateField();
  const title = `${kind === 'task' ? S.tasks.bulkTitle : kind === 'once' ? S.tasks.bulkOnce : (G[kind === 'pest' ? 'pestOk' : kind] ?? kind)} – ${G.selected(ids.length)}`;
  const body = h('div', { class: 'bulk-sheet', dataset: { kind } });
  const save = (make, msg) => submitBulk(ids, make, msg, done);
  if (kind === 'moisture') {
    let answer = null, touched = false;
    const cb = h('input', { type: 'checkbox', checked: true });
    cb.addEventListener('change', () => { touched = true; });
    const opts = MOISTURE_ANSWERS.map((a) => h('button', { type: 'button', class: `moisture-btn ${a}`, dataset: { answer: a },
      onclick: () => { answer = a; opts.forEach((o) => o.classList.toggle('selected', o.dataset.answer === a)); if (!touched) cb.checked = a !== 'wet'; } }, S.moisture[a]));
    put(body, h('div', { class: 'moisture-row' }, opts), h('label', { class: 'check-row' }, cb, h('span', {}, S.ui.watered)), d.el,
      buttons(() => {
        if (!answer) return toast(S.err.invalid);
        const at = d.get(), watered = cb.checked;
        save([{ type: 'moisture_check', occurredAt: at, payload: { answer, watered } }], `${S.moisture[answer]}${watered ? ' · zalito' : ''}`);
      }));
  } else if (kind === 'watering') {
    put(body, d.el, buttons(() => save([{ type: 'watering', occurredAt: d.get(), payload: {} }], 'Zalito')));
  } else if (kind === 'fertilizing') {
    const product = h('input', { type: 'text', id: 'bulk-product' });
    put(body, field('Hnojivo (nepovinné)', product), d.el,
      buttons(() => save([{ type: 'fertilizing', occurredAt: d.get(), payload: product.value.trim() ? { product: product.value.trim() } : {} }], 'Přihnojeno')));
  } else if (kind === 'pest') {
    put(body, h('p', { class: 'muted' }, 'Zapíše kontrolu bez nálezu. Nález nahlas u konkrétní rostliny.'), d.el,
      buttons(() => save([{ type: 'pest_check', occurredAt: d.get(), payload: { found: false } }], 'Kontrola zapsána')));
  } else if (kind === 'note') {
    const text = h('textarea', { id: 'bulk-note', rows: 3 });
    put(body, field(S.ui.note, text), d.el,
      buttons(() => { if (!text.value.trim()) return toast(S.err.invalid); return save([{ type: 'note', occurredAt: d.get(), payload: { text: text.value } }], 'Poznámka uložena'); }));
  } else if (kind === 'task') {
    if (!ctx.taskTemplates.length) return toast(S.tasks.noTemplates);
    const tpl = chipGroup(ctx.taskTemplates.map((t) => [t.id, t.label]), ctx.taskTemplates[0].id);
    const action = chipGroup([['enable', S.tasks.enable], ['pause', S.tasks.pause], ['end', S.tasks.end]], 'enable');
    tpl.el.id = 'bulk-template';
    put(body, field(S.tasks.pickTemplate, tpl.el), field(S.tasks.action, action.el), d.el,
      buttons(() => {
        const t = ctx.taskTemplates.find((x) => x.id === tpl.get());
        const a = action.get(), at = d.get();
        save([{ type: 'task_assign', occurredAt: at, payload: { templateId: t.id, action: a } }], `${t.label}: ${S.tasks[a]}`);
      }));
  } else if (kind === 'once') {
    const f = onceForm();
    put(body, f.el, buttons(() => {
      const v = f.get();
      if (!v.label) return toast(S.err.invalid);
      return save([{ type: 'task_once', payload: v }], S.tasks.onceTitle);
    }));
  } else if (kind === 'stage') {
    const stages = commonStages(active);
    if (!stages.length) return toast(G.noCommonStage);
    const chips = chipGroup(stages.map((k) => [k, S.stage[k] || k]), null);
    put(body, field(S.ui.stageLabel, chips.el), d.el,
      buttons(() => {
        const to = chips.get();
        if (!to) return toast(S.err.invalid);
        const at = d.get();
        save((p) => (p.cache.stage === to ? null : [{ type: 'stage_change', occurredAt: at, payload: { from: p.cache.stage, to } }]), `${S.ui.stageLabel}: ${S.stage[to] || to}`);
      }));
  } else if (kind === 'env') {
    const chips = chipGroup(Object.entries(S.environment), null);
    put(body, field(S.ui.environment, chips.el), d.el,
      buttons(async () => {
        const environment = chips.get();
        if (!environment) return toast(S.err.invalid);
        if (SEASONAL_ENVIRONMENTS.includes(environment)) await askHemisphere();
        const at = d.get();
        save((p) => (p.cache.environment === environment ? null : [{ type: 'environment_change', occurredAt: at, payload: { environment } }]), `${S.ui.environment}: ${S.environment[environment]}`);
      }));
  }
  return openSheet(title, body);
}

/** Create or edit a group in a sheet. */
export function groupEditSheet(group, done) {
  const label = h('input', { type: 'text', id: 'g-label', maxlength: 40, value: group?.label || '', placeholder: 'např. Box A' });
  const kind = chipGroup(GROUP_KINDS.map((k) => [k, G.kinds[k]]), group?.kind || 'place');
  const env = chipGroup([['', '—'], ...Object.entries(S.environment)], group?.environment || '');
  kind.el.id = 'g-kind'; env.el.id = 'g-env';
  openSheet(group ? G.rename : G.add, h('div', {}, field(G.label, label), field(G.kind, kind.el), field(G.defaultEnv, env.el),
    buttons(async () => {
      const text = label.value.trim();
      if (!text) return toast(S.err.name);
      const list = ctx.groups.slice();
      if (group) {
        const i = list.findIndex((g) => g.id === group.id);
        list[i] = { id: group.id, label: text, kind: kind.get(), ...(env.get() ? { environment: env.get() } : {}) };
      } else {
        if (list.length >= MAX_GROUPS) return toast(G.limit);
        list.push({ id: newGroupId(), label: text, kind: kind.get(), ...(env.get() ? { environment: env.get() } : {}) });
      }
      await saveGroups(ctx.db, list);
      await refreshGroups();
      closeSheet(); toast(group ? G.saved : G.created);
      done?.(group ? group.id : list.at(-1).id);
    })));
}

// ---------- list ----------
export async function renderGroups(root) {
  const alive = guard();
  const { plants, byPlant } = await loadAll();
  await refreshGroups();
  const groups = ctx.groups;
  const rerender = () => renderGroups(root);
  const proposals = groupsFromLocations(plants.filter((p) => !p.archivedAt), groups);
  const cmp = compareAcrossGroups(plants, byPlant, groups);
  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.back, onclick: () => navigate('/') }, icon('back')),
      h('h1', {}, G.title),
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-new-group', 'aria-label': G.add, onclick: () => groupEditSheet(null, (id) => navigate(`/group/${id}`)) }, icon('plus'))),
    h('p', { class: 'muted pad-x' }, G.intro),
    groups.length
      ? h('div', { class: 'variety-list', id: 'group-list' }, groups.map((g) => {
        const m = membersOf(plants, g.id);
        const act = m.filter((p) => !p.archivedAt).length;
        return h('button', { type: 'button', class: 'card variety-card group-card', dataset: { group: g.id }, onclick: () => navigate(`/group/${g.id}`) },
          h('div', { class: 'variety-head' }, h('strong', {}, g.label), h('span', { class: 'tag' }, G.kinds[g.kind])),
          h('div', { class: 'muted' }, [`${act} ${plantsWord(act)}`, m.length > act ? `${m.length - act} archivováno` : null, g.environment ? S.environment[g.environment] : null].filter(Boolean).join(' · ')));
      }))
      : h('div', { class: 'empty-state', id: 'no-groups' }, G.none),
    proposals.length ? h('div', { class: 'card pad', id: 'group-proposals', style: 'margin:0 16px 12px' },
      h('h3', {}, G.fromPlaces), h('p', { class: 'muted' }, G.fromPlacesHint),
      proposals.map((pr) => h('div', { class: 'settings-row' }, h('span', {}, `${pr.label} (${pr.plantIds.length})`),
        h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: 'from-place' }, onclick: async () => {
          if (ctx.groups.length >= MAX_GROUPS) return toast(G.limit);
          const id = newGroupId();
          await saveGroups(ctx.db, [...ctx.groups, { id, label: pr.label, kind: 'place' }]);
          await refreshGroups();
          await assignGroup(ctx.db, pr.plantIds, id);
          toast(G.created); rerender();
        } }, G.add)))) : null,
    cmp.length ? h('section', { id: 'group-compare' },
      h('div', { class: 'section-title' }, G.compare), h('p', { class: 'muted pad-x' }, G.compareHint),
      cmp.map((c) => h('div', { class: 'card pad', style: 'margin:0 16px 10px' }, h('h3', {}, c.label),
        c.rows.map((r) => h('div', { class: 'settings-row' }, h('span', {}, `${r.group.label} (${r.n})`),
          h('strong', {}, [r.yieldPerPlant != null ? `${num(r.yieldPerPlant, 1)}` : null, r.avgOverall != null ? `${num(r.avgOverall)} ★` : null].filter(Boolean).join(' · ') || '—')))))) : null);
  return undefined;
}

// ---------- detail ----------
export async function renderGroup(root, id) {
  const alive = guard();
  const { plants, byPlant } = await loadAll();
  await refreshGroups();
  const group = ctx.groups.find((g) => g.id === id);
  if (!group) return navigate('/groups');
  const members = membersOf(plants, id).sort((a, b) => (a.name < b.name ? -1 : 1));
  const rerender = () => renderGroup(root, id);
  const checks = new Map();
  const counter = h('span', { class: 'muted', id: 'sel-count' });
  const selected = () => members.filter((p) => checks.get(p.id)?.checked);
  const upd = () => { counter.textContent = G.selected(selected().filter((p) => !p.archivedAt).length); };
  const rows = members.map((p) => {
    const cb = h('input', { type: 'checkbox', checked: !p.archivedAt, disabled: !!p.archivedAt, dataset: { plant: p.id } });
    cb.addEventListener('change', upd);
    checks.set(p.id, cb);
    return h('div', { class: 'item-row group-member', dataset: { plant: p.id } },
      h('label', { class: 'check-row', style: 'margin:0' }, cb),
      h('div', { class: 'item-info', role: 'button', tabindex: 0, onclick: () => navigate(`/plant/${p.id}`) },
        h('div', { class: 'item-name' }, p.name),
        h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' }, [p.variety, S.stage[p.cache.stage] || p.cache.stage, p.archivedAt ? S.ui.archived : null].filter(Boolean).join(' · ')))));
  });
  const setAll = (v) => { for (const p of members) if (!p.archivedAt) checks.get(p.id).checked = v; upd(); };
  const act = (kind, label, ic) => h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { bulk: kind },
    onclick: () => bulkSheet(kind, selected(), rerender) }, icon(ic), label);
  const stats = groupStats(members, byPlant);
  const others = plants.filter((p) => p.groupId !== id && !p.archivedAt);

  const addMembers = () => {
    const boxes = others.map((p) => ({ p, cb: h('input', { type: 'checkbox', dataset: { plant: p.id } }) }));
    openSheet(G.addMembers, h('div', {},
      boxes.length ? boxes.map(({ p, cb }) => h('label', { class: 'check-row' }, cb, h('span', {}, `${p.name}${p.groupId ? ` (${ctx.groups.find((g) => g.id === p.groupId)?.label ?? ''})` : ''}`)))
        : h('p', { class: 'muted' }, G.noMembers),
      buttons(async () => {
        const pick = boxes.filter((b) => b.cb.checked).map((b) => b.p.id);
        if (pick.length) await assignGroup(ctx.db, pick, id);
        closeSheet(); rerender();
      })));
  };
  const removeSel = async () => {
    const pick = selected().map((p) => p.id);
    if (!pick.length) return toast(G.pickSome);
    await assignGroup(ctx.db, pick, null);
    toast(G.saved); rerender();
  };
  const del = () => openSheet(G.delete, h('div', {}, h('p', { class: 'muted' }, G.deleteHint),
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
      h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-confirm-delete-group', onclick: async () => {
        await saveGroups(ctx.db, ctx.groups.filter((g) => g.id !== id));
        await refreshGroups(); closeSheet(); toast(G.saved); navigate('/groups');
      } }, G.delete))));

  if (!alive()) return undefined;
  upd();
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.back, onclick: () => navigate('/groups') }, icon('back')),
      h('h1', { id: 'group-title' }, group.label),
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-edit-group', 'aria-label': G.rename, onclick: () => groupEditSheet(group, rerender) }, icon('edit'))),
    h('div', { class: 'plant-tags pad-x' }, h('span', { class: 'tag' }, G.kinds[group.kind]), group.environment ? h('span', { class: 'tag' }, S.environment[group.environment]) : null),
    h('div', { class: 'section-title section-title-row' }, h('span', {}, G.members), counter),
    h('div', { class: 'pad-x', style: 'display:flex;gap:8px;margin-bottom:8px' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'sel-all', onclick: () => setAll(true) }, G.selectAll),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'sel-none', onclick: () => setAll(false) }, G.selectNone)),
    rows.length ? h('div', { class: 'card task-list', id: 'group-members' }, rows) : h('div', { class: 'empty-state' }, G.noMembers),
    h('div', { class: 'section-title' }, G.bulk),
    h('p', { class: 'muted pad-x' }, `${G.bulkHint} ${G.activeOnly}`),
    h('div', { class: 'bulk-actions pad-x', id: 'bulk-actions' },
      act('moisture', G.moisture, 'drop'), act('watering', G.water, 'drop'), act('fertilizing', G.fertilize, 'leaf'),
      act('pest', G.pestOk, 'bug'), act('note', G.note, 'note'), act('stage', G.stage, 'stage'), act('env', G.env, 'swap'),
      act('task', S.tasks.title, 'checklist'), act('once', S.tasks.once, 'flag')),
    h('div', { class: 'pad-x', style: 'display:flex;gap:8px;margin:12px 0' },
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'btn-add-members', onclick: addMembers }, icon('plus'), G.addMembers),
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'btn-remove-members', onclick: removeSel }, G.removeFrom)),
    members.length ? h('section', { id: 'group-stats' }, h('div', { class: 'section-title' }, G.stats),
      stats.varieties.map((v) => h('div', { class: 'card pad', style: 'margin:0 16px 10px' },
        h('div', { class: 'variety-head' }, h('strong', {}, v.label), h('span', { class: 'tag' }, `${v.plantCount} ${plantsWord(v.plantCount)}`)),
        h('div', { class: 'settings-row' }, h('span', {}, G.avgYield), h('strong', {}, v.yieldPerPlant != null ? num(v.yieldPerPlant, 1) : '—')),
        h('div', { class: 'settings-row' }, h('span', {}, G.rated), h('strong', {}, v.avgOverall != null ? `${num(v.avgOverall)} ★` : '—')),
        metricRows(varietyMetrics(v, byPlant, new Date().toISOString()).aggregates)))) : null,
    h('button', { type: 'button', class: 'btn btn-danger delete-plant', id: 'btn-delete-group', onclick: del }, icon('trash'), G.delete));
  return undefined;
}
