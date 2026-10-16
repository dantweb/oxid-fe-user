import { describe, expect, it } from 'vitest';
import { parseInstanceConfig } from './helpers/yamlConfig';
import { resolveActiveTheme } from '../../src/config/theme';

describe('resolveActiveTheme', () => {
  it('an explicit theme.active always wins, even over a plugin’s default theme', () => {
    const { theme } = parseInstanceConfig('theme: { default: default, active: dark }');
    expect(resolveActiveTheme(theme, 'peroxid')).toBe('dark');
  });

  it('without an explicit theme, a plugin’s default theme applies', () => {
    const { theme } = parseInstanceConfig('theme: { default: default }');
    expect(resolveActiveTheme(theme, 'peroxid')).toBe('peroxid');
  });

  it('without either, the instance’s default theme applies', () => {
    expect(resolveActiveTheme(parseInstanceConfig('').theme, null)).toBe('default');
    expect(resolveActiveTheme(parseInstanceConfig('theme: { default: calm }').theme, null)).toBe(
      'calm',
    );
  });
});
