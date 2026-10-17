import { describe, expect, it } from 'vitest';
import { activeLocale, createAppI18n } from '../../src/i18n';
import { PluginRegistry } from '@dantweb/oxid-fe-core';
import { parseInstanceConfig } from './helpers/yamlConfig';

const i18nFor = (yaml: string) => createAppI18n(new PluginRegistry(), parseInstanceConfig(yaml));

describe('activeLocale — what the shop is told (Accept-Language)', () => {
  it('is the instance’s only language, whatever the browser says', () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });

    expect(
      activeLocale(i18nFor('i18n: { default_locale: de, fallback_locale: de, locales: [de] }')),
    ).toBe('de');
  });

  it('follows a language switch', () => {
    const i18n = i18nFor('i18n: { default_locale: en, fallback_locale: en, locales: [en, de] }');
    (i18n.global.locale as unknown as { value: string }).value = 'de';

    expect(activeLocale(i18n)).toBe('de');
  });
});
