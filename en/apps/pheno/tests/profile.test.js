import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPlant } from '../js/events.js';
import { applyAcquisition, example, getProfile, parseAcquisition, PROFILES, setProfile, stripAcquisition } from '../js/profile.js';
import { exportBackup, importBackup, readBackup } from '../js/backup.js';
import { metaGet } from '../js/storage.js';
import { T0, basePlant, freshDb } from './harness.js';

const JSZip = createRequire(import.meta.url)('jszip');

test('parseAcquisition: valid profile, sanitised utm, unknown ignored', () => {
  const r = parseAcquisition('?profile=garden&utm_source=fb&utm_medium=cpc&utm_campaign=<b>x</b>&utm_foo=1&utm_content=' + 'a'.repeat(300));
  assert.equal(r.profile, 'garden');
  assert.equal(r.utm.utm_source, 'fb');
  assert.equal(r.utm.utm_campaign, 'bx/b');
  assert.equal(r.utm.utm_content.length, 100);
  assert.ok(!('utm_foo' in r.utm));
  assert.equal(parseAcquisition('?profile=hacker').profile, null);
  assert.equal(parseAcquisition('').utm, null);
});

test('stripAcquisition removes only acquisition params', () => {
  assert.equal(stripAcquisition('?profile=garden&utm_source=a&keep=1'), '?keep=1');
  assert.equal(stripAcquisition('?profile=garden'), '');
});

test('applyAcquisition: url profile only when none stored, utm stored once', async () => {
  const db = await freshDb();
  assert.equal(await applyAcquisition(db, '', T0), null);
  assert.equal(await applyAcquisition(db, '?profile=houseplants&utm_source=a', T0), 'houseplants');
  assert.equal(await metaGet(db, 'profileSource'), 'url');
  assert.equal(await applyAcquisition(db, '?profile=garden&utm_source=b', T0), 'houseplants');   // already set
  assert.equal((await metaGet(db, 'acquisition')).utm_source, 'a');                                // first touch wins
  await setProfile(db, 'mixed', 'settings');
  assert.equal(await getProfile(db), 'mixed');
  assert.equal(await metaGet(db, 'profileSource'), 'settings');
  await assert.rejects(setProfile(db, 'nope', 'settings'));
  await assert.rejects(setProfile(db, 'mixed', 'nope'));
});

test('profiles: defaults per spec 6.2, examples rotate for mixed', () => {
  assert.deepEqual(PROFILES.garden.preselect, { environment: 'outdoor', lifecycle: 'cycle' });
  assert.deepEqual(PROFILES.houseplants.preselect, { category: 'houseplant', environment: 'indoor', lifecycle: 'perennial', harvestable: false });
  assert.equal(PROFILES.controlled.preselect.environment, 'controlled');
  assert.deepEqual(PROFILES.mixed.preselect, {});
  assert.deepEqual(example('garden', 0), ['Rajče #1', 'San Marzano']);
  assert.notDeepEqual(example('mixed', 0), example('mixed', 1));
  assert.deepEqual(example('mixed', 9), example('mixed', 0));
  assert.deepEqual(example(null, 0), example('mixed', 0));
});

test('profile and acquisition survive export → import; bad values are dropped', async () => {
  const db = await freshDb();
  await createPlant(db, basePlant(), { now: T0 });
  await applyAcquisition(db, '?profile=controlled&utm_source=x', T0);
  const bytes = await exportBackup(db, { JSZip });
  const db2 = await freshDb();
  await importBackup(db2, bytes, { JSZip });
  assert.equal(await getProfile(db2), 'controlled');
  assert.equal(await metaGet(db2, 'profileSource'), 'url');
  assert.equal((await metaGet(db2, 'acquisition')).utm_source, 'x');

  const z = await JSZip.loadAsync(bytes);
  const data = JSON.parse(await z.file('data.json').async('string'));
  data.meta.profile = 'evil'; data.meta.acquisition = { utm_source: '<script>', junk: 1 };
  z.file('data.json', JSON.stringify(data));
  const parsed = await readBackup(await z.generateAsync({ type: 'uint8array' }), { JSZip });
  assert.ok(!('profile' in parsed.meta));
  assert.equal(parsed.meta.acquisition.utm_source, 'script');
  assert.ok(!('junk' in parsed.meta.acquisition));
});
