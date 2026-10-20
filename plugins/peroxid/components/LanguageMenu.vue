<script setup lang="ts">
import { languageName, useLocaleSwitch } from '@dantweb/oxid-fe-core';
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import LanguageOptions from './LanguageOptions.vue';

/**
 * The language change as Apex shows it: a button with the current language's name that opens the
 * list of languages. Rendered only when the instance offers more than one.
 */
const { t } = useI18n();
const { locale, locales } = useLocaleSwitch();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const highlighted = ref(-1);
const listId = `pxd-language-${useId()}`;

function toggle(): void {
  open.value = !open.value;
  highlighted.value = open.value ? locales.indexOf(locale.value) : -1;
}

function close(): void {
  open.value = false;
  highlighted.value = -1;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!open.value) {
      toggle();
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : -1;
    highlighted.value = (highlighted.value + step + locales.length) % locales.length;
  } else if (event.key === 'Enter' && open.value && highlighted.value >= 0) {
    event.preventDefault();
    const option = root.value?.querySelectorAll<HTMLElement>('[role="option"]')[highlighted.value];
    option?.click();
  }
}

function onPointerDown(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) {
    close();
  }
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown));
</script>

<template>
  <div v-if="locales.length > 1" ref="root" class="pxd-language" @keydown="onKeydown">
    <button
      type="button"
      class="pxd-language__toggle"
      :aria-label="t('peroxid.language.label')"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      data-testid="pxd-language"
      @click="toggle"
    >
      <span>{{ languageName(locale) }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <div v-if="open" class="pxd-language__popover">
      <LanguageOptions :list-id="listId" :highlighted="highlighted" @chosen="close" />
    </div>
  </div>
</template>

<style scoped>
.pxd-language {
  position: relative;
}
.pxd-language__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px; /* a full-size tap target */
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--oxfe-color-text, #15130f);
  font: inherit;
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.pxd-language__toggle:hover,
.pxd-language__toggle[aria-expanded='true'] {
  background: var(--oxfe-color-surface, #f7f7f7);
}
.pxd-language__toggle svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.pxd-language__popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  min-width: 160px;
  border: 1px solid var(--oxfe-color-border, #e4ded3);
  border-radius: 14px;
  background: var(--oxfe-color-background, #fbf9f6);
  box-shadow: 0 18px 40px -18px rgb(0 0 0 / 0.35);
  overflow: hidden;
}
</style>
