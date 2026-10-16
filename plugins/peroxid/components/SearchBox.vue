<script setup lang="ts">
import { formatPrice } from '@dantweb/oxid-fe-core';
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { ProductListItem } from '../../shop/api/queries';
import { usePeroxidContext } from '../index';
import { SEARCH_QUERY } from '../streams';

const props = defineProps<{ autofocus?: boolean }>();
const emit = defineEmits<{ done: [] }>();

const MIN_CHARS = 2;
const SUGGESTION_LIMIT = 5;
const DEBOUNCE_MS = 250;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { client } = usePeroxidContext();

const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
const suggestions = ref<ProductListItem[]>([]);
const open = ref(false);
const active = ref(-1);
const listId = `pxd-suggest-${useId()}`;

let timer: ReturnType<typeof setTimeout> | undefined;
let sequence = 0;

watch(query, (value) => {
  clearTimeout(timer);
  const term = value.trim();
  if (term.length < MIN_CHARS) {
    suggestions.value = [];
    open.value = false;
    return;
  }
  timer = setTimeout(() => void fetchSuggestions(term), DEBOUNCE_MS);
});

watch(
  () => route.query.q,
  (value) => {
    if (route.path === '/search' && typeof value === 'string') {
      query.value = value;
    }
  },
);

async function fetchSuggestions(term: string): Promise<void> {
  const mine = ++sequence;
  try {
    const data = await client.execute<{ products: ProductListItem[] }>(SEARCH_QUERY, {
      q: term,
      limit: SUGGESTION_LIMIT,
      offset: 0,
    });
    if (mine !== sequence) {
      return; // a newer keystroke superseded this answer
    }
    suggestions.value = data.products;
    active.value = -1;
    open.value = data.products.length > 0;
  } catch {
    suggestions.value = [];
    open.value = false;
  }
}

function close(): void {
  open.value = false;
  active.value = -1;
}

function submit(): void {
  const term = query.value.trim();
  if (!term) {
    return;
  }
  close();
  emit('done');
  void router.push({ path: '/search', query: { q: term } });
}

function choose(product: ProductListItem): void {
  close();
  emit('done');
  void router.push(`/shop/product/${product.id}`);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' && suggestions.value.length > 0) {
    event.preventDefault();
    open.value = true;
    active.value = (active.value + 1) % suggestions.value.length;
  } else if (event.key === 'ArrowUp' && suggestions.value.length > 0) {
    event.preventDefault();
    active.value = (active.value - 1 + suggestions.value.length) % suggestions.value.length;
  } else if (event.key === 'Enter' && active.value >= 0) {
    event.preventDefault();
    choose(suggestions.value[active.value]);
  } else if (event.key === 'Escape') {
    close();
  }
}

function onPointerDown(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown);
  if (props.autofocus) {
    input.value?.focus();
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  clearTimeout(timer);
});
</script>

<template>
  <div ref="root" class="pxd-search">
    <form role="search" class="pxd-search__form" data-testid="pxd-search" @submit.prevent="submit">
      <svg class="pxd-search__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <input
        ref="input"
        v-model="query"
        type="search"
        name="q"
        autocomplete="off"
        enterkeyhint="search"
        role="combobox"
        :aria-label="t('peroxid.search.label')"
        :aria-expanded="open"
        :aria-controls="listId"
        :placeholder="t('peroxid.search.placeholder')"
        data-testid="pxd-search-input"
        @keydown="onKeydown"
        @focus="open = suggestions.length > 0"
      />
      <button
        type="submit"
        class="pxd-search__submit"
        :aria-label="t('peroxid.search.submit')"
        data-testid="pxd-search-submit"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </form>

    <ul
      v-if="open && suggestions.length > 0"
      :id="listId"
      role="listbox"
      class="pxd-suggest"
      data-testid="pxd-suggestions"
    >
      <li
        v-for="(product, index) in suggestions"
        :key="product.id"
        role="option"
        :aria-selected="index === active"
        :class="{ 'is-active': index === active }"
      >
        <button type="button" data-testid="pxd-suggestion" @click="choose(product)">
          <img :src="product.imageGallery.thumb" alt="" />
          <span class="pxd-suggest__title">{{ product.title }}</span>
          <span class="pxd-suggest__price">
            {{ formatPrice(product.price.price, product.price.currency.name) }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pxd-search {
  position: relative;
  width: 100%;
  min-width: 0;
}
.pxd-search__form {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 48px;
  padding: 0 2px 0 14px;
  border: 1px solid var(--oxfe-color-border, #e4ded3);
  border-radius: 999px;
  background: var(--oxfe-color-surface, #f7f7f7);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.pxd-search__form:focus-within {
  border-color: var(--oxfe-color-accent, #b08d57);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--oxfe-color-accent, #b08d57) 22%, transparent);
}
.pxd-search__icon {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--oxfe-color-text-muted, #6b655b);
  stroke-width: 1.6;
  stroke-linecap: round;
}
input {
  flex: 1;
  min-width: 0;
  height: 42px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--oxfe-color-text, #15130f);
  font: inherit;
  font-size: 16px; /* 16px stops iOS Safari zooming the page on focus */
}
input::placeholder {
  color: var(--oxfe-color-text-muted, #6b655b);
}
.pxd-search__submit {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px; /* a full-size tap target */
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--oxfe-color-primary, #15130f);
  color: var(--oxfe-color-primary-contrast, #fbf9f6);
  cursor: pointer;
}
.pxd-search__submit svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.pxd-suggest {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  width: min(440px, 100%);
  min-width: min(320px, 100%);
  max-height: 60vh;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--oxfe-color-border, #e4ded3);
  border-radius: var(--oxfe-radius-lg, 8px);
  background: var(--oxfe-color-background, #fbf9f6);
  box-shadow: 0 18px 40px rgba(20, 16, 10, 0.16);
}
.pxd-suggest li button {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--oxfe-radius-md, 6px);
  background: transparent;
  color: var(--oxfe-color-text, #15130f);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pxd-suggest li.is-active button,
.pxd-suggest li button:hover {
  background: var(--oxfe-color-surface, #f1ede6);
}
.pxd-suggest img {
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.pxd-suggest__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pxd-suggest__price {
  color: var(--oxfe-color-text-muted, #6b655b);
  font-size: 0.875rem;
}
</style>
