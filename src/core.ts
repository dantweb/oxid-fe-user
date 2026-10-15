import {
  AuthService,
  createAuthStore,
  EventBus,
  GraphqlClient,
  PluginRegistry,
  TokenStorage,
  type ResolvedTheme,
} from '@dantweb/oxid-fe-core';
import type { InjectionKey } from 'vue';

interface AppCore {
  client: GraphqlClient;
  auth: AuthService;
  events: EventBus;
  registry: PluginRegistry;
  useAuthStore: ReturnType<typeof createAuthStore>;
}

export const coreKey: InjectionKey<AppCore> = Symbol('oxfe-core');

/** The instance's loaded theme (null: running on the component fallbacks). */
export const themeKey: InjectionKey<ResolvedTheme | null> = Symbol('oxfe-theme');

/** Wires the core services. The app always talks same-origin `/graphql/` (dev proxy / nginx). */
export function createCore(graphqlUrl = '/graphql/'): AppCore {
  const client = new GraphqlClient({ url: graphqlUrl });
  const events = new EventBus();
  const auth = new AuthService(client, new TokenStorage(), events);
  return {
    client,
    auth,
    events,
    registry: new PluginRegistry(),
    useAuthStore: createAuthStore(auth, events),
  };
}
