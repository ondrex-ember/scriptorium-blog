// Boot: open DB, mount shell, start router.
import { ctx, initCtx, getTheme, setTheme } from './ctx.js';
import { h, icon } from './dom.js';
import * as events from './events.js';
import { injectSprite } from './icons.js';
import * as model from './model.js';
import { navigate, route, setGate, startRouter } from './router.js';
import { renderOnboarding } from './ui-onboarding.js';
import { renderWalk } from './ui-walk.js';
import { applyAcquisition, getProfile, stripAcquisition } from './profile.js';
import { initPwa, requestPersistence } from './pwa.js';
import { listPlants, metaGet, metaSet, openDb } from './storage.js';
import { renderInstall } from './ui-install.js';
import { S } from './strings.cs.js';
import { renderDashboard } from './ui-dashboard.js';
import { renderPlant } from './ui-plant.js';
import { renderPlantForm } from './ui-plant-form.js';
import { renderCriteria } from './ui-criteria.js';
import { renderRules } from './ui-rules.js';
import { renderStockOverview } from './ui-stock.js';
import { renderStockCfg } from './ui-stockcfg.js';
import { renderSettings } from './ui-settings.js';
import { renderVarieties, renderVariety } from './ui-stats.js';
import { VERSION } from './version.js';

const NAV = [['/', 'overview', S.nav.overview, 'overview'], ['/walk', 'checklist', S.nav.walk, 'walk'],
  ['/varieties', 'leaf', S.nav.varieties, 'varieties'], ['/settings', 'settings', S.nav.settings, 'settings']];

async function boot() {
  setTheme(getTheme());
  injectSprite();
  document.getElementById('app-name').textContent = S.appName;
  document.getElementById('app-sub').textContent = S.subtitle;
  document.getElementById('version').textContent = VERSION;
  document.getElementById('bottom-nav').append(...NAV.map(([path, ic, label, key]) =>
    h('button', { type: 'button', dataset: { nav: key }, onclick: () => navigate(path) }, icon(ic, 'nav-icon'), label)));

  const db = await openDb();
  await initCtx(db);
  initPwa();
  ctx.profile = await applyAcquisition(db, location.search);
  if (location.search && stripAcquisition(location.search) !== location.search) {
    history.replaceState(null, '', `${location.pathname}${stripAcquisition(location.search)}${location.hash}`);
  }
  setGate(async (path) => {
    ctx.profile = await getProfile(db);
    if (!ctx.profile && path !== '/onboarding') return '/onboarding';
    if (ctx.profile && path === '/onboarding') return '/';
    return null;
  });
  if ((await metaGet(db, 'schemaVersion')) == null) await metaSet(db, 'schemaVersion', 1);
  try {   // projection changed (RCv0.191): rebuild caches once; one broken plant must not block startup
    if ((await metaGet(db, 'engineRev')) !== events.ENGINE_REV) { await events.rebuildAll(db); await metaSet(db, 'engineRev', events.ENGINE_REV); }
  } catch (e) { console.error('cache rebuild failed', e); }
  if ((await listPlants(db)).length) await requestPersistence(db);

  route('/', renderDashboard, 'overview');
  route('/new', (r, _p, q) => renderPlantForm(r, null, q), 'overview');
  route('/plant/:id', (r, p) => renderPlant(r, p.id), 'overview');
  route('/plant/:id/edit', (r, p) => renderPlantForm(r, p.id), 'overview');
  route('/walk', renderWalk, 'walk');
  route('/onboarding', renderOnboarding, 'overview');
  route('/varieties', renderVarieties, 'varieties');
  route('/variety/:category/:key', (r, p) => renderVariety(r, p.category, p.key), 'varieties');
  route('/settings', renderSettings, 'settings');
  route('/settings/rules', renderRules, 'settings');
  route('/settings/criteria', renderCriteria, 'settings');
  route('/stock', renderStockOverview, 'overview');
  route('/settings/stock', renderStockCfg, 'settings');
  route('/install', renderInstall, 'settings');
  await startRouter(document.getElementById('view'));
  window.pheno = { db, ...events, ...model };
}

boot().catch((e) => {
  document.getElementById('view').textContent = `Chyba: ${e.message}`;
  console.error(e);
});
