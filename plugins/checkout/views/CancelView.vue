<script setup lang="ts">
import { isPaymentPlugin } from '@dantweb/oxid-fe-core';
import { onMounted, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { dropQueryString } from '../../../src/navigation';
import { useCheckoutContext } from '../index';
import { useCheckoutStore } from '../stores/checkout';

const props = defineProps<{ provider: string }>();

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const checkout = useCheckoutStore();
const { registry } = useCheckoutContext();
const done = ref(false);

onMounted(async () => {
  dropQueryString(); // a provider's own parameters (PayPal `token`) have no use here
  const attempt = checkout.attempt;
  const plugin = registry.all().find((p) => p.name === props.provider && isPaymentPlugin(p));
  if (attempt && plugin && isPaymentPlugin(plugin) && attempt.provider === props.provider) {
    try {
      await plugin.cancel(attempt.contractId, attempt.contractToken);
    } catch {
      /* already retired — retiring twice changes nothing */
    }
  }
  checkout.clear(); // a cancelled attempt blocks its basket — the retry builds a fresh one
  done.value = true;
});
</script>

<template>
  <section>
    <h1>{{ t('checkout.cancel.headline') }}</h1>
    <p v-if="done" data-testid="cancel-done">{{ t('checkout.cancel.done') }}</p>
    <router-link to="/checkout" data-testid="cancel-retry">{{
      t('checkout.cancel.retry')
    }}</router-link>
  </section>
</template>
