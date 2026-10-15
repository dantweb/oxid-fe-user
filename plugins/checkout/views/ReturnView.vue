<script setup lang="ts">
import { isPaymentPlugin, type CheckoutReturnResult } from '@dantweb/oxid-fe-core';
import { onMounted, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { useCartStore } from '../../shop/stores/cart';
import { useCheckoutContext } from '../index';
import { useCheckoutStore } from '../stores/checkout';

const props = defineProps<{ provider: string }>();

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const checkout = useCheckoutStore();
const cart = useCartStore();
const { registry } = useCheckoutContext();

const state = ref<'checking' | 'committed' | 'pending' | 'failed'>('checking');
const orderNumber = ref<string | null>(null);

const POLLS = 5;
const POLL_DELAY_MS = 2000;

onMounted(async () => {
  const attempt = checkout.attempt;
  const plugin = registry.all().find((p) => p.name === props.provider && isPaymentPlugin(p));
  if (!attempt || !plugin || !isPaymentPlugin(plugin) || attempt.provider !== props.provider) {
    state.value = 'failed';
    return;
  }

  // The provider's webhook commits the order; poll a few times while it lands.
  for (let i = 0; i < POLLS; i++) {
    let result: CheckoutReturnResult;
    try {
      result = await plugin.checkoutReturn(attempt.contractId, attempt.contractToken);
    } catch {
      state.value = 'failed';
      return;
    }
    if (result.status === 'committed') {
      orderNumber.value = result.orderNumber ?? attempt.orderNumber;
      state.value = 'committed';
      cart.clear();
      checkout.clear();
      return;
    }
    if (result.status === 'failed') {
      state.value = 'failed';
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
  }
  state.value = 'pending';
});
</script>

<template>
  <section>
    <p v-if="state === 'checking'" data-testid="return-checking">
      {{ t('checkout.return.checking') }}
    </p>
    <p v-else-if="state === 'committed'" data-testid="return-committed">
      {{ t('checkout.return.committed', { orderNumber }) }}
    </p>
    <p v-else-if="state === 'pending'" data-testid="return-pending">
      {{ t('checkout.return.pending') }}
    </p>
    <p v-else role="alert" data-testid="return-failed">{{ t('checkout.return.failed') }}</p>
    <router-link v-if="state === 'failed'" to="/shop/cart">{{
      t('checkout.return.backToCart')
    }}</router-link>
    <router-link v-else to="/shop">{{ t('checkout.return.toShop') }}</router-link>
  </section>
</template>
