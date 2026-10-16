# Plugin contract (`IPlugin`)

A plugin is a directory under `plugins/<name>/` whose `index.ts` default-exports an `IPlugin`
(from `@dantweb/oxid-fe-core`), modelled on the vbwd-fe-user plugin anatomy.

```ts
const plugin: IPlugin = {
  name: 'shop',                 // unique; also the i18n namespace
  version: '0.1.0',
  routes: [...],                // vue-router RouteRecordRaw[]; meta.requiresAuth honored by the host guard
  navItems: [                   // rendered by the host header, sorted by order
    { labelKey: 'shop.nav.catalog', to: '/shop', order: 10 },
  ],
  messages: { en, de },         // merged into host i18n under the plugin name
  defaultConfig: { products_per_page: 12 },
  setup(ctx) {                  // ctx: { client, auth, events, config }
    /* keep the context, register event handlers */
  },
};
export default plugin;
```

## Rules

1. **Views never import from the host (`src/`).** They reach the GraphQL client, auth, events
   and config through the context the plugin kept in `setup()` (see `useShopContext()` in the
   shop plugin) — plugins stay host-independent.
2. **Enablement and overrides** live in the instance's `oxid-config.yaml` (`plugins:` section,
   see `instance-configuration.md`): `enabled`, `source` (`bundled` plugins are in the compiled
   `bundledPlugins` map in `src/main.ts`; `external` ones are loaded from the instance's
   `plugins/<name>/index.js`) and `config` merged over the plugin's `defaultConfig`.
3. **i18n keys** are namespaced by plugin name: `t('shop.cart.headline')`.
4. **Stores** are ordinary Pinia stores inside the plugin (`useCartStore`); the host provides
   the Pinia instance.
5. **Layout plugins** may also `overrides` host views (header, footer, front page), declare
   `requires` (plugins that must be enabled) and a `defaultTheme` — see `layout-plugins.md`.
6. **Versioning**: a plugin names the core version range it needs in its repo/package; breaking
   changes to `IPlugin` bump core's major.

## Payment plugins (sprint 04 preview)

Payment providers implement a `PaymentPlugin` extension of this contract (interface lands in
core with sprint 04): `paymentId` (OXID id, e.g. `oe_payments_paypal`), `start()` mapping to the
provider's `<provider>CheckoutStart` mutation, return/cancel route components, and an optional
embedded-mode component (`clientSecret`).
