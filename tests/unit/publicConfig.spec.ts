import { describe, expect, it } from 'vitest';
import { renderPublicConfig } from '../../scripts/public-config.mjs';

const render = (yaml: string) => JSON.parse(renderPublicConfig(yaml));

describe('renderPublicConfig — the only config the browser ever gets', () => {
  it('keeps the public sections of a normal instance', () => {
    const out = render(`
instance: { id: a, name: Shop }
shop: { graphql_url: /graphql/ }
i18n: { default_locale: en, locales: [en, de] }
theme: { default: default, active: dark }
plugins:
  shop: { config: { products_per_page: 8 } }
  payment-stripe:
    config: { mode: iframe }
`);
    expect(out).toEqual({
      instance: { id: 'a', name: 'Shop' },
      shop: { graphql_url: '/graphql/' },
      i18n: { default_locale: 'en', locales: ['en', 'de'] },
      theme: { default: 'default', active: 'dark' },
      plugins: {
        shop: { config: { products_per_page: 8 } },
        'payment-stripe': { config: { mode: 'iframe' } },
      },
    });
  });

  it('drops everything outside the allow-list: unknown sections and unknown plugin fields', () => {
    const out = render(`
deploy: { host: pay1.example, ssh_user: root }
shop: { graphql_url: /graphql/, admin_note: internal }
plugins:
  shop: { enabled: true, notes: internal, config: {} }
`);
    expect(out).not.toHaveProperty('deploy');
    expect(out.shop).toEqual({ graphql_url: '/graphql/' });
    expect(out.plugins.shop).toEqual({ enabled: true, config: {} });
  });

  it.each([
    ['a secret-looking key', 'plugins: { x: { config: { client_secret: abc } } }', 'client_secret'],
    ['a password key', 'plugins: { x: { config: { nested: { password: abc } } } }', 'password'],
    ['an api key', 'plugins: { x: { config: { api_key: abc } } }', 'api_key'],
    ['a token', 'plugins: { x: { config: { access_token: abc } } }', 'access_token'],
    ['a Stripe secret key value', 'plugins: { x: { config: { key: sk_test_51Abc } } }', 'sk_test_'],
    ['a webhook secret value', 'plugins: { x: { config: { k: whsec_abcdef } } }', 'whsec_'],
    ['a GitHub token value', 'plugins: { x: { config: { k: ghp_abcdef } } }', 'ghp_'],
    [
      'credentials in the GraphQL url',
      'shop: { graphql_url: "https://u:p@shop/graphql/" }',
      'credentials',
    ],
  ])('refuses %s — and names the offending path', (_label, yaml, needle) => {
    expect(() => renderPublicConfig(yaml)).toThrow(new RegExp(needle));
  });

  it.each([
    [
      'a Stripe publishable key',
      'payment-stripe: { config: { publishable_key: pk_test_abc } }',
      'publishable_key',
    ],
    ['a PayPal client id', 'payment-paypal: { config: { client_id: abc } }', 'client_id'],
    ['a Mollie profile id', 'payment-mollie: { config: { profile_id: pfl_x } }', 'profile_id'],
    [
      'any other key-named field of a payment plugin',
      'payment-x: { config: { merchantKey: abc } }',
      'merchantKey',
    ],
    ['a nested key field', 'payment-x: { config: { sdk: { client_id: abc } } }', 'sdk.client_id'],
  ])('refuses %s in a payment plugin — keys come from the shop', (_label, plugin, needle) => {
    expect(() => renderPublicConfig(`plugins:\n  ${plugin}`)).toThrow(
      new RegExp(`${needle.replace('.', '\\.')}[^]*payments-keys\\.md`),
    );
  });

  it('keeps the behaviour options of a payment plugin', () => {
    const out = render(`
plugins:
  payment-paypal: { config: { mode: iframe, currency: EUR, intent: capture } }
  payment-mollie: { config: { test_mode: true, methods: [creditcard, ideal], locale: de_DE } }`);

    expect(out.plugins['payment-paypal'].config).toEqual({
      mode: 'iframe',
      currency: 'EUR',
      intent: 'capture',
    });
    expect(out.plugins['payment-mollie'].config).toMatchObject({ test_mode: true });
  });

  it('a plugin that is not a payment plugin may use a field called client_id', () => {
    expect(() =>
      renderPublicConfig('plugins: { analytics: { config: { client_id: abc } } }'),
    ).not.toThrow();
  });

  it('broken YAML is an error, not a silent empty config', () => {
    expect(() => renderPublicConfig('instance: [unclosed')).toThrow();
  });

  it('an empty or comment-only file renders an empty object', () => {
    expect(render('# nothing\n')).toEqual({});
  });
});
