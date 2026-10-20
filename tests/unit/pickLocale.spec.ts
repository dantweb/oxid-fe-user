import { describe, expect, it } from 'vitest';
import { pickLocale } from '../../src/i18n';

const both = { default_locale: 'en', fallback_locale: 'en', locales: ['en', 'de'] };
const germanOnly = { default_locale: 'de', fallback_locale: 'de', locales: ['de'] };

describe('pickLocale', () => {
  it('prefers the shopper’s saved choice when the instance offers it', () => {
    expect(pickLocale(both, 'en-US', 'de')).toBe('de');
  });

  it('ignores a saved choice the instance does not offer', () => {
    expect(pickLocale(germanOnly, 'en-US', 'en')).toBe('de');
  });

  it('falls back to the browser language, then the instance default', () => {
    expect(pickLocale(both, 'de-AT', null)).toBe('de');
    expect(pickLocale(both, 'fr-FR', null)).toBe('en');
    expect(pickLocale(both, undefined, null)).toBe('en');
  });

  it('a single-language instance always answers in that language', () => {
    expect(pickLocale(germanOnly, 'en-GB', null)).toBe('de');
  });

  it('browser_language: false — the instance default opens first, the browser is ignored', () => {
    const fixed = { ...both, browser_language: false };
    expect(pickLocale(fixed, 'de-AT', null)).toBe('en');
    expect(pickLocale(fixed, 'de-AT', 'de')).toBe('de'); // a saved choice (the dropdown) still wins
  });
});
