<script setup lang="ts">
import ErrorAlert from '../../../src/errors/ErrorAlert.vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { NEWSLETTER_SUBSCRIBE, NEWSLETTER_UNSUBSCRIBE } from '../api/queries';
import AccountLayout from '../components/AccountLayout.vue';
import { useDashboardContext } from '../index';
import { refreshSummary, summary } from '../state';

const { t } = useI18n();
const { client } = useDashboardContext();
const busy = ref(false);
const error = ref<unknown>(null);

const status = computed(() => summary.value?.newsletterStatus ?? 'UNSUBSCRIBED');
/** Subscribing yields MISSING_DOUBLE_OPTIN until the shopper confirms by e-mail. */
const pending = computed(() => status.value === 'MISSING_DOUBLE_OPTIN');
const subscribed = computed(() => status.value === 'SUBSCRIBED' || pending.value);

async function toggle(): Promise<void> {
  if (!summary.value) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await client.execute(subscribed.value ? NEWSLETTER_UNSUBSCRIBE : NEWSLETTER_SUBSCRIBE, {
      email: summary.value.email,
    });
    await refreshSummary(client);
  } catch (cause) {
    error.value = cause ?? new Error('unknown');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AccountLayout active="newsletter">
    <h2>{{ t('dashboard.menu.newsletter') }}</h2>
    <p>
      {{ t('dashboard.newsletter.status') }}:
      <strong data-testid="newsletter-status">{{
        pending
          ? t('dashboard.newsletter.pending')
          : subscribed
            ? t('dashboard.newsletter.subscribed')
            : t('dashboard.newsletter.unsubscribed')
      }}</strong>
    </p>
    <ErrorAlert
      v-if="error"
      :error="error"
      fallback="dashboard.newsletter.failed"
      class="alert alert-danger"
      role="alert"
      data-testid="newsletter-error"
    />
    <button
      type="button"
      class="btn btn-primary"
      :disabled="busy || !summary"
      data-testid="newsletter-toggle"
      @click="toggle"
    >
      {{ subscribed ? t('dashboard.newsletter.unsubscribe') : t('dashboard.newsletter.subscribe') }}
    </button>
  </AccountLayout>
</template>
