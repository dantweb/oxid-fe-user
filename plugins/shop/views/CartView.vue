<script setup lang="ts">
import { formatPrice } from '@dantweb/oxid-fe-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCartStore } from '../stores/cart';

const { t } = useI18n();
const cart = useCartStore();

const currencyName = computed(() => cart.items[0]?.currencyName ?? 'EUR');
</script>

<template>
  <section>
    <h1>{{ t('shop.cart.headline') }}</h1>
    <p v-if="cart.isEmpty" data-testid="cart-empty">{{ t('shop.cart.empty') }}</p>
    <template v-else>
      <table class="cart">
        <thead>
          <tr>
            <th>{{ t('shop.cart.product') }}</th>
            <th>{{ t('shop.cart.amount') }}</th>
            <th>{{ t('shop.cart.price') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in cart.items" :key="item.productId" data-testid="cart-row">
            <td>
              <router-link :to="`/shop/product/${item.productId}`">{{ item.title }}</router-link>
            </td>
            <td>
              <button type="button" @click="cart.updateAmount(item.productId, item.amount - 1)">
                −
              </button>
              <span class="cart__amount" data-testid="cart-amount">{{ item.amount }}</span>
              <button type="button" @click="cart.updateAmount(item.productId, item.amount + 1)">
                +
              </button>
            </td>
            <td>{{ formatPrice(item.amount * item.price, item.currencyName) }}</td>
            <td>
              <button type="button" @click="cart.removeItem(item.productId)">
                {{ t('shop.cart.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p data-testid="cart-subtotal">
        <strong
          >{{ t('shop.cart.subtotal') }}: {{ formatPrice(cart.subtotal, currencyName) }}</strong
        >
      </p>
      <p class="cart__note">{{ t('shop.cart.checkoutPending') }}</p>
    </template>
  </section>
</template>

<style scoped>
.cart {
  width: 100%;
  border-collapse: collapse;
}
.cart th,
.cart td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid #e2e2e2;
}
.cart__amount {
  display: inline-block;
  min-width: 32px;
  text-align: center;
}
.cart__note {
  color: #666;
  font-style: italic;
}
</style>
