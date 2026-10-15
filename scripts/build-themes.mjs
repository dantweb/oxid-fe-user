#!/usr/bin/env node
/**
 * npm run build:themes [-- --theme=<id>] [-- --watch]
 * Compiles resources/themes/* into public/themes/* (served at /themes/<id>/…).
 */
import { watch } from 'node:fs';
import { buildThemes } from './theme-build.mjs';

const args = process.argv.slice(2);
const only = args.find((arg) => arg.startsWith('--theme='))?.slice('--theme='.length) ?? null;
const watching = args.includes('--watch');
const srcDir = 'resources/themes';
const outDir = 'public/themes';

async function run() {
  try {
    const { built } = await buildThemes({ srcDir, outDir, only });
    console.log(`themes: built ${built.join(', ')} -> ${outDir}`);
    return true;
  } catch (error) {
    console.error(error.message);
    return false;
  }
}

const ok = await run();
if (!watching) {
  process.exit(ok ? 0 : 1);
}

console.log(`themes: watching ${srcDir} …`);
let timer;
watch(srcDir, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(run, 200);
});
