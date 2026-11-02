import {
  AuthService,
  createAuthStore,
  EventBus,
  GraphqlClient,
  PluginRegistry,
  ResponseCache,
  TokenStorage,
  type ResolvedTheme,
} from '@dantweb/oxid-fe-core';
import type { InjectionKey } from 'vue';
import type { InstanceConfig } from './config/schema';
import { createSealedChannel } from './sealing';

interface AppCore {
  client: GraphqlClient;
  auth: AuthService;
  events: EventBus;
  registry: PluginRegistry;
  useAuthStore: ReturnType<typeof createAuthStore>;
}

export const coreKey: InjectionKey<AppCore> = Symbol('oxfe-core');

/** The validated oxid-config.yaml of this instance. */
export const instanceKey: InjectionKey<InstanceConfig> = Symbol('oxfe-instance');

/** The instance's loaded theme (null: running on the component fallbacks). */
export const themeKey: InjectionKey<ResolvedTheme | null> = Symbol('oxfe-theme');

/** Wires the core services. The app always talks same-origin `/graphql/` (dev proxy / nginx). */
export function createCore(graphqlUrl = '/graphql/'): AppCore {
  const client = new GraphqlClient({ url: graphqlUrl, cache: new ResponseCache() });
  const events = new EventBus();
  // SEAL-1: the password, the new passwords, the e-mail and the personal data of the account travel sealed. The shop
  // needs the oe_sealed_channel module; the channel opens on the first sealed call.
  client.setSealing(createSealedChannel(client));
  const auth = new AuthService(client, new TokenStorage(), events, { sealedLogin: true });
  return {
    client,
    auth,
    events,
    registry: new PluginRegistry(),
    useAuthStore: createAuthStore(auth, events),
  };
}
