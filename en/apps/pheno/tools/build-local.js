// Bundles the ES modules into one classic script so index.html also works from file:// (browsers block modules there).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'dist/pheno.local.js');

export async function bundle() {
  const r = await build({ entryPoints: [join(root, 'js/main.js')], bundle: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
  return r.outputFiles[0].text;
}
export const bundlePath = out;

if (process.argv[1] === import.meta.filename) {
  const text = await bundle();
  writeFileSync(out, text);
  console.log(`built dist/pheno.local.js (${text.length} bytes)`);
}
