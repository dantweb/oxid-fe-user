<script setup lang="ts">
import { formatPrice } from '@dantweb/oxid-fe-core';
import type { ProductListItem } from '../api/queries';

defineProps<{ products: ProductListItem[] }>();
</script>

<template>
  <ul class="grid">
    <li v-for="product in products" :key="product.id" class="grid__card">
      <router-link :to="`/shop/product/${product.id}`" data-testid="product-card">
        <img :src="product.imageGallery.thumb" :alt="product.title" loading="lazy" />
        <h2 data-testid="product-card-title">{{ product.title }}</h2>
        <p>{{ product.shortDescription }}</p>
        <strong data-testid="product-card-price">
          {{ formatPrice(product.price.price, product.price.currency.name) }}
        </strong>
      </router-link>
    </li>
  </ul>
</template>

<style scoped>
.grid {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}
.grid__card a {
  display: block;
  border: 1px solid var(--oxfe-color-border, #e2e2e2);
  border-radius: var(--oxfe-radius-lg, 8px);
  padding: 12px;
  text-decoration: none;
  color: inherit;
}
.grid__card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
}
.grid__card h2 {
  font-size: 16px;
  margin: 8px 0 4px;
}
.grid__card p {
  font-size: 13px;
  color: var(--oxfe-color-text-muted, #555);
  margin: 0 0 8px;
}
</style>
