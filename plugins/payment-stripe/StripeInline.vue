<script setup lang="ts">
import { loadScriptOnce, type InlinePaymentAttempt } from '@dantweb/oxid-fe-core';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStripeInline } from './index';

const props = defineProps<{ basketId: string; returnUrl: string; cancelUrl: string }>();
const emit = defineEmits<{ attempt: [InlinePaymentAttempt]; failed: [string] }>();

interface EmbeddedCheckout {
  mount(target: HTMLElement): void;
  destroy(): void;
}
interface StripeInstance {
  initEmbeddedCheckout(options: { clientSecret: string }): Promise<EmbeddedCheckout>;
}
type StripeFactory = (publishableKey: string) => StripeInstance;

const STRIPE_JS = 'https://js.stripe.com/v3/';

/** Stripe allows ONE Embedded Checkout object per document — every mount goes through this. */
let active: EmbeddedCheckout | null = null;

const { t } = useI18n();
const { api, publishableKey } = useStripeInline();
const container = ref<HTMLElement | null>(null);
const loading = ref(true);
let disposed = false;

onMounted(async () => {
  try {
    await loadScriptOnce(STRIPE_JS);
    const started = await api.start(props.basketId, {
      returnUrl: props.returnUrl,
      cancelUrl: props.cancelUrl,
      uiMode: 'embedded',
    });
    const attempt = {
      contractId: started.contractId,
      contractToken: started.contractToken,
      orderNumber: started.orderNumber,
    };
    if (disposed) {
      // the shopper moved on while Stripe was starting: retire what we just created
      await api.cancel(attempt.contractId, attempt.contractToken).catch(() => undefined);
      return;
    }
    emit('attempt', attempt);
    if (!started.clientSecret) {
      throw new Error('Stripe did not answer a client secret');
    }

    const stripe = (window as unknown as { Stripe: StripeFactory }).Stripe(publishableKey);
    await active?.destroy();
    active = null;
    const checkout = await stripe.initEmbeddedCheckout({ clientSecret: started.clientSecret });
    if (disposed || !container.value) {
      checkout.destroy();
      return;
    }
    checkout.mount(container.value);
    active = checkout;
    loading.value = false;
  } catch (cause) {
    emit('failed', cause instanceof Error ? cause.message : String(cause));
  }
});

onBeforeUnmount(() => {
  disposed = true;
  active?.destroy();
  active = null;
});
</script>

<template>
  <div class="stripe-inline" data-testid="stripe-inline">
    <p v-if="loading" class="stripe-inline__loading" data-testid="stripe-inline-loading">
      {{ t('checkout.payment.loadingProvider') }}
    </p>
    <div ref="container" data-testid="stripe-embedded" />
  </div>
</template>

<style scoped>
.stripe-inline {
  min-height: 120px;
}
.stripe-inline__loading {
  color: var(--oxfe-color-text-muted, #555);
}
</style>
