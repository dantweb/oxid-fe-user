<script setup lang="ts">
import { formatPrice } from '@dantweb/oxid-fe-core';
import { useHead } from '@unhead/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCartStore } from '../stores/cart';

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });
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
      <router-link to="/checkout" class="cart__checkout" data-testid="go-checkout">{{
        t('shop.cart.toCheckout')
      }}</router-link>
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
  border-bottom: 1px solid var(--oxfe-color-border, #e2e2e2);
}
.cart__amount {
  display: inline-block;
  min-width: 32px;
  text-align: center;
}
.cart__checkout {
  display: inline-block;
  padding: 10px 20px;
  border-radius: var(--oxfe-radius-md, 6px);
  background: var(--oxfe-color-primary, #0a5d9c);
  color: var(--oxfe-color-primary-contrast, #fff);
  text-decoration: none;
}
</style>
