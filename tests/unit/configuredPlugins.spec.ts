import type { IPlugin } from '@dantweb/oxid-fe-core';
import { describe, expect, it, vi } from 'vitest';
import { loadConfiguredPlugins } from '../../src/config/plugins';
import { parseInstanceConfig } from '../../src/config/load';

const plugin = (name: string): IPlugin => ({ name, version: '1' });
const bundled = {
  shop: async () => ({ default: plugin('shop') }),
  checkout: async () => ({ default: plugin('checkout') }),
};

describe('loadConfiguredPlugins', () => {
  it('loads enabled bundled plugins with their config and skips disabled ones', async () => {
    const config = parseInstanceConfig(`
plugins:
  shop: { config: { products_per_page: 6 } }
  checkout: { enabled: false }
`);
    const loaded = await loadConfiguredPlugins(config, bundled, vi.fn());

    expect(loaded.map((entry) => entry.plugin.name)).toEqual(['shop']);
    expect(loaded[0].config).toEqual({ products_per_page: 6 });
  });

  it('loads external plugins from the instance plugins folder', async () => {
    const config = parseInstanceConfig('plugins: { promo: { source: external } }');
    const importExternal = vi.fn().mockResolvedValue({ default: plugin('promo') });

    const loaded = await loadConfiguredPlugins(config, bundled, importExternal);

    expect(importExternal).toHaveBeenCalledWith('/plugins/promo/index.js');
    expect(loaded.map((entry) => entry.plugin.name)).toEqual(['promo']);
  });

  it('fails when an enabled bundled plugin is not in this build', async () => {
    const config = parseInstanceConfig('plugins: { ghost: {} }');
    await expect(loadConfiguredPlugins(config, bundled, vi.fn())).rejects.toThrow(
      /bundled plugin "ghost"/,
    );
  });
});
