<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ProductGrid from '../components/ProductGrid.vue';
import { useShopContext } from '../index';
import {
  CATEGORIES_QUERY,
  PRODUCTS_QUERY,
  type CategoryItem,
  type ProductListItem,
} from '../api/queries';

const { t } = useI18n();
useHead({ title: () => `${t('shop.catalog.headline')} · ${t('app.title')}` });
const { client, config } = useShopContext();
const pageSize = Number(config.products_per_page ?? 12);

const products = ref<ProductListItem[]>([]);
const categories = ref<CategoryItem[]>([]);
const page = ref(0);
const loading = ref(true);
const failed = ref(false);

const hasNext = computed(() => products.value.length === pageSize);

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    const data = await client.execute<{ products: ProductListItem[] }>(PRODUCTS_QUERY, {
      offset: page.value * pageSize,
      limit: pageSize,
    });
    products.value = data.products;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function goTo(nextPage: number): void {
  page.value = Math.max(0, nextPage);
  void load();
}

onMounted(() => {
  void load();
  void client
    .execute<{ categories: CategoryItem[] }>(CATEGORIES_QUERY)
    .then((data) => (categories.value = data.categories))
    .catch(() => undefined);
});
</script>

<template>
  <section>
    <h1>{{ t('shop.catalog.headline') }}</h1>
    <nav v-if="categories.length" class="categories" :aria-label="t('shop.catalog.categories')">
      <router-link
        v-for="entry in categories"
        :key="entry.id"
        :to="`/shop/category/${entry.id}`"
        data-testid="category-link"
      >
        {{ entry.title }}
      </router-link>
    </nav>
    <p v-if="failed" role="alert">{{ t('shop.catalog.loadFailed') }}</p>
    <p v-else-if="!loading && products.length === 0">{{ t('shop.catalog.empty') }}</p>
    <ProductGrid v-else :products="products" />
    <nav class="catalog__pager">
      <button
        class="btn btn-outline-primary btn-sm"
        type="button"
        :disabled="page === 0 || loading"
        @click="goTo(page - 1)"
      >
        {{ t('shop.catalog.prev') }}
      </button>
      <span>{{ page + 1 }}</span>
      <button
        class="btn btn-outline-primary btn-sm"
        type="button"
        :disabled="!hasNext || loading"
        @click="goTo(page + 1)"
      >
        {{ t('shop.catalog.next') }}
      </button>
    </nav>
  </section>
</template>

<style scoped>
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 20px;
}
.categories a {
  font-size: 14px;
  white-space: nowrap;
}
.catalog__pager {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
}
</style>
