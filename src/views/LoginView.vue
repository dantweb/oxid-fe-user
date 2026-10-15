<script setup lang="ts">
import { GraphqlError } from '@dantweb/oxid-fe-core';
import { useHead } from '@unhead/vue';
import { inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { coreKey } from '../core';

const core = inject(coreKey);
if (!core) {
  throw new Error('LoginView needs the app core');
}
const { t } = useI18n();
useHead({
  title: () => `${t('login.headline')} · ${t('app.title')}`,
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
});
const route = useRoute();
const router = useRouter();
const authStore = core.useAuthStore();

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await authStore.login(email.value, password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.push(redirect);
  } catch (cause) {
    error.value = cause instanceof GraphqlError ? cause.message : t('login.failed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="login">
    <h1>{{ t('login.headline') }}</h1>
    <form data-testid="login-form" @submit.prevent="submit">
      <label>
        {{ t('login.email') }}
        <input v-model="email" type="email" name="email" required autocomplete="username" />
      </label>
      <label>
        {{ t('login.password') }}
        <input
          v-model="password"
          type="password"
          name="password"
          required
          autocomplete="current-password"
        />
      </label>
      <p v-if="error" class="login__error" role="alert" data-testid="login-error">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ t('login.submit') }}</button>
    </form>
  </section>
</template>

<style scoped>
.login {
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
input {
  padding: 8px;
  border: 1px solid var(--oxfe-color-input-border, #ccc);
  border-radius: var(--oxfe-radius-sm, 4px);
}
.login__error {
  color: var(--oxfe-color-danger, #b00020);
}
</style>
