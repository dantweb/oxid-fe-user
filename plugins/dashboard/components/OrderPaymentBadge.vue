<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { OrderPaymentContract } from '../api/queries';
import { paymentBadgeFor } from '../paymentBadge';

const props = defineProps<{ contract?: OrderPaymentContract | null }>();

const { t } = useI18n();
const badge = computed(() => paymentBadgeFor(props.contract));
</script>

<template>
  <span
    v-if="badge"
    class="payment-badge"
    :class="`payment-badge--${badge.tone}`"
    :data-state="badge.key"
    data-testid="order-payment-badge"
  >
    {{ badge.provider }} · {{ t(`dashboard.orders.payment.${badge.key}`) }}
  </span>
</template>

<style scoped>
.payment-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8em;
  border: 1px solid currentColor;
}
.payment-badge--success {
  color: var(--oxfe-color-success, #1b7f3b);
}
.payment-badge--info {
  color: var(--oxfe-color-info, #1f5fbf);
}
.payment-badge--warning {
  color: var(--oxfe-color-warning, #9a6700);
}
.payment-badge--danger {
  color: var(--oxfe-color-danger, #b00020);
}
.payment-badge--neutral {
  color: var(--oxfe-color-muted, #5f6368);
}
</style>
