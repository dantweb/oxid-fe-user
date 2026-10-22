import { describe, expect, it } from 'vitest';
import { endpointParamsFor, languageIdFor } from '../../src/i18n';
import { parseInstanceConfig } from './helpers/yamlConfig';

const shopOf = (yaml: string) => parseInstanceConfig(yaml).shop;

describe('shop.language_ids / shop.id — schema', () => {
  it('defaults to the demo shop ids: de → 0, en → 1, no subshop', () => {
    const shop = shopOf('');
    expect(shop.language_ids).toEqual({ de: 0, en: 1 });
    expect(shop.id).toBeUndefined();
  });

  it('accepts an own map and a subshop id', () => {
    const shop = shopOf('shop: { id: 2, language_ids: { de: 1, en: 0, fr: 2 } }');
    expect(shop.language_ids).toEqual({ de: 1, en: 0, fr: 2 });
    expect(shop.id).toBe(2);
  });

  it.each([
    ['a negative id', 'shop: { language_ids: { de: -1 } }'],
    ['a non-integer id', 'shop: { language_ids: { de: 0.5 } }'],
    ['a string id', 'shop: { language_ids: { de: "zero" } }'],
    ['a list instead of a map', 'shop: { language_ids: [0, 1] }'],
    ['a subshop id of 0', 'shop: { id: 0 }'],
  ])('rejects %s', (_label, yaml) => {
    expect(() => shopOf(yaml)).toThrow(/invalid/);
  });
});

describe('languageIdFor — the locale → shop language id mapping', () => {
  const shop = shopOf('');

  it('maps the configured locales', () => {
    expect(languageIdFor(shop, 'de')).toBe(0);
    expect(languageIdFor(shop, 'en')).toBe(1);
  });

  it('gives undefined for an unmapped locale instead of throwing', () => {
    expect(languageIdFor(shop, 'fr')).toBeUndefined();
  });

  it('does not mistake inherited object keys for a mapping', () => {
    expect(languageIdFor(shop, 'constructor')).toBeUndefined();
  });
});

describe('endpointParamsFor — what the client appends to the endpoint', () => {
  it('carries lang and shp when both are known', () => {
    const shop = shopOf('shop: { id: 2 }');
    expect(endpointParamsFor(shop, 'de')).toEqual({ lang: 0, shp: 2 });
  });

  it('omits what is unknown (no throw)', () => {
    expect(endpointParamsFor(shopOf(''), 'fr')).toEqual({});
  });
});
