<script setup lang="ts">
import ErrorAlert from '../errors/ErrorAlert.vue';
import { useHead } from '@unhead/vue';
import { inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { coreKey } from '../core';

const core = inject(coreKey);
if (!core) {
  throw new Error('ResetPasswordView needs the app core');
}
const { t } = useI18n();
useHead({
  title: () => `${t('reset.headline')} · ${t('app.title')}`,
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
});

const RESET = /* GraphQL */ `
  mutation resetPassword($key: String!, $password: String!, $repeat: String!) {
    customerPasswordReset(updateHash: $key, newPassword: $password, repeatPassword: $repeat)
  }
`;

/** The update key the shop's mail carries (`?uid=…`). */
const route = useRoute();
const key = typeof route.query.uid === 'string' ? route.query.uid : '';
const password = ref('');
const repeat = ref('');
const done = ref(false);
const error = ref<unknown>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = null;
  if (password.value !== repeat.value) {
    error.value = t('reset.mismatch');
    return;
  }
  busy.value = true;
  try {
    await core!.client.execute(RESET, {
      key,
      password: password.value,
      repeat: repeat.value,
    });
    done.value = true;
  } catch (cause) {
    error.value = cause ?? new Error('unknown');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-form">
    <h1>{{ t('reset.headline') }}</h1>
    <p v-if="!key" class="alert alert-danger" role="alert" data-testid="reset-nokey">
      {{ t('reset.noKey') }}
    </p>
    <template v-else-if="done">
      <p class="alert alert-success" data-testid="reset-done">{{ t('reset.done') }}</p>
      <router-link to="/login" class="btn btn-primary" data-testid="reset-to-login">{{
        t('login.submit')
      }}</router-link>
    </template>
    <form v-else data-testid="reset-form" @submit.prevent="submit">
      <label>
        {{ t('reset.password') }}
        <input
          v-model="password"
          class="form-control"
          type="password"
          name="password"
          required
          autocomplete="new-password"
        />
      </label>
      <label>
        {{ t('reset.repeat') }}
        <input
          v-model="repeat"
          class="form-control"
          type="password"
          name="repeat"
          required
          autocomplete="new-password"
        />
      </label>
      <ErrorAlert
        v-if="error"
        :error="error"
        fallback="reset.failed"
        class="alert alert-danger"
        role="alert"
        data-testid="reset-error"
      />
      <button class="btn btn-primary" type="submit" :disabled="busy" data-testid="reset-submit">
        {{ t('reset.submit') }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.auth-form {
  max-width: 360px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
