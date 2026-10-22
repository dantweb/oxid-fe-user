import { GraphqlError } from '@dantweb/oxid-fe-core';
import { describe, expect, it } from 'vitest';
import { errorMessageKey } from '../../src/errors/useErrorMessage';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';

const KNOWN = [
  'basket_not_found',
  'payment_not_supported',
  'terms_not_confirmed',
  'return_url_rejected',
  'provider_failed',
  'contract_not_found',
  'invalid_token',
  'invalid_login',
  'account_exists',
  'guest_details_required',
  'network_error',
  'http_error',
];
const catalogKeys = (catalog: Record<string, unknown>): Set<string> => {
  const errors = catalog.errors as Record<string, unknown>;
  const keys = Object.entries(errors).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [`errors.${key}`]
      : Object.keys(value as object).map((inner) => `errors.${key}.${inner}`),
  );
  return new Set(keys);
};
const has = (key: string): boolean => catalogKeys(en).has(key);
const shopError = (code: string, providerCode?: string) =>
  new GraphqlError('raw text', code, [
    { message: 'raw text', extensions: { errorCode: code, providerCode } },
  ]);

describe('errors.<code> catalog', () => {
  it.each(['en', 'de'] as const)(
    '%s has a text for every known code, the generic one and the provider codes',
    (locale) => {
      const keys = catalogKeys(locale === 'en' ? en : de);
      for (const code of KNOWN) {
        expect(keys.has(`errors.${code}`), code).toBe(true);
      }
      expect(keys.has('errors.generic')).toBe(true);
      expect(keys).toEqual(catalogKeys(locale === 'en' ? de : en));
    },
  );
});

describe('errorMessageKey', () => {
  it.each(KNOWN)('maps the known code %s to its own text', (code) => {
    expect(errorMessageKey(shopError(code), has)).toBe(`errors.${code}`);
  });

  it('maps an unknown code to the generic text', () => {
    expect(errorMessageKey(shopError('brand_new_code'), has)).toBe('errors.generic');
  });

  it('maps anything that is not a GraphqlError to the generic text', () => {
    expect(errorMessageKey(new Error('boom'), has)).toBe('errors.generic');
    expect(errorMessageKey('boom', has)).toBe('errors.generic');
    expect(errorMessageKey(undefined, has)).toBe('errors.generic');
  });

  it('prefers the provider code (a card decline) over provider_failed', () => {
    expect(errorMessageKey(shopError('provider_failed', 'card_declined'), has)).toBe(
      'errors.provider.card_declined',
    );
  });

  it('falls back to the code text when the provider code has none', () => {
    expect(errorMessageKey(shopError('provider_failed', 'odd_code'), has)).toBe(
      'errors.provider_failed',
    );
  });

  it('uses the view fallback for an unknown code, never the raw message', () => {
    const key = errorMessageKey(
      shopError('brand_new_code'),
      (k) => k === 'login.failed',
      'login.failed',
    );
    expect(key).toBe('login.failed');
  });

  it('a known code still beats the view fallback', () => {
    expect(
      errorMessageKey(
        shopError('invalid_login'),
        (k) => has(k) || k === 'login.failed',
        'login.failed',
      ),
    ).toBe('errors.invalid_login');
  });
});
