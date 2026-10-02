// Lint: syntax check every JS file, ban placeholders, check relative imports resolve.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    if (f === 'node_modules' || f === 'vendor' || f === 'dist' || f.startsWith('.')) continue;
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
  }
})(root);

const banned = [/\bTODO\b/, /\bFIXME\b/, /\.\.\. ?rest/i, /same as before/i, /\/\/ \.\.\.$/m];
let errors = 0;
const fail = (m) => { console.error(m); errors += 1; };

for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { fail(`syntax: ${f}\n${e.stderr}`); }
  const src = readFileSync(f, 'utf8');
  if (!f.endsWith('lint.js')) for (const re of banned) if (re.test(src)) fail(`placeholder ${re} in ${f}`);
  for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
    if (!existsSync(resolve(dirname(f), m[1]))) fail(`missing import ${m[1]} in ${f}`);
  }
}
// file:// bundle must be current.
{
  const { bundle, bundlePath } = await import('./build-local.js');
  if (!existsSync(bundlePath) || readFileSync(bundlePath, 'utf8') !== await bundle()) fail('dist/pheno.local.js is stale: run npm run build:local');
}
// Service worker: cache name matches VERSION, every shipped file is precached and exists.
const version = readFileSync(join(root, 'js/version.js'), 'utf8').match(/'(RCv[^']+)'/)?.[1];
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
if (sw.match(/pheno-shell-(RCv[^']+)/)?.[1] !== version) fail(`sw.js cache name does not match VERSION ${version}`);
const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
for (const f of listed) if (!existsSync(join(root, f))) fail(`sw.js lists missing file ${f}`);
(function walk(d, rel = '') {
  for (const f of readdirSync(d)) {
    const p = join(d, f), r = rel ? `${rel}/${f}` : f;
    if (statSync(p).isDirectory()) { if (['css', 'js', 'fonts', 'assets', 'vendor', 'icons'].includes(f)) walk(p, r); }
    else if (rel && !listed.includes(r)) fail(`sw.js does not precache ${r}`);
  }
})(root);
if (errors) process.exit(1);
console.log(`lint ok: ${files.length} files`);
