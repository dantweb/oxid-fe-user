import type { IPlugin } from '@dantweb/oxid-fe-core';
import { createHead } from '@unhead/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import pluginState from '../plugins.json';
import App from './App.vue';
import { coreKey, createCore } from './core';
import { createAppI18n } from './i18n';
import { createAppRouter } from './router';

/** Plugins compiled into this app; `plugins.json` decides which ones load. */
const availablePlugins: Record<string, () => Promise<{ default: IPlugin }>> = {
  shop: () => import('../plugins/shop'),
  checkout: () => import('../plugins/checkout'),
  'payment-paypal': () => import('../plugins/payment-paypal'),
  'payment-stripe': () => import('../plugins/payment-stripe'),
  'payment-mollie': () => import('../plugins/payment-mollie'),
  dashboard: () => import('../plugins/dashboard'),
};

interface PluginState {
  enabled: boolean;
  config?: Record<string, unknown>;
}

async function bootstrap(): Promise<void> {
  const core = createCore();

  for (const [name, state] of Object.entries(pluginState as Record<string, PluginState>)) {
    const loader = availablePlugins[name];
    if (!state.enabled || !loader) {
      continue;
    }
    const { default: plugin } = await loader();
    core.registry.register(plugin, state.config ?? {});
  }
  await core.registry.setupAll({
    client: core.client,
    auth: core.auth,
    events: core.events,
    registry: core.registry,
  });

  const app = createApp(App);
  app.use(createPinia());
  app.use(createHead());
  app.provide(coreKey, core);
  app.use(createAppI18n(core.registry));
  app.use(createAppRouter(core.registry, core.auth));
  app.mount('#app');

  // Guest session (anonymous token) for basket work later; browsing works without it.
  void core.auth.ensureSession().catch(() => undefined);
}

void bootstrap();
