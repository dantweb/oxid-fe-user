<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import ProductGrid from '../components/ProductGrid.vue';
import {
  CATEGORY_PRODUCTS_QUERY,
  CATEGORY_QUERY,
  type CategoryItem,
  type ProductListItem,
} from '../api/queries';
import { useShopContext } from '../index';

const props = defineProps<{ id: string }>();

const { t } = useI18n();
const { client, config } = useShopContext();
const pageSize = Number(config.products_per_page ?? 12);

const category = ref<CategoryItem | null>(null);
const products = ref<ProductListItem[]>([]);
const page = ref(0);
const loading = ref(true);
const failed = ref(false);

const hasNext = computed(() => products.value.length === pageSize);

useHead({
  title: () => (category.value ? `${category.value.title} · OXID Storefront` : 'OXID Storefront'),
});

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    const [categoryData, productData] = await Promise.all([
      client.execute<{ category: CategoryItem }>(CATEGORY_QUERY, { id: props.id }),
      client.execute<{ products: ProductListItem[] }>(CATEGORY_PRODUCTS_QUERY, {
        categoryId: props.id,
        offset: page.value * pageSize,
        limit: pageSize,
      }),
    ]);
    category.value = categoryData.category;
    products.value = productData.products;
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

watch(
  () => props.id,
  () => {
    page.value = 0;
    void load();
  },
);
onMounted(load);
</script>

<template>
  <section>
    <router-link to="/shop">← {{ t('shop.category.back') }}</router-link>
    <h1 data-testid="category-title">{{ category?.title }}</h1>
    <p v-if="failed" role="alert">{{ t('shop.category.loadFailed') }}</p>
    <p v-else-if="!loading && products.length === 0">{{ t('shop.category.empty') }}</p>
    <ProductGrid v-else :products="products" />
    <nav class="pager">
      <button type="button" :disabled="page === 0 || loading" @click="goTo(page - 1)">
        {{ t('shop.catalog.prev') }}
      </button>
      <span>{{ page + 1 }}</span>
      <button type="button" :disabled="!hasNext || loading" @click="goTo(page + 1)">
        {{ t('shop.catalog.next') }}
      </button>
    </nav>
  </section>
</template>

<style scoped>
.pager {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
}
</style>
