// External plugin of instance B — loaded at runtime from <instance>/plugins/promo/index.js.
// No imports on purpose: an external module cannot share the app's bundled Vue.
export default {
  name: 'promo',
  version: '1.0.0',
  navItems: [
    {
      labelKey: 'promo.nav',
      to: '/shop/category/8a7ff3dcbc30480b19228b4bf00c8386',
      order: 20,
    },
  ],
  messages: {
    de: { nav: 'Mützen-Angebote' },
    en: { nav: 'Cap deals' },
  },
};
