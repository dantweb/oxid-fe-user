import { PluginRegistry, type PluginContext } from '@dantweb/oxid-fe-core';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import peroxid, { useStreams } from '../../plugins/peroxid';
import {
  DEFAULT_STREAMS,
  parseStreams,
  SEARCH_QUERY,
  streamRequest,
} from '../../plugins/peroxid/streams';
import shop from '../../plugins/shop';
import { useCartStore } from '../../plugins/shop/stores/cart';

describe('peroxid streams', () => {
  it('ships the three streams: new, today’s sales, electronics', () => {
    expect(DEFAULT_STREAMS.map((stream) => [stream.id, stream.type, stream.ref])).toEqual([
      ['new', 'action', 'oxnewest'],
      ['sales', 'action', 'oxbargain'],
      ['electronic', 'category', '91c959d1be6af96041072032ead2daf0'],
    ]);
  });

  it('validates a configured list and fills the limit', () => {
    const [stream] = parseStreams([{ id: 'x', type: 'category', ref: 'abc' }]);
    expect(stream).toEqual({ id: 'x', type: 'category', ref: 'abc', limit: 10 });
  });

  it('fails loudly on a bad configuration, naming the path', () => {
    expect(() => parseStreams([{ id: 'x', type: 'banner', ref: 'a' }])).toThrow(
      /invalid streams configuration.*0\.type/,
    );
    expect(() => parseStreams([])).toThrow(/invalid streams configuration/);
    expect(() => parseStreams('nope')).toThrow(/invalid streams configuration/);
  });

  it('builds an action request that reads the action’s products, capped at the limit', () => {
    const request = streamRequest({ id: 'new', type: 'action', ref: 'oxnewest', limit: 2 });

    expect(request.document).toContain('action(actionId: $id)');
    expect(request.variables).toEqual({ id: 'oxnewest' });
    const products = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(request.pick({ action: { products } })).toEqual([{ id: '1' }, { id: '2' }]);
    expect(request.pick({ action: null })).toEqual([]);
  });

  it('builds a category request filtered by category id with pagination', () => {
    const request = streamRequest({ id: 'e', type: 'category', ref: 'cat-1', limit: 6 });

    expect(request.document).toContain('filter: { category: { equals: $id } }');
    expect(request.variables).toEqual({ id: 'cat-1', limit: 6 });
    expect(request.pick({ products: [{ id: 'p' }] })).toEqual([{ id: 'p' }]);
    expect(request.pick({})).toEqual([]);
  });

  it('searches product titles with the typed variables the storefront expects', () => {
    expect(SEARCH_QUERY).toContain('$q: String!');
    expect(SEARCH_QUERY).toContain('filter: { title: { contains: $q } }');
  });
});

describe('peroxid plugin contract', () => {
  it('is a layout plugin: overrides header, footer and home; requires shop; brings its theme', () => {
    expect(Object.keys(peroxid.overrides ?? {}).sort()).toEqual(['footer', 'header', 'home']);
    expect(peroxid.requires).toEqual(['shop']);
    expect(peroxid.defaultTheme).toBe('peroxid');
    expect(peroxid.routes?.map((route) => route.path)).toEqual(['/search']);
  });

  it('takes over the host slots once registered, and the host keeps its defaults without it', () => {
    const without = new PluginRegistry();
    without.register(shop);
    expect(without.overrideFor('header')).toBeNull();
    expect(without.overrideFor('home')).toBeNull();
    expect(without.defaultTheme()).toBeNull();

    const registry = new PluginRegistry();
    registry.register(shop);
    registry.register(peroxid);
    expect(registry.overrideFor('header')).toBe(peroxid.overrides?.header);
    expect(registry.overrideFor('footer')).toBe(peroxid.overrides?.footer);
    expect(registry.overrideFor('home')).toBe(peroxid.overrides?.home);
    expect(registry.defaultTheme()).toBe('peroxid');
  });

  it('refuses to start without the shop plugin it builds on', async () => {
    const registry = new PluginRegistry();
    registry.register(peroxid);
    const base = { client: {}, auth: {}, events: {}, registry } as unknown as Omit<
      PluginContext,
      'config'
    >;

    await expect(registry.setupAll(base)).rejects.toThrow(
      'plugin "peroxid" requires "shop", which is not enabled',
    );
  });

  it('reads its streams from the instance config at setup', async () => {
    const registry = new PluginRegistry();
    registry.register(shop);
    registry.register(peroxid, { streams: [{ id: 'only', type: 'action', ref: 'oxtop5' }] });
    const base = { client: {}, auth: {}, events: {}, registry } as unknown as Omit<
      PluginContext,
      'config'
    >;

    await registry.setupAll(base);

    expect(useStreams().map((stream) => stream.id)).toEqual(['only']);
  });
});

describe('cart SKU count (the header badge)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  const item = (productId: string) => ({
    productId,
    title: productId,
    price: 10,
    currencyName: 'EUR',
  });

  it('counts distinct products, not units', () => {
    const cart = useCartStore();
    cart.addItem(item('a'), 3);
    cart.addItem(item('b'));
    cart.addItem(item('a')); // same SKU again: one more unit, still one SKU

    expect(cart.skuCount).toBe(2);
    expect(cart.itemCount).toBe(5);
  });

  it('is zero for an empty cart and drops when a product is removed', () => {
    const cart = useCartStore();
    expect(cart.skuCount).toBe(0);

    cart.addItem(item('a'));
    cart.addItem(item('b'));
    cart.removeItem('a');
    expect(cart.skuCount).toBe(1);
  });
});
