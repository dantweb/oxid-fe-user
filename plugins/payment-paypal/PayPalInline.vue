<script setup lang="ts">
import { loadScriptOnce, type InlinePaymentAttempt } from '@dantweb/oxid-fe-core';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePayPalInline } from './index';

const props = defineProps<{ basketId: string; returnUrl: string; cancelUrl: string }>();
const emit = defineEmits<{
  attempt: [InlinePaymentAttempt];
  settled: [];
  failed: [string];
  cancelled: [];
}>();

interface PayPalButtons {
  render(target: HTMLElement): Promise<void>;
  close(): Promise<void>;
}
interface PayPalNamespace {
  Buttons(options: {
    style?: Record<string, string | number | boolean>;
    createOrder(): Promise<string>;
    onApprove(): Promise<void> | void;
    onCancel(): Promise<void> | void;
    onError(error: unknown): Promise<void> | void;
  }): PayPalButtons;
}

const { t } = useI18n();
const { api, sdkUrl } = usePayPalInline();
const container = ref<HTMLElement | null>(null);
const loading = ref(true);
let buttons: PayPalButtons | null = null;
let attempt: InlinePaymentAttempt | null = null;
let disposed = false;

/** The approval URL of a PayPal order carries the order id as `token` — that is what the SDK wants. */
function orderIdFrom(approvalUrl: string | null): string {
  const id = approvalUrl ? new URL(approvalUrl).searchParams.get('token') : null;
  if (!id) {
    throw new Error('PayPal did not answer an order id');
  }
  return id;
}

async function retireAttempt(): Promise<void> {
  const open = attempt;
  attempt = null;
  if (open) {
    await api.cancel(open.contractId, open.contractToken).catch(() => undefined);
  }
}

onMounted(async () => {
  try {
    await loadScriptOnce(sdkUrl);
    const paypal = (window as unknown as { paypal?: PayPalNamespace }).paypal;
    if (!paypal || disposed || !container.value) {
      return;
    }
    buttons = paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
      // like the standard checkout: the order is created when the shopper clicks the button
      async createOrder() {
        const started = await api.start(props.basketId, {
          returnUrl: props.returnUrl,
          cancelUrl: props.cancelUrl,
        });
        attempt = {
          contractId: started.contractId,
          contractToken: started.contractToken,
          orderNumber: started.orderNumber,
        };
        emit('attempt', attempt);
        return orderIdFrom(started.redirectUrl);
      },
      onApprove() {
        attempt = null; // approved: the return route settles (captures) the contract
        emit('settled');
      },
      async onCancel() {
        await retireAttempt();
        emit('cancelled');
      },
      async onError(cause) {
        await retireAttempt();
        emit('failed', cause instanceof Error ? cause.message : String(cause));
      },
    });
    await buttons.render(container.value);
    loading.value = false;
  } catch (cause) {
    emit('failed', cause instanceof Error ? cause.message : String(cause));
  }
});

onBeforeUnmount(() => {
  disposed = true;
  void buttons?.close().catch(() => undefined);
});
</script>

<template>
  <div class="paypal-inline" data-testid="paypal-inline">
    <p v-if="loading" class="paypal-inline__loading" data-testid="paypal-inline-loading">
      {{ t('checkout.payment.loadingProvider') }}
    </p>
    <div ref="container" class="paypal-inline__buttons" data-testid="paypal-buttons" />
  </div>
</template>

<style scoped>
.paypal-inline {
  min-height: 60px;
  max-width: 480px;
}
.paypal-inline__loading {
  color: var(--oxfe-color-text-muted, #555);
}
</style>
