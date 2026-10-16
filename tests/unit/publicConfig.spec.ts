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
    config: { mode: iframe, publishable_key: pk_test_abc }
`);
    expect(out).toEqual({
      instance: { id: 'a', name: 'Shop' },
      shop: { graphql_url: '/graphql/' },
      i18n: { default_locale: 'en', locales: ['en', 'de'] },
      theme: { default: 'default', active: 'dark' },
      plugins: {
        shop: { config: { products_per_page: 8 } },
        'payment-stripe': { config: { mode: 'iframe', publishable_key: 'pk_test_abc' } },
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

  it('accepts the public provider keys (publishable key, client id, profile id)', () => {
    expect(() =>
      renderPublicConfig(`
plugins:
  a: { config: { publishable_key: pk_live_x, client_id: abc, profile_id: pfl_x } }`),
    ).not.toThrow();
  });

  it('broken YAML is an error, not a silent empty config', () => {
    expect(() => renderPublicConfig('instance: [unclosed')).toThrow();
  });

  it('an empty or comment-only file renders an empty object', () => {
    expect(render('# nothing\n')).toEqual({});
  });
});
