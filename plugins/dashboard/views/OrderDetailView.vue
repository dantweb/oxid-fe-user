<script setup lang="ts">
import { formatPrice } from '@dantweb/oxid-fe-core';
import { computed, onMounted, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { ORDERS_QUERY, type CustomerOrder } from '../api/queries';
import AccountLayout from '../components/AccountLayout.vue';
import { useDashboardContext } from '../index';

const props = defineProps<{ id: string }>();

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client } = useDashboardContext();
const orders = ref<CustomerOrder[]>([]);
const loaded = ref(false);

const order = computed(() => orders.value.find((entry) => entry.id === props.id) ?? null);

onMounted(async () => {
  const data = await client.execute<{ customer: { orders: CustomerOrder[] } }>(ORDERS_QUERY);
  orders.value = data.customer.orders;
  loaded.value = true;
});
</script>

<template>
  <AccountLayout active="orders">
    <router-link to="/dashboard/orders">← {{ t('dashboard.order.back') }}</router-link>
    <p v-if="loaded && !order" role="alert">{{ t('dashboard.order.notFound') }}</p>
    <template v-else-if="order">
      <h2 data-testid="order-headline">
        {{ t('dashboard.order.headline', { number: order.orderNumber }) }}
      </h2>
      <table class="items">
        <thead>
          <tr>
            <th>{{ t('dashboard.order.item') }}</th>
            <th>{{ t('dashboard.order.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in order.items" :key="item.id">
            <td>{{ item.title }}</td>
            <td>{{ item.amount }}</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>{{ formatPrice(order.cost.total, order.cost.currency.name) }}</strong>
      </p>
    </template>
  </AccountLayout>
</template>

<style scoped>
.items {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}
.items th,
.items td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid var(--oxfe-color-border, #e2e2e2);
}
</style>
