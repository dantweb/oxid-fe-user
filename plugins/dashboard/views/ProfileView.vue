<script setup lang="ts">
import { GraphqlError } from '@dantweb/oxid-fe-core';
import { ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { PASSWORD_CHANGE } from '../api/queries';
import { useDashboardContext } from '../index';

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client, auth } = useDashboardContext();
const oldPassword = ref('');
const newPassword = ref('');
const changed = ref(false);
const error = ref<string | null>(null);
const busy = ref(false);

async function changePassword(): Promise<void> {
  busy.value = true;
  changed.value = false;
  error.value = null;
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
  } catch (cause) {
    error.value = cause instanceof GraphqlError ? cause.message : t('dashboard.profile.failed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section>
    <h1>{{ t('dashboard.profile.headline') }}</h1>
    <h2>{{ t('dashboard.profile.password') }}</h2>
    <form class="password" data-testid="password-form" @submit.prevent="changePassword">
      <label>
        {{ t('dashboard.profile.oldPassword') }}
        <input
          v-model="oldPassword"
          type="password"
          name="oldPassword"
          required
          autocomplete="current-password"
        />
      </label>
      <label>
        {{ t('dashboard.profile.newPassword') }}
        <input
          v-model="newPassword"
          type="password"
          name="newPassword"
          required
          autocomplete="new-password"
        />
      </label>
      <p v-if="error" role="alert" data-testid="password-error">{{ error }}</p>
      <p v-if="changed" data-testid="password-changed">{{ t('dashboard.profile.changed') }}</p>
      <button type="submit" :disabled="busy" data-testid="change-password">
        {{ t('dashboard.profile.change') }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.password {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 360px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
