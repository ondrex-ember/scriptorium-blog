// Pure helpers. No DOM, no storage.
const DAY_MS = 86400000;
let lastTs = 0;
let seq = 0;

/** Time-sortable unique id: 9 chars time + 4 counter + 4 random. */
export function uid() {
  const ts = Date.now();
  if (ts === lastTs) seq += 1; else { lastTs = ts; seq = 0; }
  const rnd = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return ts.toString(36).padStart(9, '0') + seq.toString(36).padStart(3, '0') + rnd;
}

export const nowIso = () => new Date().toISOString();

export function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function daysBetween(fromIso, toIso) {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mean(a) {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}

/** Weights 1..n, newest (last) heaviest. */
export function weightedMean(a) {
  if (!a.length) return 0;
  let s = 0, w = 0;
  a.forEach((v, i) => { s += v * (i + 1); w += i + 1; });
  return s / w;
}

/** Coefficient of variation (std/mean); 0 for <2 samples or zero mean. */
export function coefVariation(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  if (m === 0) return 0;
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length;
  return Math.sqrt(v) / m;
}

/** Normalized variety key: lowercase, no diacritics, single spaces. */
export function normalizeKey(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const MIRROR = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };

/** Meteorological season from an ISO date; mirrored for the southern hemisphere. */
export function seasonOf(iso, hemisphere = 'north') {
  const m = new Date(iso).getMonth(); // 0-11, local time
  const north = m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
  return hemisphere === 'south' ? MIRROR[north] : north;
}

/** Local calendar-day difference (b - a), ignoring time of day. */
export function dayDiff(aIso, bIso) {
  const a = new Date(aIso), b = new Date(bIso);
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** Shape of a plant-group id (groups live in meta.groups; a plant stores only the id). */
export const isGroupId = (v) => typeof v === 'string' && /^g[a-z0-9]{3,24}$/.test(v);

export function compareEvents(a, b) {
  return a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1
    : a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1
    : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Error carrying a machine code; message is a Czech UI string. */
export class PhenoError extends Error {
  constructor(code, message) { super(message || code); this.name = 'PhenoError'; this.code = code; }
}
