import { EventBus, GraphqlError, PluginRegistry, type PluginContext } from '@dantweb/oxid-fe-core';
import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';
import { createApp, nextTick, type Component } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { coreKey, instanceKey } from '../../../src/core';
import { defaultInstanceConfig } from '../../../src/config/schema';
import { createAppI18n } from '../../../src/i18n';

/** What the shop says in its own words — must never reach the shopper. */
export const RAW_SHOP_MESSAGE = 'Leaked shop text from https://internal.example/secret-path';

export const failure = (errorCode = 'something_new'): GraphqlError =>
  new GraphqlError(RAW_SHOP_MESSAGE, errorCode, [
    { message: RAW_SHOP_MESSAGE, extensions: { errorCode } },
  ]);

export type Handler = (query: string, variables?: Record<string, unknown>) => unknown;

interface MountOptions {
  /** answers a GraphQL operation; throw to fail it. Default: every operation fails. */
  handler?: Handler;
  props?: Record<string, unknown>;
  route?: string;
  debugErrors?: boolean;
  /** extra plugin messages (the view's own i18n group) */
  registry?: PluginRegistry;
  /** called with the context the plugin under test gets in setup() */
  setup?: (context: PluginContext) => void;
  auth?: Record<string, unknown>;
  login?: () => Promise<void>;
}

/** Mounts one view in a real app shell (i18n, router, pinia, head) with a scripted GraphQL client. */
export async function mountView(component: Component, options: MountOptions = {}) {
  const handler =
    options.handler ??
    (() => {
      throw failure();
    });
  const client = {
    execute: async (query: string, variables?: Record<string, unknown>) =>
      handler(query, variables),
  };
  const auth = { logout: () => Promise.resolve(), adoptToken: () => undefined, ...options.auth };
  const registry = options.registry ?? new PluginRegistry();
  const config = defaultInstanceConfig();
  if (options.debugErrors) {
    config.debug.errors = true;
  }
  const events = new EventBus();
  const context = { client, auth, registry, events } as unknown as PluginContext;
  options.setup?.(context);

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  });
  await router.push(options.route ?? '/');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = createApp(component, options.props ?? {});
  app.use(createPinia());
  app.use(createHead());
  app.use(router);
  app.use(createAppI18n(registry, config));
  app.provide(instanceKey, config);
  app.provide(coreKey, {
    client,
    auth,
    registry,
    events,
    useAuthStore: () => ({
      login: options.login ?? (() => Promise.reject(failure('invalid_login'))),
    }),
  } as never);
  app.mount(host);
  await settle();
  return { host, settle, unmount: () => app.unmount(), client };
}

/** Lets pending promises and renders finish; microtasks only, so fake timers stay in the test's hands. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await nextTick();
  }
}

export function setValue(host: HTMLElement, selector: string, value: string): void {
  const input = host.querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`no ${selector}`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export async function submit(host: HTMLElement, selector: string): Promise<void> {
  host
    .querySelector<HTMLFormElement>(selector)
    ?.dispatchEvent(new Event('submit', { cancelable: true }));
  await settle();
}
