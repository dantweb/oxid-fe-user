<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AccountLayout from '../components/AccountLayout.vue';
import { summary } from '../state';

const { t } = useI18n();

/** A card is a heading, an optional line of text and a "More" button that links the whole card. */
function newsletterLabel(status: string): string {
  if (status === 'SUBSCRIBED') return t('dashboard.newsletter.subscribed');
  if (status === 'MISSING_DOUBLE_OPTIN') return t('dashboard.newsletter.pending');
  return t('dashboard.newsletter.unsubscribed');
}
</script>

<template>
  <AccountLayout active="dashboard">
    <p v-if="summary" class="account-email" data-testid="account-email">{{ summary.email }}</p>
    <div v-if="summary" class="cards" data-testid="account-cards">
      <div class="card card-lg" data-testid="card-orders">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.orders') }}</h2>
        <div class="card-body">
          <p class="card-text" data-testid="card-orders-count">
            {{ t('dashboard.cards.orders') }} {{ summary.counts.orders }}
          </p>
          <router-link
            to="/dashboard/orders"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-orders-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div class="card card-lg" data-testid="card-password">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.password') }}</h2>
        <div class="card-body">
          <router-link
            to="/dashboard/password"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-password-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div class="card card-lg" data-testid="card-newsletter">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.newsletter') }}</h2>
        <div class="card-body">
          <p class="card-text" data-testid="newsletter-status">
            {{ newsletterLabel(summary.newsletterStatus) }}
          </p>
          <router-link
            to="/dashboard/newsletter"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-newsletter-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div class="card card-lg" data-testid="card-addresses">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.addresses') }}</h2>
        <div class="card-body">
          <router-link
            to="/dashboard/addresses"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-addresses-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div v-if="summary.counts.downloads > 0" class="card card-lg" data-testid="card-downloads">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.downloads') }}</h2>
        <div class="card-body">
          <p class="card-text">{{ t('dashboard.cards.downloadsText') }}</p>
          <router-link
            to="/dashboard/downloads"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-downloads-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div class="card card-lg" data-testid="card-wishlist">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.wishlist') }}</h2>
        <div class="card-body">
          <p class="card-text" data-testid="card-wishlist-count">
            {{ t('dashboard.cards.products') }} {{ summary.counts.wishlist }}
          </p>
          <router-link
            to="/dashboard/wishlist"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-wishlist-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div class="card card-lg" data-testid="card-giftRegistry">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.giftRegistry') }}</h2>
        <div class="card-body">
          <p class="card-text" data-testid="card-giftRegistry-count">
            {{ t('dashboard.cards.products') }} {{ summary.counts.giftRegistry }}
          </p>
          <router-link
            to="/dashboard/gift-registry"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-giftRegistry-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div v-if="summary.counts.reviews > 0" class="card card-lg" data-testid="card-reviews">
        <h2 class="h4 card-header card-title">{{ t('dashboard.menu.reviews') }}</h2>
        <div class="card-body">
          <p class="card-text" data-testid="card-reviews-count">
            {{ t('dashboard.menu.reviews') }} {{ summary.counts.reviews }}
          </p>
          <router-link
            to="/dashboard/reviews"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-reviews-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>

      <div class="card card-lg" data-testid="card-delete">
        <h2 class="h4 card-header card-title">{{ t('dashboard.delete.headline') }}</h2>
        <div class="card-body">
          <p class="card-text">{{ t('dashboard.delete.cardText') }}</p>
          <router-link
            to="/dashboard/delete"
            class="btn btn-outline-primary stretched-link"
            data-testid="card-delete-more"
            >{{ t('dashboard.cards.more') }}</router-link
          >
        </div>
      </div>
    </div>
  </AccountLayout>
</template>

<style scoped>
.account-email {
  margin: 0 0 1rem;
  color: var(--oxfe-color-text-muted, #555);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1rem;
}
.card-text {
  margin: 0 0 1rem;
}
.h4 {
  font-size: 1.25rem;
}
</style>
