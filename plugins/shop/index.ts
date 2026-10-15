import type { IPlugin, PluginContext } from '@dantweb/oxid-fe-core';
import de from './i18n/de.json';
import en from './i18n/en.json';

let context: PluginContext | null = null;

/** Views reach the GraphQL client and the plugin config through this, not through the host. */
export function useShopContext(): PluginContext {
  if (!context) {
    throw new Error('shop plugin is not set up');
  }
  return context;
}

const plugin: IPlugin = {
  name: 'shop',
  version: '0.1.0',
  routes: [
    { path: '/shop', component: () => import('./views/ProductCatalog.vue') },
    {
      path: '/shop/category/:id',
      component: () => import('./views/CategoryView.vue'),
      props: true,
    },
    {
      path: '/shop/product/:id',
      component: () => import('./views/ProductDetail.vue'),
      props: true,
    },
    { path: '/shop/cart', component: () => import('./views/CartView.vue') },
  ],
  navItems: [
    { labelKey: 'shop.nav.catalog', to: '/shop', order: 10 },
    { labelKey: 'shop.nav.cart', to: '/shop/cart', order: 90 },
  ],
  messages: { en, de },
  defaultConfig: { products_per_page: 12 },
  setup(ctx) {
    context = ctx;
  },
};

export default plugin;
