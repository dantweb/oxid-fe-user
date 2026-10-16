<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { coreKey } from '../core';

const core = inject(coreKey);
if (!core) {
  throw new Error('ForgotPasswordView needs the app core');
}
const { t } = useI18n();
useHead({
  title: () => `${t('forgot.headline')} · ${t('app.title')}`,
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
});

const FORGOT = /* GraphQL */ `
  mutation forgotPassword($email: String!) {
    customerPasswordForgotRequest(email: $email)
  }
`;

const email = ref('');
const sent = ref(false);
const busy = ref(false);

/** The answer never says whether the address is known — no account enumeration. */
async function submit(): Promise<void> {
  busy.value = true;
  try {
    await core!.client.execute(FORGOT, { email: email.value });
  } catch {
    // unknown address or mail trouble: the shopper sees the same neutral answer
  } finally {
    sent.value = true;
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-form">
    <h1>{{ t('forgot.headline') }}</h1>
    <p v-if="sent" class="alert alert-success" data-testid="forgot-sent">{{ t('forgot.sent') }}</p>
    <form v-else data-testid="forgot-form" @submit.prevent="submit">
      <p>{{ t('forgot.intro') }}</p>
      <label>
        {{ t('login.email') }}
        <input v-model="email" class="form-control" type="email" name="email" required />
      </label>
      <button class="btn btn-primary" type="submit" :disabled="busy" data-testid="forgot-submit">
        {{ t('forgot.submit') }}
      </button>
    </form>
    <p>
      <router-link to="/login" class="btn btn-link">{{ t('forgot.back') }}</router-link>
    </p>
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
