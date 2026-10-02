// Formatting helpers (Czech).
import { dayDiff } from './utils.js';

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

export const pl = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
export const daysWord = (n) => pl(n, 'den', 'dny', 'dní');

/** "dnes", "zítra", "za 3 dny", "před 2 dny" relative to now (calendar days). */
export function relDay(iso, now) {
  const d = dayDiff(now, iso);
  if (d === 0) return 'dnes';
  if (d === 1) return 'zítra';
  if (d === -1) return 'včera';
  return d > 0 ? `za ${d} ${daysWord(d)}` : `před ${-d} ${daysWord(-d)}`;
}

export const num = (v, digits = 1) => (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString('cs-CZ');

/** ISO → value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());

/** "★★★★☆" for a whole or averaged rating (rounded). */
export const starsText = (n, max = 5) => {
  const r = Math.max(0, Math.min(max, Math.round(n)));
  return '★'.repeat(r) + '☆'.repeat(max - r);
};

export const plantsWord = (n) => pl(n, 'rostlina', 'rostliny', 'rostlin');
