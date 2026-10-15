import type { PluginRegistry } from '@dantweb/oxid-fe-core';
import { createI18n, type I18n } from 'vue-i18n';
import de from './de.json';
import en from './en.json';

export function createAppI18n(registry: PluginRegistry): I18n {
  const browserPrefersDe =
    typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('de');

  return createI18n({
    legacy: false,
    locale: browserPrefersDe ? 'de' : 'en',
    fallbackLocale: 'en',
    messages: {
      en: { ...en, ...registry.messagesFor('en') },
      de: { ...de, ...registry.messagesFor('de') },
    },
  });
}
