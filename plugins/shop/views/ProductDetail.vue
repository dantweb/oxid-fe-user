<script setup lang="ts">
import { createSavedListsApi, formatPrice, type SavedListKind } from '@dantweb/oxid-fe-core';
import { useHead } from '@unhead/vue';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useShopContext } from '../index';
import { PRODUCT_QUERY, type ProductDetail } from '../api/queries';
import { useCartStore } from '../stores/cart';

const props = defineProps<{ id: string }>();

const { t } = useI18n();
const { client, auth } = useShopContext();
const lists = createSavedListsApi(client);
const cart = useCartStore();

const product = ref<ProductDetail | null>(null);
const failed = ref(false);
const added = ref(false);
/** the saved list the product was just put on (wish list / gift registry), for the confirmation */
const saved = ref<SavedListKind | null>(null);
const saveFailed = ref(false);

useHead({
  title: () => (product.value ? `${product.value.title} · ${t('app.title')}` : t('app.title')),
  meta: [
    { name: 'description', content: () => product.value?.shortDescription ?? '' },
    { property: 'og:title', content: () => product.value?.title ?? '' },
    { property: 'og:type', content: 'product' },
    { property: 'og:image', content: () => product.value?.imageGallery.thumb ?? '' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: () =>
        product.value
          ? JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: product.value.title,
              description: product.value.shortDescription,
              image: product.value.imageGallery.thumb,
              offers: {
                '@type': 'Offer',
                price: product.value.price.price,
                priceCurrency: product.value.price.currency.name,
                availability: 'https://schema.org/InStock',
              },
            })
          : '',
    },
  ],
});

onMounted(async () => {
  try {
    const data = await client.execute<{ product: ProductDetail }>(PRODUCT_QUERY, { id: props.id });
    product.value = data.product;
  } catch {
    failed.value = true;
  }
});

function addToCart(): void {
  if (!product.value) {
    return;
  }
  cart.addItem({
    productId: product.value.id,
    title: product.value.title,
    price: product.value.price.price,
    currencyName: product.value.price.currency.name,
  });
  added.value = true;
}

async function saveTo(kind: SavedListKind): Promise<void> {
  if (!product.value) {
    return;
  }
  saved.value = null;
  saveFailed.value = false;
  try {
    await lists.add(kind, product.value.id);
    saved.value = kind;
  } catch {
    saveFailed.value = true;
  }
}
</script>

<template>
  <section>
    <router-link to="/shop">← {{ t('shop.product.back') }}</router-link>
    <p v-if="failed" role="alert">{{ t('shop.product.loadFailed') }}</p>
    <article v-else-if="product" class="product">
      <img :src="product.imageGallery.thumb" :alt="product.title" />
      <div>
        <h1>{{ product.title }}</h1>
        <p>{{ product.shortDescription }}</p>
        <strong data-testid="product-price">
          {{ formatPrice(product.price.price, product.price.currency.name) }}
        </strong>
        <p class="product__long">{{ product.longDescription }}</p>
        <div class="product__actions">
          <button
            class="btn btn-primary"
            type="button"
            data-testid="add-to-cart"
            @click="addToCart"
          >
            {{ t('shop.product.addToCart') }}
          </button>
          <template v-if="auth.isAuthenticated()">
            <button
              class="btn btn-outline-primary"
              type="button"
              data-testid="add-to-wishlist"
              @click="saveTo('noticelist')"
            >
              {{ t('shop.product.addToWishlist') }}
            </button>
            <button
              class="btn btn-outline-primary"
              type="button"
              data-testid="add-to-gift-registry"
              @click="saveTo('wishlist')"
            >
              {{ t('shop.product.addToGiftRegistry') }}
            </button>
          </template>
          <router-link
            v-else
            :to="{ path: '/login', query: { redirect: `/shop/product/${product.id}` } }"
            class="btn btn-link"
            data-testid="login-to-save"
            >{{ t('shop.product.loginToSave') }}</router-link
          >
        </div>
        <p v-if="added" data-testid="added-note">{{ t('shop.product.added') }}</p>
        <p v-if="saved" data-testid="saved-note">
          {{
            saved === 'noticelist'
              ? t('shop.product.savedToWishlist')
              : t('shop.product.savedToGiftRegistry')
          }}
        </p>
        <p v-if="saveFailed" role="alert" data-testid="save-failed">
          {{ t('shop.product.saveFailed') }}
        </p>
      </div>
    </article>
  </section>
</template>

<style scoped>
.product {
  display: grid;
  grid-template-columns: minmax(200px, 400px) 1fr;
  gap: 32px;
  margin-top: 16px;
}
.product img {
  width: 100%;
  object-fit: contain;
}
.product__long {
  white-space: pre-line;
  color: var(--oxfe-color-text-muted, #555);
}
.product__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}
@media (max-width: 700px) {
  .product {
    grid-template-columns: 1fr;
  }
}
</style>
