<script setup lang="ts">
import { formatPrice } from '@dantweb/oxid-fe-core';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useShopContext } from '../index';
import { PRODUCTS_QUERY, type ProductListItem } from '../api/queries';

const { t } = useI18n();
const { client, config } = useShopContext();
const pageSize = Number(config.products_per_page ?? 12);

const products = ref<ProductListItem[]>([]);
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

onMounted(load);
</script>

<template>
  <section>
    <h1>{{ t('shop.catalog.headline') }}</h1>
    <p v-if="failed" role="alert">{{ t('shop.catalog.loadFailed') }}</p>
    <p v-else-if="!loading && products.length === 0">{{ t('shop.catalog.empty') }}</p>
    <ul v-else class="catalog">
      <li v-for="product in products" :key="product.id" class="catalog__card">
        <router-link :to="`/shop/product/${product.id}`" data-testid="product-card">
          <img :src="product.imageGallery.thumb" :alt="product.title" loading="lazy" />
          <h2>{{ product.title }}</h2>
          <p>{{ product.shortDescription }}</p>
          <strong>{{ formatPrice(product.price.price, product.price.currency.name) }}</strong>
        </router-link>
      </li>
    </ul>
    <nav class="catalog__pager">
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
.catalog {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}
.catalog__card a {
  display: block;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  padding: 12px;
  text-decoration: none;
  color: inherit;
}
.catalog__card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
}
.catalog__card h2 {
  font-size: 16px;
  margin: 8px 0 4px;
}
.catalog__card p {
  font-size: 13px;
  color: #555;
  margin: 0 0 8px;
}
.catalog__pager {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
}
</style>
