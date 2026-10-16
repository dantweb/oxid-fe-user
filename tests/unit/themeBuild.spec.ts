import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error untyped build script modules (plain .mjs by design)
import { buildThemes, stageThemeSources } from '../../scripts/theme-build.mjs';
// @ts-expect-error untyped build script modules (plain .mjs by design)
import { validateParentChains, validateThemeConfig } from '../../scripts/theme-lib.mjs';

describe('validateThemeConfig', () => {
  const valid = { id: 'x', name: 'X', parent: null, tokens: { '--oxfe-color-primary': '#fff' } };

  it('accepts a valid config', () => {
    expect(validateThemeConfig(valid, 'x')).toEqual([]);
  });

  it('reports id/folder mismatch, missing name, foreign token prefix and self-parent', () => {
    const problems: string[] = validateThemeConfig(
      { id: 'y', tokens: { '--other-thing': 'red' }, parent: 'x' },
      'x',
    );
    expect(problems.join('\n')).toContain('"id" is "y" but the folder is "x"');
    expect(problems.join('\n')).toContain('"name" is required');
    expect(problems.join('\n')).toContain('token "--other-thing" must start with "--oxfe-"');
    expect(problems.join('\n')).toContain('cannot be its own parent');
  });

  it('reports images that do not exist in images/', () => {
    const problems: string[] = validateThemeConfig(
      { ...valid, images: { logo: 'nope.png', hero: 'hero.jpg' } },
      'x',
      ['hero.jpg'],
    );
    expect(problems).toEqual(['x: image "logo" points to missing file "nope.png" in images/']);
  });
});

describe('validateParentChains', () => {
  it('reports unknown parents and cycles', () => {
    expect(validateParentChains([{ id: 'a', parent: 'ghost' }])).toEqual([
      'a: parent "ghost" does not exist',
    ]);
    const cyclic: string[] = validateParentChains([
      { id: 'a', parent: 'b' },
      { id: 'b', parent: 'a' },
    ]);
    expect(cyclic.join('\n')).toContain('cyclic');
  });

  it('accepts a proper parent chain', () => {
    expect(
      validateParentChains([
        { id: 'default', parent: null },
        { id: 'dark', parent: 'default' },
      ]),
    ).toEqual([]);
  });
});

describe('buildThemes', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'oxfe-themes-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function theme(id: string, config: object, less: string, images: string[] = []): void {
    const dir = join(root, 'src', id);
    mkdirSync(join(dir, 'styles'), { recursive: true });
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config));
    writeFileSync(join(dir, 'styles', 'styles.less'), less);
    for (const image of images) {
      writeFileSync(join(dir, 'images', image), 'binary-ish');
    }
  }

  const srcDir = (): string => join(root, 'src');
  const outDir = (): string => join(root, 'out');

  it('compiles LESS, copies config and images (jpg, png, gif), keeps the folder layout', async () => {
    theme(
      'default',
      { id: 'default', name: 'D', images: { logo: 'logo.png' } },
      '@c: #112233; :root { --oxfe-color-primary: @c; } .hero { background: url("../images/a.jpg"); }',
      ['logo.png', 'a.jpg', 'spin.gif'],
    );

    const { built } = await buildThemes({ srcDir: srcDir(), outDir: outDir() });

    expect(built).toEqual(['default']);
    const css = readFileSync(join(outDir(), 'default/styles/styles.css'), 'utf-8');
    expect(css).toContain('--oxfe-color-primary: #112233');
    expect(css).toContain('url("../images/a.jpg")');
    for (const file of ['config.json', 'images/logo.png', 'images/a.jpg', 'images/spin.gif']) {
      expect(existsSync(join(outDir(), 'default', file)), file).toBe(true);
    }
  });

  it('a child theme overrides parent LESS variables and rewrites the parent’s image urls', async () => {
    theme(
      'default',
      { id: 'default', name: 'D' },
      '@bg: #ffffff; body { background: @bg; } .hero { background: url("../images/hero.jpg"); }',
      ['hero.jpg'],
    );
    theme(
      'dark',
      { id: 'dark', name: 'Dark', parent: 'default' },
      '@import "../../default/styles/styles.less"; @bg: #000000;',
    );

    await buildThemes({ srcDir: srcDir(), outDir: outDir() });

    const css = readFileSync(join(outDir(), 'dark/styles/styles.css'), 'utf-8');
    expect(css).toContain('background: #000000');
    expect(css).toContain('url("../../default/images/hero.jpg")');
  });

  it('copies a theme’s fonts/ next to its styles, so url("../fonts/…") resolves', async () => {
    theme('default', { id: 'default', name: 'D' }, '@font-face { src: url("../fonts/a.woff2"); }');
    mkdirSync(join(srcDir(), 'default', 'fonts'));
    writeFileSync(join(srcDir(), 'default', 'fonts', 'a.woff2'), 'font');

    await buildThemes({ srcDir: srcDir(), outDir: outDir() });

    expect(existsSync(join(outDir(), 'default/fonts/a.woff2'))).toBe(true);
    expect(readFileSync(join(outDir(), 'default/styles/styles.css'), 'utf-8')).toContain(
      'url("../fonts/a.woff2")',
    );
  });

  it('stageThemeSources merges base and project themes; a project theme can import its base parent', async () => {
    theme('default', { id: 'default', name: 'D' }, '@bg: #fff; body { background: @bg; }');
    const project = join(root, 'project');
    mkdirSync(join(project, 'brand', 'styles'), { recursive: true });
    writeFileSync(
      join(project, 'brand', 'config.json'),
      JSON.stringify({ id: 'brand', name: 'B', parent: 'default' }),
    );
    writeFileSync(
      join(project, 'brand', 'styles', 'styles.less'),
      '@import "../../default/styles/styles.less"; @bg: #123456;',
    );

    const staged = stageThemeSources([srcDir(), project], join(root, 'staged'));
    const { built } = await buildThemes({ srcDir: staged, outDir: outDir() });

    expect(built).toEqual(['brand', 'default']);
    expect(readFileSync(join(outDir(), 'brand/styles/styles.css'), 'utf-8')).toContain(
      'background: #123456',
    );
  });

  it('builds a single theme with `only`', async () => {
    theme('default', { id: 'default', name: 'D' }, 'a{b:c}');
    theme('other', { id: 'other', name: 'O' }, 'a{b:c}');

    const { built } = await buildThemes({ srcDir: srcDir(), outDir: outDir(), only: 'other' });

    expect(built).toEqual(['other']);
    expect(existsSync(join(outDir(), 'default'))).toBe(false);
  });

  it('fails with every problem listed, building nothing', async () => {
    theme('default', { id: 'wrong', name: 'D' }, 'a{b:c}');
    theme('child', { id: 'child', name: 'C', parent: 'ghost' }, 'a{b:c}');

    await expect(buildThemes({ srcDir: srcDir(), outDir: outDir() })).rejects.toThrow(
      /"id" is "wrong"[\s\S]*parent "ghost" does not exist/,
    );
    expect(existsSync(outDir())).toBe(false);
  });

  it('reports a LESS compile error with the theme name', async () => {
    theme('default', { id: 'default', name: 'D' }, '.broken { color: @undefined-variable; }');

    await expect(buildThemes({ srcDir: srcDir(), outDir: outDir() })).rejects.toThrow(
      /default: LESS compile failed/,
    );
  });
});
