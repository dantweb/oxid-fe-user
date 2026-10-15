import type { IPlugin, PluginContext } from '@dantweb/oxid-fe-core';
import de from './i18n/de.json';
import en from './i18n/en.json';

let context: PluginContext | null = null;

export function useDashboardContext(): PluginContext {
  if (!context) {
    throw new Error('dashboard plugin is not set up');
  }
  return context;
}

/**
 * The account area: pure SPA by design — never prerendered, noindex on every
 * route (sprint 05; robots.txt disallows /dashboard).
 */
const plugin: IPlugin = {
  name: 'dashboard',
  version: '0.1.0',
  routes: [
    {
      path: '/dashboard',
      component: () => import('./views/DashboardHome.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/orders',
      component: () => import('./views/OrdersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/orders/:id',
      component: () => import('./views/OrderDetailView.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/addresses',
      component: () => import('./views/AddressesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/profile',
      component: () => import('./views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  navItems: [{ labelKey: 'dashboard.nav', to: '/dashboard', order: 80, requiresAuth: true }],
  messages: { en, de },
  setup(ctx) {
    context = ctx;
  },
};

export default plugin;
