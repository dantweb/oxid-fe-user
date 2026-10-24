import { describe, expect, it, vi } from 'vitest';
import { InstanceConfigError, loadInstanceConfig } from '../../src/config/load';
import { parseInstanceConfig } from './helpers/yamlConfig';
import { defaultInstanceConfig } from '../../src/config/schema';

describe('parseInstanceConfig', () => {
  it('fills every default from an empty document', () => {
    const config = parseInstanceConfig('');
    expect(config).toEqual(defaultInstanceConfig());
    expect(config.instance.name).toBe('OXID Storefront');
    expect(config.shop.graphql_url).toBe('/graphql/');
    expect(config.i18n.locales).toEqual(['en', 'de']);
    expect(Object.keys(config.plugins)).toEqual(
      expect.arrayContaining(['shop', 'checkout', 'dashboard', 'payment-stripe']),
    );
  });

  it('reads instance-specific values and merges defaults per plugin entry', () => {
    const config = parseInstanceConfig(`
instance: { id: shop2, name: "Shop Zwei" }
i18n: { default_locale: de, locales: [de] }
plugins:
  shop: { config: { products_per_page: 24 } }
  payment-mollie: { enabled: false }
  promo: { source: external }
`);
    expect(config.instance).toEqual({ id: 'shop2', name: 'Shop Zwei' });
    expect(config.i18n.locales).toEqual(['de']);
    expect(config.plugins.shop).toEqual({
      enabled: true,
      source: 'bundled',
      config: { products_per_page: 24 },
    });
    expect(config.plugins['payment-mollie'].enabled).toBe(false);
    expect(config.plugins.promo.source).toBe('external');
    // plugins listed in the file REPLACE the default set: unlisted ones are not loaded
    expect(config.plugins.checkout).toBeUndefined();
  });

  it('rejects a default_locale that is not offered', () => {
    expect(() => parseInstanceConfig('i18n: { default_locale: fr, locales: [en, de] }')).toThrow(
      /default_locale "fr" must be one of locales/,
    );
  });

  it('rejects wrong types and unknown plugin sources, naming the path', () => {
    expect(() => parseInstanceConfig('plugins: { shop: { enabled: "yes" } }')).toThrow(
      /plugins\.shop\.enabled/,
    );
    expect(() => parseInstanceConfig('plugins: { shop: { source: cdn } }')).toThrow(
      /plugins\.shop\.source/,
    );
    expect(() => parseInstanceConfig('i18n: { locales: [] }')).toThrow(InstanceConfigError);
  });
});

function answer(body: string, init: ResponseInit): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(body, init));
}

describe('loadInstanceConfig', () => {
  it('parses the served oxid-config.json', async () => {
    const config = await loadInstanceConfig(
      answer('{ "instance": { "name": "Shop Eins" } }', {
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(config.instance.name).toBe('Shop Eins');
  });

  it('uses defaults when the file is absent (404, SPA-fallback HTML, network error)', async () => {
    const defaults = defaultInstanceConfig();
    expect(await loadInstanceConfig(answer('nope', { status: 404 }))).toEqual(defaults);
    expect(
      await loadInstanceConfig(
        answer('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
      ),
    ).toEqual(defaults);
    expect(await loadInstanceConfig(vi.fn().mockRejectedValue(new TypeError('offline')))).toEqual(
      defaults,
    );
  });

  it('fails loudly when a present file is invalid', async () => {
    await expect(
      loadInstanceConfig(
        answer('{ "i18n": { "locales": [] } }', {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ).rejects.toBeInstanceOf(InstanceConfigError);
    await expect(
      loadInstanceConfig(answer('not json', { headers: { 'content-type': 'application/json' } })),
    ).rejects.toThrow(/not valid JSON/);
  });

  it('never asks for the YAML', async () => {
    const fetchFn = answer('{}', { headers: { 'content-type': 'application/json' } });
    await loadInstanceConfig(fetchFn);
    expect(vi.mocked(fetchFn).mock.calls[0][0]).toBe('/oxid-config.json');
  });
});

describe('zod jitless', () => {
  it('is switched on by the bootstrap config module: zod 4 compiles code with `new Function`, a CSP violation', async () => {
    const { z } = await import('zod');
    z.config({ jitless: false });
    await import('../../src/zodConfig');

    expect(z.config().jitless).toBe(true);
  });
});
