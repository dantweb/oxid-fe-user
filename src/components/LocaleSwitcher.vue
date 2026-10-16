<script setup lang="ts">
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { instanceKey } from '../core';
import { LOCALE_STORAGE_KEY } from '../i18n';

const { locale, availableLocales } = useI18n();
// the instance's order (oxid-config.yaml `i18n.locales`), not vue-i18n's alphabetical one
const locales = inject(instanceKey)?.i18n.locales ?? availableLocales;

function change(event: Event): void {
  const next = (event.target as HTMLSelectElement).value;
  locale.value = next;
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* choice lasts for this page view */
  }
}
</script>

<template>
  <select
    v-if="locales.length > 1"
    :value="locale"
    aria-label="Language"
    data-testid="locale-switcher"
    @change="change"
  >
    <option v-for="entry in locales" :key="entry" :value="entry">
      {{ entry.toUpperCase() }}
    </option>
  </select>
</template>
