<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { ACCOUNT_QUERY, NEWSLETTER_SUBSCRIBE, NEWSLETTER_UNSUBSCRIBE } from '../api/queries';
import { useDashboardContext } from '../index';

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client } = useDashboardContext();
const email = ref('');
const newsletterStatus = ref('UNSUBSCRIBED');
const busy = ref(false);

onMounted(load);

async function load(): Promise<void> {
  const data = await client.execute<{
    customer: { email: string; newsletterStatus: { status: string } | null };
  }>(ACCOUNT_QUERY);
  email.value = data.customer.email;
  newsletterStatus.value = data.customer.newsletterStatus?.status ?? 'UNSUBSCRIBED';
}

async function toggleNewsletter(): Promise<void> {
  busy.value = true;
  try {
    if (subscribed()) {
      await client.execute(NEWSLETTER_UNSUBSCRIBE, { email: email.value });
    } else {
      await client.execute(NEWSLETTER_SUBSCRIBE, { email: email.value });
    }
    await load();
  } finally {
    busy.value = false;
  }
}

/** Subscribing yields MISSING_DOUBLE_OPTIN until the shopper confirms by email. */
function subscribed(): boolean {
  return newsletterStatus.value === 'SUBSCRIBED' || pending();
}

function pending(): boolean {
  return newsletterStatus.value === 'MISSING_DOUBLE_OPTIN';
}
</script>

<template>
  <section>
    <h1>{{ t('dashboard.home.headline') }}</h1>
    <p data-testid="account-email">{{ email }}</p>
    <nav class="tiles">
      <router-link to="/dashboard/orders" data-testid="tile-orders">{{
        t('dashboard.home.orders')
      }}</router-link>
      <router-link to="/dashboard/addresses" data-testid="tile-addresses">{{
        t('dashboard.home.addresses')
      }}</router-link>
      <router-link to="/dashboard/profile" data-testid="tile-profile">{{
        t('dashboard.home.profile')
      }}</router-link>
    </nav>
    <p>
      {{ t('dashboard.home.newsletter') }}:
      <span data-testid="newsletter-status">{{
        pending()
          ? t('dashboard.home.pending')
          : subscribed()
            ? t('dashboard.home.subscribed')
            : t('dashboard.home.unsubscribed')
      }}</span>
      <button
        type="button"
        :disabled="busy"
        data-testid="newsletter-toggle"
        @click="toggleNewsletter"
      >
        {{ subscribed() ? t('dashboard.home.unsubscribe') : t('dashboard.home.subscribe') }}
      </button>
    </p>
  </section>
</template>

<style scoped>
.tiles {
  display: flex;
  gap: 16px;
  margin: 16px 0;
}
.tiles a {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  padding: 16px 24px;
  text-decoration: none;
}
button {
  margin-left: 12px;
}
</style>
