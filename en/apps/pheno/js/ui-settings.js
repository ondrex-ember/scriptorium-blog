// Settings: appearance, hemisphere, backup (ZIP export/import), storage, install state.
import { exportBackup, importBackup } from './backup.js';
import { ctx, getTheme, initCtx, setHemisphere, setTheme } from './ctx.js';
import { chipGroup, clear, field, h, put } from './dom.js';
import { fmtDateTime } from './format.js';
import { iosBrowserTab, isStandalone, persistGranted, storageEstimate } from './pwa.js';
import { PROFILE_KEYS, setProfile } from './profile.js';
import { guard, navigate } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { metaGet } from './storage.js';
import { S } from './strings.cs.js';
import { VERSION } from './version.js';

const mb = (b) => `${(b / 1048576).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} MB`;
const row = (label, value, id) => h('div', { class: 'settings-row' }, h('span', {}, label), h('strong', { id }, value));

function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function doExport(rerender) {
  toast(S.backup.exporting);
  try {
    const bytes = await exportBackup(ctx.db, { JSZip: globalThis.JSZip });
    download(bytes, `pheno_zaloha_${new Date().toISOString().slice(0, 10)}.zip`);
    toast(S.backup.exported);
    rerender?.();
  } catch (e) { toast(`${S.backup.failed}: ${e.message}`); }
}

function reportView(r) {
  const lines = [[S.backup.plantsAdded, r.plantsAdded], [S.backup.plantsExisting, r.plantsExisting],
    [S.backup.eventsAdded, r.eventsAdded], [S.backup.photosAdded, r.photosAdded], [S.backup.skipped, r.skipped]];
  return h('div', { id: 'import-report' },
    lines.map(([l, v]) => row(l, String(v))),
    r.conflicts?.length ? h('div', {}, h('div', { class: 'section-title' }, S.backup.conflicts),
      h('ul', { class: 'conflicts' }, r.conflicts.map((c) => h('li', {}, c.kind === 'plant' ? `Rostlina ${c.name}` : `Událost ${c.type} (${c.id})`)))) : null,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { closeSheet(); navigate('/'); } }, S.ui.done)));
}

export function importSheet(rerender) {
  const file = h('input', { type: 'file', id: 'import-file', accept: '.zip,application/zip' });
  const err = h('div', { class: 'form-error', id: 'import-error' });
  const go = h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-import-go', onclick: async () => {
    if (!file.files[0]) { err.textContent = S.backup.pickFile; return; }
    go.disabled = true; err.textContent = S.backup.importing;
    try {
      const report = await importBackup(ctx.db, file.files[0], { JSZip: globalThis.JSZip });
      await initCtx(ctx.db);
      openSheet(S.backup.importDone, reportView(report));
      rerender?.();
    } catch (e) { err.textContent = `${S.backup.failed}: ${e.message}`; go.disabled = false; }
  } }, S.backup.importBtn);
  openSheet(S.backup.import, h('div', {}, h('p', { class: 'muted' }, S.backup.importAsk), field('', file), err,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel), go)));
}

export async function renderSettings(root) {
  const alive = guard();
  const rerender = () => renderSettings(root);
  const persisted = (await persistGranted(ctx.db)) ?? (navigator.storage?.persisted ? await navigator.storage.persisted() : null);
  const est = await storageEstimate();
  const lastExport = await metaGet(ctx.db, 'lastExportAt');
  const theme = chipGroup([['tmave', S.theme.dark], ['svetle', S.theme.light]], getTheme(), setTheme);
  theme.el.id = 'theme-chips';
  const prof = chipGroup(PROFILE_KEYS.map((k) => [k, S.profile[k]]), ctx.profile, async (v) => { await setProfile(ctx.db, v, 'settings'); ctx.profile = v; });
  prof.el.id = 'profile-chips';
  const hemi = chipGroup([['north', S.ui.north], ['south', S.ui.south]], ctx.hemisphere, setHemisphere);
  hemi.el.id = 'hemisphere-chips';
  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' }, h('h1', {}, S.nav.settings)),
    h('div', { class: 'card pad' },
      field(S.ui.appearance, theme.el),
      field(S.profile.label, prof.el, S.profile.settingsHint),
      field(S.ui.hemisphere, hemi.el, 'Ovlivňuje roční období u rostlin venku a ve skleníku.')),
    h('div', { class: 'card pad' }, h('h3', {}, S.rules.open), h('p', { class: 'muted' }, S.rules.openHint),
      h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-rules', onclick: () => navigate('/settings/rules') }, S.rules.open)),
    h('div', { class: 'card pad' }, h('h3', {}, S.stock.settingsTitle), h('p', { class: 'muted' }, S.stock.settingsIntro),
      h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-stock-cfg', onclick: () => navigate('/settings/stock') }, S.stock.settingsTitle)),
    h('div', { class: 'card pad' }, h('h3', {}, S.crit.open), h('p', { class: 'muted' }, S.crit.openHint),
      h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-criteria', onclick: () => navigate('/settings/criteria') }, S.crit.open)),
    h('div', { class: 'card pad' }, h('h3', {}, S.backup.title),
      h('p', { class: 'muted' }, S.backup.hint),
      row(S.backup.lastExport, lastExport ? fmtDateTime(lastExport) : S.backup.never, 'last-export'),
      h('div', { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-export', onclick: () => doExport(rerender) }, S.backup.export),
        h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-import', onclick: () => importSheet(rerender) }, S.backup.import))),
    h('div', { class: 'card pad' }, h('h3', {}, S.storage.title),
      row(S.storage.persistent, persisted == null ? S.storage.unknown : persisted ? S.storage.yes : S.storage.no, 'persist-state'),
      persisted === false ? h('p', { class: 'muted' }, S.persistWarn) : null,
      est ? row(S.storage.usage, `${mb(est.usage)} / ${mb(est.quota)}`, 'storage-usage') : null,
      row(S.storage.installState, isStandalone() ? S.storage.installedYes : S.storage.installedNo, 'install-state'),
      iosBrowserTab() ? h('div', { class: 'banner critical', id: 'ios-warn' }, S.storage.iosWarn) : null,
      h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-install-guide', onclick: () => navigate('/install') }, S.storage.installGuide)),
    h('div', { class: 'card pad' }, row(S.ui.version, VERSION)));
}
