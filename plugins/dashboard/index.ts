import { CoreEvents, type IPlugin, type PluginContext } from '@dantweb/oxid-fe-core';
import de from './i18n/de.json';
import en from './i18n/en.json';
import { clearSummary } from './state';

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
  version: '0.2.0',
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
      path: '/dashboard/password',
      component: () => import('./views/PasswordView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/newsletter',
      component: () => import('./views/NewsletterView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/wishlist',
      component: () => import('./views/SavedListView.vue'),
      props: { kind: 'noticelist' },
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/gift-registry',
      component: () => import('./views/SavedListView.vue'),
      props: { kind: 'wishlist' },
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/reviews',
      component: () => import('./views/ReviewsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/downloads',
      component: () => import('./views/DownloadsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/delete',
      component: () => import('./views/DeleteAccountView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  navItems: [{ labelKey: 'dashboard.nav', to: '/dashboard', order: 80, requiresAuth: true }],
  messages: { en, de },
  setup(ctx) {
    context = ctx;
    // one customer's numbers must never show for the next one
    ctx.events.on(CoreEvents.AuthLogin, clearSummary);
    ctx.events.on(CoreEvents.AuthLogout, clearSummary);
  },
};

export default plugin;
