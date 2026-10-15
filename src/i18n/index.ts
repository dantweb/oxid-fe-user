import type { PluginRegistry } from '@dantweb/oxid-fe-core';
import { createI18n, type I18n, type LocaleMessageDictionary, type VueMessageType } from 'vue-i18n';
import type { InstanceConfig } from '../config/schema';
import de from './de.json';
import en from './en.json';

/** Message catalogs shipped with the app; an instance may offer any subset of these locales. */
const CATALOGS: Record<string, Record<string, unknown>> = { en, de };

export const LOCALE_STORAGE_KEY = 'oxfe_locale';

type I18nConfig = InstanceConfig['i18n'];

/**
 * Initial language: the shopper's saved choice, else the browser language, else the instance
 * default — each only if the instance actually offers it.
 */
export function pickLocale(
  config: I18nConfig,
  browserLanguage: string | undefined,
  savedLocale: string | null,
): string {
  const offered = new Set(config.locales);
  if (savedLocale && offered.has(savedLocale)) {
    return savedLocale;
  }
  const browser = browserLanguage?.toLowerCase().split('-')[0];
  if (browser && offered.has(browser)) {
    return browser;
  }
  return config.default_locale;
}

function savedLocale(): string | null {
  try {
    return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function createAppI18n(registry: PluginRegistry, config: InstanceConfig): I18n {
  const i18n = createI18n({
    legacy: false,
    locale: pickLocale(
      config.i18n,
      typeof navigator === 'undefined' ? undefined : navigator.language,
      savedLocale(),
    ),
    fallbackLocale: config.i18n.fallback_locale,
    messages: {},
  });

  for (const locale of config.i18n.locales) {
    const catalog = CATALOGS[locale] ?? {};
    const dictionary = {
      ...catalog,
      // the instance's shop name is `app.title` in every language
      app: { ...(catalog.app as Record<string, unknown> | undefined), title: config.instance.name },
      ...registry.messagesFor(locale),
    };
    // JSON catalogs and plugin messages are untyped at compile time
    i18n.global.setLocaleMessage(
      locale,
      dictionary as unknown as LocaleMessageDictionary<VueMessageType>,
    );
  }
  return i18n;
}
