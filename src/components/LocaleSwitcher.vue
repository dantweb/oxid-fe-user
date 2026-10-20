<script setup lang="ts">
import { useLocaleSwitch } from '@dantweb/oxid-fe-core';

const { locale, locales, switchTo } = useLocaleSwitch();

function change(event: Event): void {
  switchTo((event.target as HTMLSelectElement).value);
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
