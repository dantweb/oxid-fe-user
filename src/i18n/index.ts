import { LOCALE_STORAGE_KEY, type PluginRegistry } from '@dantweb/oxid-fe-core';
import { unref } from 'vue';
import { createI18n, type I18n, type LocaleMessageDictionary, type VueMessageType } from 'vue-i18n';
import type { InstanceConfig } from '../config/schema';
import de from './de.json';
import en from './en.json';

/** Message catalogs shipped with the app; an instance may offer any subset of these locales. */
const CATALOGS: Record<string, Record<string, unknown>> = { en, de };

type I18nConfig = InstanceConfig['i18n'];

/**
 * Initial language: the shopper's saved choice, else the browser language (unless the instance
 * sets `browser_language: false`), else the instance default — each only if the instance offers it.
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
  // absent (plain objects in tests) counts as true, the schema's default
  const browser =
    config.browser_language === false ? undefined : browserLanguage?.toLowerCase().split('-')[0];
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

/**
 * The active locale as the shop's language code. Sent with every GraphQL call (`Accept-Language`):
 * OXID answers products, categories and messages in that language — so a German instance shows
 * German shop content whatever the visitor's browser is set to.
 */
export function activeLocale(i18n: I18n): string {
  return String(unref(i18n.global.locale));
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
