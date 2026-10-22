<script setup lang="ts">
import ErrorAlert from '../../../src/errors/ErrorAlert.vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { CUSTOMER_DELETE } from '../api/queries';
import AccountLayout from '../components/AccountLayout.vue';
import { useDashboardContext } from '../index';

const { t } = useI18n();
const router = useRouter();
const { client, auth } = useDashboardContext();
const busy = ref(false);
const error = ref<unknown>(null);

/** Only the second, explicit step deletes — like Apex's confirmation page. */
async function confirmDelete(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await client.execute(CUSTOMER_DELETE);
    void auth.logout();
    await router.push('/');
  } catch (cause) {
    error.value = cause ?? new Error('unknown');
    busy.value = false;
  }
}
</script>

<template>
  <AccountLayout active="dashboard">
    <h2>{{ t('dashboard.delete.headline') }}</h2>
    <p class="alert alert-danger" data-testid="delete-warning">
      {{ t('dashboard.delete.warning') }}
    </p>
    <ErrorAlert
      v-if="error"
      :error="error"
      fallback="dashboard.delete.failed"
      class="alert alert-danger"
      role="alert"
      data-testid="delete-error"
    />
    <div class="actions">
      <button
        type="button"
        class="btn btn-danger"
        :disabled="busy"
        data-testid="delete-confirm"
        @click="confirmDelete"
      >
        {{ t('dashboard.delete.confirm') }}
      </button>
      <router-link to="/dashboard" class="btn btn-secondary" data-testid="delete-cancel">{{
        t('dashboard.delete.cancel')
      }}</router-link>
    </div>
  </AccountLayout>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.75rem;
}
</style>
