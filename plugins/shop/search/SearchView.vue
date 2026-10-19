<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import type { ProductListItem } from '../api/queries';
import ProductGrid from '../components/ProductGrid.vue';
import { useShopContext } from '../index';
import { fetchResultsPage, normalizeTerm } from './searchApi';

const { t } = useI18n();
const route = useRoute();
const { client } = useShopContext();

const term = computed(() =>
  typeof route.query.q === 'string' ? normalizeTerm(route.query.q) : '',
);
const products = ref<ProductListItem[]>([]);
const page = ref(0);
const state = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle');
const hasNext = ref(false);
const refine = ref(false);

// search results are not meant for the index
useHead({
  title: () => `${t('shop.search.label')} · ${t('app.title')}`,
  meta: [{ name: 'robots', content: 'noindex,follow' }],
});

async function load(): Promise<void> {
  if (!term.value) {
    products.value = [];
    hasNext.value = false;
    refine.value = false;
    state.value = 'idle';
    return;
  }
  state.value = 'loading';
  try {
    const result = await fetchResultsPage(client, term.value, page.value);
    products.value = result.products;
    hasNext.value = result.hasNext;
    refine.value = result.refine;
    state.value = 'ready';
  } catch {
    state.value = 'failed';
  }
}

function goTo(next: number): void {
  page.value = Math.max(0, next);
  void load();
}

watch(
  term,
  () => {
    page.value = 0;
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <section class="pxd-results">
    <h1 data-testid="pxd-results-title">{{ t('shop.search.results', { query: term }) }}</h1>
    <p v-if="state === 'failed'" role="alert">{{ t('shop.search.failed') }}</p>
    <p v-else-if="state === 'ready' && products.length === 0" data-testid="pxd-results-empty">
      {{ t('shop.search.none', { query: term }) }}
    </p>
    <ProductGrid v-else :products="products" data-testid="pxd-results" />
    <p v-if="state === 'ready' && refine" data-testid="pxd-results-refine">
      {{ t('shop.search.refine') }}
    </p>
    <nav v-if="state === 'ready' && (page > 0 || hasNext)" class="pxd-pager">
      <button
        type="button"
        :disabled="page === 0"
        data-testid="pxd-results-prev"
        @click="goTo(page - 1)"
      >
        {{ t('shop.search.prev') }}
      </button>
      <span>{{ page + 1 }}</span>
      <button
        type="button"
        :disabled="!hasNext"
        data-testid="pxd-results-next"
        @click="goTo(page + 1)"
      >
        {{ t('shop.search.next') }}
      </button>
    </nav>
  </section>
</template>

<style scoped>
h1 {
  font-family: var(--oxfe-font-heading, sans-serif);
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  font-weight: 500;
  overflow-wrap: anywhere;
}
.pxd-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
}
.pxd-pager button {
  min-height: 44px;
  padding: 0 24px;
  border: 1px solid var(--oxfe-color-border, #e4ded3);
  border-radius: 999px;
  background: transparent;
  color: var(--oxfe-color-text, #15130f);
  cursor: pointer;
}
.pxd-pager button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
