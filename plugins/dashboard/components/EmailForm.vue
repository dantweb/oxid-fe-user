<script setup lang="ts">
import ErrorAlert from '../../../src/errors/ErrorAlert.vue';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { EMAIL_UPDATE } from '../api/queries';
import { useDashboardContext } from '../index';
import { refreshSummary, summary } from '../state';

const { t } = useI18n();
const { client } = useDashboardContext();
const email = ref(summary.value?.email ?? '');
const saved = ref(false);
const error = ref<unknown>(null);
const busy = ref(false);

watch(
  () => summary.value?.email,
  (current) => {
    if (current && !email.value) {
      email.value = current;
    }
  },
);

async function save(): Promise<void> {
  busy.value = true;
  saved.value = false;
  error.value = null;
  try {
    await client.execute(EMAIL_UPDATE, { email: email.value });
    await refreshSummary(client);
    saved.value = true;
  } catch (cause) {
    error.value = cause ?? new Error('unknown');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="email" data-testid="email-form" @submit.prevent="save">
    <label>
      {{ t('dashboard.email.label') }}
      <input v-model="email" class="form-control" type="email" name="email" required />
    </label>
    <ErrorAlert
      v-if="error"
      :error="error"
      fallback="dashboard.email.failed"
      class="alert alert-danger"
      role="alert"
      data-testid="email-error"
    />
    <p v-if="saved" class="alert alert-success" data-testid="email-saved">
      {{ t('dashboard.email.saved') }}
    </p>
    <button type="submit" class="btn btn-primary" :disabled="busy" data-testid="save-email">
      {{ t('dashboard.email.save') }}
    </button>
  </form>
</template>

<style scoped>
.email {
  display: flex;
  max-width: 24rem;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
