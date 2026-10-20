import { localeSwitchKey } from '@dantweb/oxid-fe-core';
import { createApp, nextTick, ref, type Component } from 'vue';
import { createI18n } from 'vue-i18n';
import { describe, expect, it } from 'vitest';
import LanguageMenu from '../../plugins/peroxid/components/LanguageMenu.vue';
import LanguageOptions from '../../plugins/peroxid/components/LanguageOptions.vue';
import en from '../../plugins/peroxid/i18n/en.json';

function mount(component: Component, locales: string[], start = 'en') {
  const locale = ref(start);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = createApp(component);
  app.use(createI18n({ legacy: false, locale: start, messages: { en: { peroxid: en } } }));
  app.provide(localeSwitchKey, { locale, locales });
  app.mount(host);
  return { host, locale, unmount: () => app.unmount() };
}

const texts = (host: HTMLElement): string[] =>
  Array.from(host.querySelectorAll('[data-testid=pxd-language-option]')).map(
    (e) => e.textContent?.trim() ?? '',
  );

describe('peroxid LanguageOptions', () => {
  it('lists the offered languages by their own names, in the instance order, the current one selected', () => {
    const { host, unmount } = mount(LanguageOptions, ['en', 'de', 'fr'], 'de');
    expect(texts(host)).toEqual(['English', 'Deutsch', 'Français']);
    const selected = host.querySelector('[aria-selected=true]');
    expect(selected?.textContent?.trim()).toBe('Deutsch');
    expect(selected?.getAttribute('lang')).toBe('de');
    unmount();
  });

  it('switches on click', async () => {
    const { host, locale, unmount } = mount(LanguageOptions, ['en', 'de']);
    (host.querySelectorAll('[data-testid=pxd-language-option]')[1] as HTMLElement).click();
    await nextTick();
    expect(locale.value).toBe('de');
    expect(host.querySelector('[aria-selected=true]')?.textContent?.trim()).toBe('Deutsch');
    unmount();
  });
});

describe('peroxid LanguageMenu', () => {
  it('shows the current language and opens the list on click; Escape closes it', async () => {
    const { host, unmount } = mount(LanguageMenu, ['en', 'de']);
    const toggle = host.querySelector('[data-testid=pxd-language]') as HTMLButtonElement;
    expect(toggle.textContent?.trim()).toBe('English');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-testid=pxd-language-list]')).toBeNull();

    toggle.click();
    await nextTick();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(texts(host)).toEqual(['English', 'Deutsch']);

    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(host.querySelector('[data-testid=pxd-language-list]')).toBeNull();
    unmount();
  });

  it('keyboard: ArrowDown + Enter chooses the next language and closes', async () => {
    const { host, locale, unmount } = mount(LanguageMenu, ['en', 'de']);
    const toggle = host.querySelector('[data-testid=pxd-language]') as HTMLButtonElement;
    toggle.click();
    await nextTick();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();
    expect(locale.value).toBe('de');
    expect(host.querySelector('[data-testid=pxd-language-list]')).toBeNull();
    expect(toggle.textContent?.trim()).toBe('Deutsch');
    unmount();
  });

  it('renders nothing with a single language', () => {
    const { host, unmount } = mount(LanguageMenu, ['de'], 'de');
    expect(host.querySelector('[data-testid=pxd-language]')).toBeNull();
    unmount();
  });
});
