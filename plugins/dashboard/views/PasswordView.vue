<script setup lang="ts">
import { GraphqlError } from '@dantweb/oxid-fe-core';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PASSWORD_CHANGE } from '../api/queries';
import AccountLayout from '../components/AccountLayout.vue';
import { useDashboardContext } from '../index';

const { t } = useI18n();
const { client, auth } = useDashboardContext();
const oldPassword = ref('');
const newPassword = ref('');
const repeatPassword = ref('');
const changed = ref(false);
const error = ref<string | null>(null);
const busy = ref(false);

async function changePassword(): Promise<void> {
  changed.value = false;
  error.value = null;
  if (newPassword.value !== repeatPassword.value) {
    error.value = t('dashboard.password.mismatch');
    return;
  }
  busy.value = true;
  try {
    const data = await client.execute<{ customerPasswordChange: { accessToken: string } }>(
      PASSWORD_CHANGE,
      { old: oldPassword.value, new: newPassword.value },
    );
    // the old session token dies with the old password — adopt the fresh one
    auth.adoptToken(data.customerPasswordChange.accessToken);
    changed.value = true;
    oldPassword.value = '';
    newPassword.value = '';
    repeatPassword.value = '';
  } catch (cause) {
    error.value = cause instanceof GraphqlError ? cause.message : t('dashboard.password.failed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AccountLayout active="password">
    <h2>{{ t('dashboard.menu.password') }}</h2>
    <form class="stack" data-testid="password-form" @submit.prevent="changePassword">
      <label>
        {{ t('dashboard.password.old') }}
        <input
          v-model="oldPassword"
          class="form-control"
          type="password"
          name="oldPassword"
          required
          autocomplete="current-password"
        />
      </label>
      <label>
        {{ t('dashboard.password.new') }}
        <input
          v-model="newPassword"
          class="form-control"
          type="password"
          name="newPassword"
          required
          autocomplete="new-password"
        />
      </label>
      <label>
        {{ t('dashboard.password.repeat') }}
        <input
          v-model="repeatPassword"
          class="form-control"
          type="password"
          name="repeatPassword"
          required
          autocomplete="new-password"
        />
      </label>
      <p v-if="error" class="alert alert-danger" role="alert" data-testid="password-error">
        {{ error }}
      </p>
      <p v-if="changed" class="alert alert-success" data-testid="password-changed">
        {{ t('dashboard.password.changed') }}
      </p>
      <button type="submit" class="btn btn-primary" :disabled="busy" data-testid="change-password">
        {{ t('dashboard.password.change') }}
      </button>
    </form>
  </AccountLayout>
</template>

<style scoped>
.stack {
  display: flex;
  max-width: 24rem;
  flex-direction: column;
  gap: 0.75rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
