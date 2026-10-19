import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { renderPublicConfig } from '../../scripts/public-config.mjs';
import { parseInstanceConfig } from './helpers/yamlConfig';

/**
 * Every oxid-config.yaml in the repo must be USABLE, not just parseable: it boots (valid schema),
 * names only plugins this build contains, only themes that exist, only languages that have
 * message catalogs, and ships the external plugins it asks for.
 */

const bundledPlugins = readdirSync('plugins', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join('plugins', entry.name, 'index.ts')))
  .map((entry) => entry.name);
const themes = readdirSync('resources/themes');
const catalogs = readdirSync('src/i18n')
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace('.json', ''));

interface InstanceFile {
  label: string;
  file: string;
  /** folder holding plugins/ for `source: external` plugins */
  folder: string | null;
}

const files: InstanceFile[] = [
  { label: 'oxid-config.yaml.dist', file: 'oxid-config.yaml.dist', folder: null },
  ...readdirSync('instances').map((name) => ({
    label: `instances/${name}`,
    file: join('instances', name, 'oxid-config.yaml'),
    folder: join('instances', name),
  })),
  // the deployment's own file is instance-specific and gitignored: checked where it exists
  { label: 'oxid-config.yaml (this deployment)', file: 'oxid-config.yaml', folder: null },
];

describe.each(files)('$label', ({ file, folder }) => {
  const present = existsSync(file);

  it.skipIf(!present)('is valid and bootable', () => {
    expect(() => parseInstanceConfig(readFileSync(file, 'utf-8'))).not.toThrow();
  });

  it.skipIf(!present)('holds no payment provider key (docs/payments-keys.md)', () => {
    expect(() => renderPublicConfig(readFileSync(file, 'utf-8'))).not.toThrow();
  });

  it.skipIf(!present)('enables only bundled plugins this build contains', () => {
    const config = parseInstanceConfig(readFileSync(file, 'utf-8'));
    for (const [name, entry] of Object.entries(config.plugins)) {
      if (entry.enabled && entry.source === 'bundled') {
        expect(bundledPlugins, `bundled plugin "${name}"`).toContain(name);
      }
    }
  });

  it.skipIf(!present)('ships every external plugin it enables', () => {
    const config = parseInstanceConfig(readFileSync(file, 'utf-8'));
    for (const [name, entry] of Object.entries(config.plugins)) {
      if (entry.enabled && entry.source === 'external') {
        expect(folder, `external plugin "${name}" needs an instance folder`).not.toBeNull();
        expect(existsSync(join(folder as string, 'plugins', name, 'index.js'))).toBe(true);
      }
    }
  });

  it.skipIf(!present)('names only themes that exist and languages that have a catalog', () => {
    const config = parseInstanceConfig(readFileSync(file, 'utf-8'));
    expect(themes).toContain(config.theme.default);
    if (config.theme.active) {
      expect(themes).toContain(config.theme.active);
    }
    for (const locale of config.i18n.locales) {
      expect(catalogs, `catalog for locale "${locale}"`).toContain(locale);
    }
  });
});

describe('the deployment file is created from the template', () => {
  it.skipIf(!existsSync('oxid-config.yaml'))(
    'has every top-level section of oxid-config.yaml.dist',
    () => {
      const template = Object.keys(parse(readFileSync('oxid-config.yaml.dist', 'utf-8')));
      const deployed = Object.keys(parse(readFileSync('oxid-config.yaml', 'utf-8')));
      expect(deployed).toEqual(expect.arrayContaining(template));
    },
  );
});
