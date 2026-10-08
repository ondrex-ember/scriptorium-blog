// Plant groups (RCv0.193): a group is only a selector with defaults; the truth stays per plant.
// Bulk actions write one ordinary event per plant, all sharing an opId, so a whole operation can be undone.
import { ENVIRONMENTS, getStages } from './config-categories.js';
import { aggregateVarieties } from './stats.js';
import { isGroupId } from './utils.js';

export const GROUP_KINDS = ['place', 'cohort', 'bed'];
export const MAX_GROUPS = 40;
export const MAX_BULK = 100;
/** Task types that can be merged into one dashboard row and completed for the whole group. */
export const CLUSTER_TYPES = ['moisture', 'fertilizing', 'pestCheck'];

export { isGroupId };
export const newGroupId = () => `g${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
export const isOpId = (v) => typeof v === 'string' && /^[\w.-]{1,40}$/.test(v);
export const newOpId = () => `op${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Whitelist groups read from storage or from an untrusted backup. */
export function cleanGroups(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const g of raw) {
    if (!g || typeof g !== 'object' || !isGroupId(g.id) || seen.has(g.id)) continue;
    const label = String(g.label ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40);
    if (!label) continue;
    seen.add(g.id);
    out.push({ id: g.id, label, kind: GROUP_KINDS.includes(g.kind) ? g.kind : 'place', ...(ENVIRONMENTS.includes(g.environment) ? { environment: g.environment } : {}) });
    if (out.length >= MAX_GROUPS) break;
  }
  return out;
}

/** Union of two group lists by id; the local copy wins. */
export function mergeGroups(local, incoming) {
  const have = new Set(local.map((g) => g.id));
  return cleanGroups([...local, ...incoming.filter((g) => !have.has(g.id))]);
}

export const groupOf = (plant, groups) => (plant?.groupId ? groups.find((g) => g.id === plant.groupId) ?? null : null);
export const membersOf = (plants, groupId) => plants.filter((p) => p.groupId === groupId);

/** Stage keys valid for every given plant (bulk stage change offers only these). */
export function commonStages(plants) {
  if (!plants.length) return [];
  const lists = plants.map((p) => getStages(p.category, p.lifecycle));
  return lists[0].filter((s) => lists.every((l) => l.includes(s)));
}

/**
 * Merge tasks of one group into clusters. Only the same type and urgency of ≥2 plants of the same group are merged.
 * Returns an ordered list of {kind:'task', task} / {kind:'cluster', group, type, urgency, tasks}; order follows the first member.
 */
export function clusterTasks(tasks, plantsById, groups) {
  const out = [];
  const index = new Map();
  for (const t of tasks) {
    const g = CLUSTER_TYPES.includes(t.type) || (t.type === 'custom' && t.templateId) ? groupOf(plantsById.get(t.plantId), groups) : null;
    if (!g) { out.push({ kind: 'task', task: t }); continue; }
    const key = `${g.id}|${t.type}|${t.templateId ?? ''}|${t.urgency}`;
    if (!index.has(key)) { const c = { kind: 'cluster', group: g, type: t.type, urgency: t.urgency, ref: t.templateId ?? null, tasks: [] }; index.set(key, c); out.push(c); }
    index.get(key).tasks.push(t);
  }
  return out.map((c) => (c.kind === 'cluster' && c.tasks.length < 2 ? { kind: 'task', task: c.tasks[0] } : c));
}

/** Opt-in migration: distinct non-empty `location` values used by ≥2 plants that are not covered by a group of that name. */
export function groupsFromLocations(plants, groups) {
  const have = new Set(groups.map((g) => g.label.toLowerCase()));
  const byLoc = new Map();
  for (const p of plants) {
    const loc = (p.location || '').trim();
    if (!loc || p.groupId || have.has(loc.toLowerCase())) continue;
    if (!byLoc.has(loc)) byLoc.set(loc, []);
    byLoc.get(loc).push(p.id);
  }
  return [...byLoc.entries()].filter(([, ids]) => ids.length >= 2).map(([label, plantIds]) => ({ label, plantIds }));
}

/** Per-variety statistics inside one group (plants of the same variety and category only). */
export function groupStats(members, byPlant) {
  const varieties = aggregateVarieties(members, byPlant);
  return {
    count: members.length,
    active: members.filter((p) => !p.archivedAt).length,
    varieties
  };
}

/**
 * The same variety grown in different groups: [{category, key, label, rows:[{group, n, yieldPerPlant, avgOverall, yieldKey}]}].
 * Only varieties present in at least two groups are returned (comparing like with like).
 */
export function compareAcrossGroups(plants, byPlant, groups) {
  const acc = new Map();
  for (const g of groups) {
    for (const v of aggregateVarieties(membersOf(plants, g.id), byPlant)) {
      if (v.unnamed) continue;
      const k = `${v.category}|${v.key}`;
      if (!acc.has(k)) acc.set(k, { category: v.category, key: v.key, label: v.label, rows: [] });
      acc.get(k).rows.push({ group: g, n: v.plantCount, yieldPerPlant: v.yieldPerPlant, avgOverall: v.avgOverall, yieldKey: v.yieldKey });
    }
  }
  return [...acc.values()].filter((x) => x.rows.length >= 2).sort((a, b) => b.rows.length - a.rows.length);
}
