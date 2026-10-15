<script setup lang="ts">
import { formatPrice } from '@dantweb/oxid-fe-core';
import { onMounted, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { ORDERS_QUERY, type CustomerOrder } from '../api/queries';
import { useDashboardContext } from '../index';

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client } = useDashboardContext();
const orders = ref<CustomerOrder[]>([]);
const loaded = ref(false);

onMounted(async () => {
  const data = await client.execute<{ customer: { orders: CustomerOrder[] } }>(ORDERS_QUERY);
  orders.value = [...data.customer.orders].sort((a, b) => b.orderNumber - a.orderNumber);
  loaded.value = true;
});

function statusOf(order: CustomerOrder): string {
  if (order.cancelled) {
    return t('dashboard.orders.cancelled');
  }
  return order.paid ? t('dashboard.orders.paid') : t('dashboard.orders.open');
}
</script>

<template>
  <section>
    <h1>{{ t('dashboard.orders.headline') }}</h1>
    <p v-if="loaded && orders.length === 0" data-testid="orders-empty">
      {{ t('dashboard.orders.empty') }}
    </p>
    <table v-else-if="loaded" class="orders">
      <thead>
        <tr>
          <th>{{ t('dashboard.orders.number') }}</th>
          <th>{{ t('dashboard.orders.date') }}</th>
          <th>{{ t('dashboard.orders.total') }}</th>
          <th>{{ t('dashboard.orders.status') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in orders" :key="order.id" data-testid="order-row">
          <td>
            <router-link :to="`/dashboard/orders/${order.id}`"
              >#{{ order.orderNumber }}</router-link
            >
          </td>
          <td>{{ order.ordered ? new Date(order.ordered).toLocaleDateString() : '—' }}</td>
          <td>{{ formatPrice(order.cost.total, order.cost.currency.name) }}</td>
          <td>{{ statusOf(order) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.orders {
  width: 100%;
  border-collapse: collapse;
}
.orders th,
.orders td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid var(--oxfe-color-border, #e2e2e2);
}
</style>
