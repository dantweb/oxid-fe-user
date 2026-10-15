<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { LOCALE_STORAGE_KEY } from '../i18n';

const { locale, availableLocales } = useI18n();

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
    v-if="availableLocales.length > 1"
    :value="locale"
    aria-label="Language"
    data-testid="locale-switcher"
    @change="change"
  >
    <option v-for="entry in availableLocales" :key="entry" :value="entry">
      {{ entry.toUpperCase() }}
    </option>
  </select>
</template>
