<script setup lang="ts">
import { languageName, useLocaleSwitch } from '@dantweb/oxid-fe-core';

/**
 * The languages an instance offers, by their own names, the current one marked — the list of the
 * Apex language dropdown. Used inside the header popover and as a plain list in the drawer.
 */
const props = defineProps<{ listId?: string; highlighted?: number }>();
const emit = defineEmits<{ chosen: [] }>();

const { locale, locales, switchTo } = useLocaleSwitch();

function choose(code: string): void {
  switchTo(code);
  emit('chosen');
}
</script>

<template>
  <ul :id="props.listId" role="listbox" class="pxd-language__list" data-testid="pxd-language-list">
    <li
      v-for="(code, index) in locales"
      :key="code"
      role="option"
      :lang="code"
      :aria-selected="code === locale"
      :class="{ 'is-active': index === props.highlighted }"
      data-testid="pxd-language-option"
      @click="choose(code)"
    >
      {{ languageName(code) }}
    </li>
  </ul>
</template>

<style scoped>
.pxd-language__list {
  margin: 0;
  padding: 6px 0;
  list-style: none;
}
.pxd-language__list li {
  padding: 10px 16px;
  min-height: 44px; /* a full-size tap target */
  display: flex;
  align-items: center;
  cursor: pointer;
  color: var(--oxfe-color-text, #15130f);
  white-space: nowrap;
}
.pxd-language__list li[aria-selected='true'] {
  font-weight: 600;
  color: var(--oxfe-color-accent, #b08d57);
}
.pxd-language__list li:hover,
.pxd-language__list li.is-active {
  background: var(--oxfe-color-surface, #f7f7f7);
}
</style>
