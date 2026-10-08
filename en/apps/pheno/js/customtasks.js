// Custom tasks (RCv0.193): templates live in meta.taskTemplates; a plant opts in through task_assign events.
// Generation is pure and plugs into getPlantTasks as type 'custom'. No learning in v1: the interval is what the user set.
import { CATEGORIES, CYCLE_STAGES, ENVIRONMENTS, PERENNIAL_STAGES } from './config-categories.js';
import { S } from './strings.cs.js';
import { addDays, dayDiff } from './utils.js';

export const MAX_TEMPLATES = 30;
export const MAX_ONCE = 30;
export const TASK_ICONS = ['check', 'drop', 'leaf', 'bug', 'scissors', 'thermo', 'ruler', 'flag', 'sun', 'pot', 'note', 'camera', 'swap', 'stage'];
export const ANCHORS = ['lastDone', 'fixed', 'stageStart'];
export const TASK_MODES = ['recurring', 'once'];
export const ASSIGN_ACTIONS = ['enable', 'pause', 'end'];
export const ALL_STAGES = [...new Set([...Object.values(CYCLE_STAGES).flat(), ...PERENNIAL_STAGES])];

export const isTemplateId = (v) => typeof v === 'string' && /^t[a-z0-9]{3,24}$/.test(v);
export const newTemplateId = () => `t${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
export const cleanLabel = (v, max = 40) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
const intIn = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const subset = (arr, allowed) => (Array.isArray(arr) ? [...new Set(arr.filter((x) => allowed.includes(x)))] : []);

/** Whitelist templates read from storage or from an untrusted backup. */
export function cleanTemplates(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object' || !isTemplateId(t.id) || seen.has(t.id)) continue;
    const label = cleanLabel(t.label);
    if (!label) continue;
    seen.add(t.id);
    const anchor = ANCHORS.includes(t.anchor) ? t.anchor : 'lastDone';
    const clean = {
      id: t.id, label, icon: TASK_ICONS.includes(t.icon) ? t.icon : 'check',
      mode: TASK_MODES.includes(t.mode) ? t.mode : 'recurring',
      intervalDays: intIn(t.intervalDays, 1, 365) ?? 7, anchor
    };
    if (anchor === 'stageStart') clean.offsetDays = intIn(t.offsetDays, 0, 365) ?? clean.intervalDays;
    const ap = t.appliesTo && typeof t.appliesTo === 'object' ? t.appliesTo : {};
    const appliesTo = {};
    const cats = subset(ap.categories, Object.keys(CATEGORIES)), stages = subset(ap.stages, ALL_STAGES), envs = subset(ap.environments, ENVIRONMENTS);
    if (cats.length) appliesTo.categories = cats;
    if (stages.length) appliesTo.stages = stages;
    if (envs.length) appliesTo.environments = envs;
    if (Object.keys(appliesTo).length) clean.appliesTo = appliesTo;
    out.push(clean);
    if (out.length >= MAX_TEMPLATES) break;
  }
  return out;
}

/** Union by id; the local copy wins. */
export function mergeTemplates(local, incoming) {
  const have = new Set(local.map((t) => t.id));
  return cleanTemplates([...local, ...incoming.filter((t) => !have.has(t.id))]);
}

/** Does the template's filter match the plant right now (category, current stage, current environment)? */
export function templateApplies(t, plant) {
  const a = t.appliesTo;
  if (!a) return true;
  return (!a.categories || a.categories.includes(plant.category))
    && (!a.stages || a.stages.includes(plant.cache?.stage))
    && (!a.environments || a.environments.includes(plant.cache?.environment));
}

/** Next due date of one assigned template, or null when it is finished. `st` = plant.cache.customTasks[id]. */
export function templateDue(t, st, plant) {
  if (!st || st.state !== 'active') return null;
  if (t.mode === 'once' && st.doneCount > 0) return null;
  const last = st.lastDoneAt;
  if (t.anchor === 'fixed') {
    const n = last ? Math.floor(dayDiff(st.since, last) / t.intervalDays) + 1 : 1;
    return addDays(st.since, n * t.intervalDays);
  }
  if (t.anchor === 'stageStart') {
    const stageAt = plant.cache?.stageSince;
    const base = stageAt && stageAt > st.since ? stageAt : st.since;
    return last && last >= base ? addDays(last, t.intervalDays) : addDays(base, t.offsetDays ?? t.intervalDays);
  }
  return addDays(last ?? st.since, t.intervalDays);
}

/** Tasks of one plant from assigned templates and open one-off tasks. Pure. */
export function customTasks(plant, now, templates = []) {
  const c = plant.cache;
  if (!c || plant.archivedAt) return [];
  const out = [];
  for (const t of templates) {
    const st = c.customTasks?.[t.id];
    if (!st || !templateApplies(t, plant)) continue;
    const due = templateDue(t, st, plant);
    if (due) out.push({ dueAt: due, snoozeKey: `custom:${t.id}`, ref: t.id, templateId: t.id, label: t.label, icon: t.icon });
  }
  for (const o of c.onceTasks || []) {
    if (!o.doneAt) out.push({ dueAt: o.dueAt, snoozeKey: `custom:${o.id}`, ref: o.id, label: o.label, icon: 'check', once: true });
  }
  return out;
}

/** Title of any task row: custom tasks carry their own label. */
export const taskTitle = (task) => (task.type === 'custom' ? task.label : S.taskLabel[task.type]);
