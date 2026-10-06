// Pure: turn events into diary rows and daily counters. No DOM.
import { liveEvents } from './model.js';
import { S } from './strings.cs.js';
import { dayDiff } from './utils.js';
import { num } from './format.js';

const DONE_TYPES = ['watering', 'moisture_check', 'fertilizing', 'pest_check', 'batch_check'];

/** Care actions recorded on the same calendar day as `now`. */
export function doneToday(events, now) {
  return liveEvents(events).filter((e) => DONE_TYPES.includes(e.type) && dayDiff(e.occurredAt, now) === 0).length;
}

/** Latest live photo event of a plant → photoId or null. */
export function latestPhotoId(events) {
  const photos = liveEvents(events).filter((e) => e.type === 'photo');
  return photos.length ? photos.at(-1).payload.photoId : null;
}

/** Describe one event: {icon, title, detail}. */
export function describeEvent(e) {
  const p = e.payload || {};
  switch (e.type) {
    case 'created': return { icon: 'sprout', title: 'Rostlina založena', detail: `${S.environment[p.environment] || ''}` };
    case 'stage_change': return { icon: 'stage', title: `Fáze: ${S.stage[p.to] || p.to}`, detail: '' };
    case 'environment_change': return { icon: 'swap', title: `Prostředí: ${S.environment[p.environment]}`, detail: '' };
    case 'watering': return { icon: 'drop', title: 'Zalito', detail: p.amountMl ? `${p.amountMl} ml` : '' };
    case 'moisture_check':
      return { icon: 'drop', title: `Vlhkost: ${S.moisture[p.answer]}`, detail: p.watered ? 'zalito' : 'nezalito', answer: p.answer };
    case 'fertilizing': return { icon: 'leaf', title: 'Přihnojeno', detail: p.product || '' };
    case 'pest_check': return { icon: 'bug', title: 'Kontrola škůdců', detail: p.found ? 'nalezeno' : 'čisto' };
    case 'problem': return { icon: 'bug', title: `Problém: ${S.problem[p.problemType]}`, detail: `závažnost ${p.severity}${p.note ? ` · ${p.note}` : ''}` };
    case 'problem_resolved': return { icon: 'check', title: 'Problém vyřešen', detail: '' };
    case 'note': return { icon: 'note', title: 'Poznámka', detail: p.text };
    case 'photo': return { icon: 'camera', title: 'Fotka', detail: p.caption || '', photoId: p.photoId };
    case 'measurement': return { icon: 'thermo', title: `Měření: ${p.kind}`, detail: `${num(p.value, 2)}${p.unit ? ` ${p.unit}` : ''}` };
    case 'milestone': return { icon: 'flag', title: p.label, detail: '' };
    case 'harvest': return { icon: 'leaf', title: p.final ? 'Poslední sklizeň' : 'Sklizeň', detail: S.processing[p.processingMethod] || '' };
    case 'batch_step': return { icon: 'stage', title: `Dávka: ${S.batchPhase[p.phase] || p.phase}`, detail: p.note || '' };
    case 'batch_check': {
      const bits = [p.dryness != null ? S.dryness[p.dryness] : null, p.mold ? 'plíseň' : p.mold === false ? 'bez plísně' : null,
        p.scent ? `vůně ${p.scent}/5` : null, p.appearance ? `vzhled ${p.appearance}/5` : null, p.note || null].filter(Boolean);
      return { icon: 'check', title: 'Kontrola dávky', detail: bits.join(' · ') };
    }
    case 'care': return { icon: 'leaf', title: p.kind === 'custom' ? p.label : S.care[p.kind], detail: [p.potVolumeL ? `${num(p.potVolumeL, 1)} l` : '', p.note || ''].filter(Boolean).join(' · ') };
    case 'evaluation': return {
      icon: 'check', title: S.evalKind[p.kind ?? 'final'],
      detail: [`${p.scores?.overall}/5`, p.part || ''].filter(Boolean).join(' · ')
    };
    case 'archive': return { icon: 'pot', title: 'Archivováno', detail: '' };
    case 'unarchive': return { icon: 'pot', title: 'Obnoveno z archivu', detail: '' };
    default: return { icon: 'note', title: e.type, detail: '' };
  }
}

/** Diary rows newest first; voided events and void markers are left out. */
export function diaryRows(events) {
  return liveEvents(events).slice().reverse().map((e) => ({ event: e, ...describeEvent(e) }));
}
