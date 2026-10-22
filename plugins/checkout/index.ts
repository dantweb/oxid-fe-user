import { CoreEvents, type IPlugin, type PluginContext } from '@dantweb/oxid-fe-core';
import de from './i18n/de.json';
import en from './i18n/en.json';
import { useCheckoutStore } from './stores/checkout';

let context: PluginContext | null = null;

export function useCheckoutContext(): PluginContext {
  if (!context) {
    throw new Error('checkout plugin is not set up');
  }
  return context;
}

const plugin: IPlugin = {
  name: 'checkout',
  version: '0.1.0',
  routes: [
    {
      path: '/checkout',
      component: () => import('./views/CheckoutView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/checkout/return/:provider',
      component: () => import('./views/ReturnView.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/checkout/cancel/:provider',
      component: () => import('./views/CancelView.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
  ],
  messages: { en, de },
  setup(ctx) {
    context = ctx;
    // the attempt carries the contract token: it never outlives the session it belongs to (138e E3)
    ctx.events.on(CoreEvents.AuthLogout, () => useCheckoutStore().clear());
  },
};

export default plugin;
