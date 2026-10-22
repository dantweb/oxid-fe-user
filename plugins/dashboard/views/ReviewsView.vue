<script setup lang="ts">
import ErrorAlert from '../../../src/errors/ErrorAlert.vue';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { REVIEW_DELETE, REVIEWS_QUERY, type CustomerReview } from '../api/queries';
import AccountLayout from '../components/AccountLayout.vue';
import { useDashboardContext } from '../index';
import { refreshSummary } from '../state';

const { t } = useI18n();
const { client } = useDashboardContext();
const reviews = ref<CustomerReview[]>([]);
const loaded = ref(false);
const error = ref<unknown>(null);

onMounted(load);

async function load(): Promise<void> {
  const data = await client.execute<{ customer: { reviews: CustomerReview[] } }>(REVIEWS_QUERY);
  reviews.value = data.customer.reviews;
  loaded.value = true;
}

async function remove(review: CustomerReview): Promise<void> {
  error.value = null;
  try {
    await client.execute(REVIEW_DELETE, { id: review.id });
    await load();
    await refreshSummary(client);
  } catch (cause) {
    // the shop may not let customers manage their reviews (an OXID setting): say so
    error.value = cause ?? new Error('unknown');
  }
}
</script>

<template>
  <AccountLayout active="reviews">
    <h2>{{ t('dashboard.menu.reviews') }}</h2>
    <p v-if="loaded && reviews.length === 0" data-testid="reviews-empty">
      {{ t('dashboard.reviews.empty') }}
    </p>
    <ErrorAlert
      v-if="error"
      :error="error"
      fallback="dashboard.reviews.failed"
      class="alert alert-danger"
      role="alert"
      data-testid="reviews-error"
    />
    <ul v-if="reviews.length > 0" class="reviews">
      <li v-for="review in reviews" :key="review.id" data-testid="review-row">
        <strong v-if="review.product">{{ review.product.title }}</strong>
        <span v-if="review.rating"> — {{ review.rating }} / 5</span>
        <p>{{ review.text }}</p>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          data-testid="review-delete"
          @click="remove(review)"
        >
          {{ t('dashboard.remove') }}
        </button>
      </li>
    </ul>
  </AccountLayout>
</template>

<style scoped>
.reviews {
  padding: 0;
  list-style: none;
}
.reviews li {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--oxfe-color-border, #e2e2e2);
}
</style>
