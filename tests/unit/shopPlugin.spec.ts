import { PluginRegistry, type PluginContext } from '@dantweb/oxid-fe-core';
import { describe, expect, it } from 'vitest';
import shopPlugin, { useShopContext } from '../../plugins/shop';

describe('shop plugin', () => {
  it('declares its routes, nav items and messages', () => {
    const registry = new PluginRegistry();
    registry.register(shopPlugin);

    expect(registry.routes.map((route) => route.path)).toEqual([
      '/shop',
      '/shop/category/:id',
      '/shop/product/:id',
      '/shop/cart',
      '/search',
    ]);
    expect(registry.navItems.map((item) => item.to)).toEqual(['/shop', '/shop/cart']);
    expect(registry.messagesFor('en')).toHaveProperty('shop.nav.catalog');
    expect(registry.messagesFor('de')).toHaveProperty('shop.nav.cart');
    expect(registry.messagesFor('en')).toHaveProperty('shop.search.placeholder');
    expect(registry.messagesFor('de')).toHaveProperty('shop.search.placeholder');
  });

  it('exposes the plugin context after setup and throws before', async () => {
    const registry = new PluginRegistry();
    registry.register(shopPlugin, { products_per_page: 6 });

    const base = { client: {}, auth: {}, events: {} } as unknown as Omit<PluginContext, 'config'>;
    await registry.setupAll(base);

    const context = useShopContext();
    expect(context.config).toEqual({ products_per_page: 6 });
  });
});
