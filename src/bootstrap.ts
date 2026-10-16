import '@dantweb/oxid-fe-core/styles/variables.css';
import '@dantweb/oxid-fe-core/styles/components.css';
import { loadTheme, type IPlugin } from '@dantweb/oxid-fe-core';
import { createHead } from '@unhead/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { loadInstanceConfig } from './config/load';
import { loadConfiguredPlugins } from './config/plugins';
import { resolveActiveTheme } from './config/theme';
import { coreKey, createCore, instanceKey, themeKey } from './core';
import { createAppI18n } from './i18n';
import { createAppRouter } from './router';

/** Plugins compiled into this app; the instance's oxid-config.yaml decides which ones load. */
export const bundledPlugins: Record<string, () => Promise<{ default: IPlugin }>> = {
  shop: () => import('../plugins/shop'),
  checkout: () => import('../plugins/checkout'),
  'payment-paypal': () => import('../plugins/payment-paypal'),
  'payment-stripe': () => import('../plugins/payment-stripe'),
  'payment-mollie': () => import('../plugins/payment-mollie'),
  dashboard: () => import('../plugins/dashboard'),
  peroxid: () => import('../plugins/peroxid'),
};

export interface StartStorefrontOptions {
  /**
   * A project's own plugins. A plugin with the name of a bundled one REPLACES it (override); any
   * other name is added. The instance's `oxid-config.yaml` still decides which ones run.
   */
  plugins?: Record<string, () => Promise<{ default: IPlugin }>>;
}

async function bootstrap(options: StartStorefrontOptions): Promise<void> {
  const config = await loadInstanceConfig();
  const core = createCore(config.shop.graphql_url);

  const plugins = await loadConfiguredPlugins(
    config,
    { ...bundledPlugins, ...options.plugins },
    (path) => import(/* @vite-ignore */ path),
  );
  for (const { plugin, config: pluginConfig } of plugins) {
    core.registry.register(plugin, pluginConfig);
  }

  // explicit theme.active > a plugin's defaultTheme > theme.default; the theme loads while the plugins set up
  const [theme] = await Promise.all([
    loadTheme({
      active: resolveActiveTheme(config.theme, core.registry.defaultTheme()),
      fallback: config.theme.default,
    }),
    core.registry.setupAll({
      client: core.client,
      auth: core.auth,
      events: core.events,
      registry: core.registry,
    }),
  ]);

  const app = createApp(App);
  app.use(createPinia());
  app.use(createHead());
  app.provide(coreKey, core);
  app.provide(themeKey, theme);
  app.provide(instanceKey, config);
  app.use(createAppI18n(core.registry, config));
  app.use(createAppRouter(core.registry, core.auth));
  app.mount('#app');

  // Guest session (anonymous token) for basket work later; browsing works without it.
  void core.auth.ensureSession().catch(() => undefined);
}

/** A broken instance configuration must be visible, not a blank page. */
function showBootError(error: unknown): void {
  const root = document.getElementById('app');
  if (!root) {
    return;
  }
  const box = document.createElement('pre');
  box.setAttribute('role', 'alert');
  box.setAttribute('data-testid', 'boot-error');
  box.style.cssText =
    'margin:24px;padding:16px;background:#fdecea;color:#611a15;white-space:pre-wrap';
  box.textContent = `Storefront could not start.\n\n${error instanceof Error ? error.message : String(error)}`;
  root.replaceChildren(box);
}

/**
 * Starts the storefront in `#app`. `src/main.ts` calls it bare; a project built on this package
 * (see docs/project-layer.md) calls it with its own plugins.
 */
export function startStorefront(options: StartStorefrontOptions = {}): void {
  bootstrap(options).catch(showBootError);
}
