<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { useDashboardContext } from '../index';
import { buildAccountMenu, type AccountPage } from '../menu';
import { refreshSummary, summary } from '../state';

const props = defineProps<{ active: AccountPage }>();

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client } = useDashboardContext();
const EMPTY = { orders: 0, reviews: 0, downloads: 0, wishlist: 0, giftRegistry: 0 };
const open = ref(false);
const entries = computed(() =>
  summary.value ? buildAccountMenu(summary.value.counts) : buildAccountMenu(EMPTY),
);

const loadFailed = ref(false);

onMounted(async () => {
  try {
    await refreshSummary(client);
  } catch {
    loadFailed.value = true;
  }
});

function isActive(key: AccountPage): boolean {
  return key === props.active;
}
</script>

<template>
  <section class="account" data-testid="account-layout">
    <header class="account__head">
      <h1 class="account__hello" data-testid="account-hello">
        {{ t('dashboard.hello') }} {{ summary?.firstName }}
      </h1>
      <div class="account__menu">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary account__toggle"
          :aria-expanded="open"
          aria-haspopup="true"
          data-testid="account-menu-toggle"
          @click="open = !open"
        >
          {{ t('dashboard.menu.whereTo') }}
        </button>
        <nav v-show="open" class="account__dropdown" data-testid="account-menu">
          <router-link
            v-for="entry in entries"
            :key="entry.key"
            :to="entry.to"
            class="account__item"
            :class="{ 'account__item--active': isActive(entry.key) }"
            :aria-current="isActive(entry.key) ? 'page' : undefined"
            :data-testid="`account-menu-${entry.key}`"
            @click="open = false"
          >
            {{ t(`dashboard.${entry.labelKey}`) }}
            <span v-if="entry.badge" class="badge" :data-testid="`account-badge-${entry.key}`">{{
              entry.badge
            }}</span>
          </router-link>
        </nav>
      </div>
    </header>
    <p v-if="loadFailed" class="alert alert-danger" role="alert" data-testid="account-load-failed">
      {{ t('dashboard.loadFailed') }}
    </p>
    <slot :summary="summary" />
  </section>
</template>

<style scoped>
.account__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.account__hello {
  margin: 0;
  font-size: 1.5rem;
}
.account__menu {
  position: relative;
}
.account__dropdown {
  position: absolute;
  right: 0;
  z-index: 10;
  display: flex;
  min-width: 14rem;
  flex-direction: column;
  margin-top: 0.25rem;
  padding: 0.5rem 0;
  border: 1px solid var(--oxfe-color-border, #e2e2e2);
  border-radius: 0.375rem;
  background: var(--oxfe-color-background, #fff);
  box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 15%);
}
.account__item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 1rem;
  color: var(--oxfe-color-text, #1a1a1a);
  text-decoration: none;
}
.account__item:hover {
  background: var(--oxfe-color-surface, #f7f7f7);
}
.account__item--active {
  background: var(--oxfe-color-primary, #0a5d9c);
  color: var(--oxfe-color-primary-contrast, #fff);
}
</style>
