/**
 * Compiles resources/themes/<id>/ into <out>/<id>/ :
 *   config.json            copied
 *   styles/styles.css      compiled from styles/styles.less (LESS)
 *   images/*               copied (jpg, png, gif, …)
 * Layout is preserved, so relative url("../images/…") in the LESS works in the output too.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import less from 'less';
import { validateParentChains, validateThemeConfig } from './theme-lib.mjs';

function listThemeFolders(srcDir) {
  return readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Returns { built: string[] }; throws one Error listing every problem found. */
export async function buildThemes({ srcDir, outDir, only = null }) {
  const folders = listThemeFolders(srcDir);
  const configs = [];
  const problems = [];

  for (const folder of folders) {
    const configPath = join(srcDir, folder, 'config.json');
    if (!existsSync(configPath)) {
      problems.push(`${folder}: config.json is missing`);
      continue;
    }
    let config;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (cause) {
      problems.push(`${folder}: config.json is not valid JSON (${cause.message})`);
      continue;
    }
    const imagesDir = join(srcDir, folder, 'images');
    const imageFiles = existsSync(imagesDir) ? readdirSync(imagesDir) : [];
    problems.push(...validateThemeConfig(config, folder, imageFiles));
    configs.push(config);
  }
  problems.push(...validateParentChains(configs));
  if (only && !folders.includes(only)) {
    problems.push(`theme "${only}" does not exist in ${srcDir}`);
  }
  if (problems.length > 0) {
    throw new Error(`Theme configuration problems:\n- ${problems.join('\n- ')}`);
  }

  const built = [];
  for (const folder of only ? [only] : folders) {
    const target = join(outDir, folder);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(join(target, 'styles'), { recursive: true });

    cpSync(join(srcDir, folder, 'config.json'), join(target, 'config.json'));
    if (existsSync(join(srcDir, folder, 'images'))) {
      cpSync(join(srcDir, folder, 'images'), join(target, 'images'), { recursive: true });
    }

    const lessFile = join(srcDir, folder, 'styles', 'styles.less');
    if (existsSync(lessFile)) {
      try {
        const output = await less.render(readFileSync(lessFile, 'utf-8'), {
          filename: lessFile,
          // a child theme's imported parent keeps working: urls are rewritten relative to the entry file
          rewriteUrls: 'all',
        });
        writeFileSync(join(target, 'styles', 'styles.css'), output.css);
      } catch (cause) {
        throw new Error(
          `${folder}: LESS compile failed — ${cause.message} (${cause.filename ?? lessFile}:${cause.line ?? '?'})`,
        );
      }
    }
    built.push(folder);
  }
  return { built };
}
