<script setup lang="ts">
import { CoreEvents } from '@dantweb/oxid-fe-core';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '../../shop/stores/cart';
import { usePeroxidContext } from '../index';
import { useCompact } from '../useCompact';
import SearchBox from './SearchBox.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { auth, events, registry } = usePeroxidContext();
const cart = useCartStore();
const compact = useCompact();

const authenticated = ref(auth.isAuthenticated());
const refresh = (): void => {
  authenticated.value = auth.isAuthenticated();
};
const unsubscribe = [CoreEvents.AuthLogin, CoreEvents.AuthLogout, CoreEvents.SessionExpired].map(
  (event) => events.on(event, refresh),
);
onBeforeUnmount(() => unsubscribe.forEach((off) => off()));

// the cart is the icon, not a text link
const navItems = computed(() =>
  registry.navItems.filter(
    (item) => item.to !== '/shop/cart' && (!item.requiresAuth || authenticated.value),
  ),
);

const menuOpen = ref(false);
const searchOpen = ref(false);
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
    searchOpen.value = false;
  },
);
watch(compact, (isCompact) => {
  if (!isCompact) {
    menuOpen.value = false;
    searchOpen.value = false;
  }
});

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value;
  searchOpen.value = false;
}
function toggleSearch(): void {
  searchOpen.value = !searchOpen.value;
  menuOpen.value = false;
}
function logout(): void {
  auth.logout();
  menuOpen.value = false;
  void router.push('/');
}
</script>

<template>
  <header class="pxd-header" data-testid="pxd-header">
    <div class="pxd-header__inner" data-testid="pxd-header-inner">
      <button
        v-if="compact"
        type="button"
        class="pxd-iconbtn"
        :aria-label="t('peroxid.menu')"
        :aria-expanded="menuOpen"
        data-testid="pxd-menu-toggle"
        @click="toggleMenu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="!menuOpen" d="M4 8h16M4 16h16" />
          <path v-else d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <router-link to="/" class="pxd-brand" data-testid="pxd-brand">{{
        t('app.title')
      }}</router-link>

      <nav v-if="!compact" class="pxd-nav" aria-label="Primary">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          data-testid="pxd-nav-link"
        >
          {{ t(item.labelKey) }}
        </router-link>
      </nav>

      <div v-if="!compact" class="pxd-header__search">
        <SearchBox />
      </div>

      <div class="pxd-actions">
        <button
          v-if="compact"
          type="button"
          class="pxd-iconbtn"
          :aria-label="searchOpen ? t('peroxid.search.close') : t('peroxid.search.open')"
          :aria-expanded="searchOpen"
          data-testid="pxd-search-toggle"
          @click="toggleSearch"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </button>

        <router-link
          :to="authenticated ? '/dashboard' : '/login'"
          class="pxd-iconbtn"
          :aria-label="t('peroxid.account')"
          data-testid="pxd-account"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
          </svg>
        </router-link>

        <router-link
          to="/shop/cart"
          class="pxd-iconbtn pxd-cart"
          :aria-label="t('peroxid.cartCount', { count: cart.skuCount })"
          data-testid="pxd-cart"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.5 8.5h13l-1 11h-11z" />
            <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
          </svg>
          <span v-if="cart.skuCount > 0" class="pxd-badge" data-testid="pxd-cart-badge">{{
            cart.skuCount
          }}</span>
        </router-link>
      </div>
    </div>

    <div
      v-if="compact && searchOpen"
      class="pxd-panel pxd-panel--search"
      data-testid="pxd-search-row"
    >
      <SearchBox autofocus @done="searchOpen = false" />
    </div>

    <nav
      v-if="compact && menuOpen"
      class="pxd-panel pxd-drawer"
      data-testid="pxd-drawer"
      aria-label="Primary"
    >
      <router-link v-for="item in navItems" :key="item.to" :to="item.to" data-testid="pxd-nav-link">
        {{ t(item.labelKey) }}
      </router-link>
      <button v-if="authenticated" type="button" data-testid="pxd-logout" @click="logout">
        {{ t('peroxid.logout') }}
      </button>
    </nav>
  </header>
</template>

<style scoped>
.pxd-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--oxfe-color-background, #fbf9f6) 90%, transparent);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--oxfe-color-border, #e4ded3);
}
/* fixed 1200 px content width, fluid (with a 16 px gutter) below it */
.pxd-header__inner {
  display: flex;
  align-items: center;
  gap: 20px;
  width: min(1200px, 100% - 32px);
  min-height: 76px;
  margin: 0 auto;
}
.pxd-brand {
  flex: none;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--oxfe-color-text, #15130f);
  font-family: var(--oxfe-font-heading, sans-serif);
  font-size: 1.15rem;
  font-weight: 500;
  letter-spacing: 0.32em;
  text-decoration: none;
  text-transform: uppercase;
}
.pxd-nav {
  display: flex;
  flex: 1;
  gap: 28px;
  min-width: 0;
  padding-left: 12px;
}
.pxd-nav a {
  position: relative;
  padding: 6px 0;
  color: var(--oxfe-color-text, #15130f);
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-decoration: none;
  text-transform: uppercase;
}
.pxd-nav a::after {
  content: '';
  position: absolute;
  left: 0;
  right: 100%;
  bottom: 0;
  height: 1px;
  background: var(--oxfe-color-accent, #b08d57);
  transition: right 0.25s ease;
}
.pxd-nav a:hover::after,
.pxd-nav a.router-link-active::after {
  right: 0;
}
.pxd-header__search {
  flex: 0 1 320px;
  min-width: 180px;
}
.pxd-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}
.pxd-iconbtn {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--oxfe-color-text, #15130f);
  cursor: pointer;
  transition: background 0.2s;
}
.pxd-iconbtn:hover {
  background: var(--oxfe-color-surface, #f1ede6);
}
.pxd-iconbtn svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.pxd-badge {
  position: absolute;
  top: 3px;
  right: 0;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 10px;
  box-shadow: 0 0 0 2px var(--oxfe-color-background, #fbf9f6);
  background: var(--oxfe-color-primary, #15130f);
  color: var(--oxfe-color-primary-contrast, #fbf9f6);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
.pxd-panel {
  border-top: 1px solid var(--oxfe-color-border, #e4ded3);
  background: var(--oxfe-color-background, #fbf9f6);
}
.pxd-panel--search {
  padding: 10px 16px 14px;
}
.pxd-drawer {
  display: flex;
  flex-direction: column;
  padding: 4px 16px 12px;
}
.pxd-drawer a,
.pxd-drawer button {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  width: 100%; /* the whole row is the tap target, whatever the engine's flex stretching does */
  min-height: 48px;
  border: 0;
  border-bottom: 1px solid var(--oxfe-color-border, #e4ded3);
  background: transparent;
  color: var(--oxfe-color-text, #15130f);
  font: inherit;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-align: left;
  text-decoration: none;
  text-transform: uppercase;
  cursor: pointer;
}

@media (max-width: 899px) {
  .pxd-header__inner {
    gap: 4px;
    min-height: 60px;
  }
  .pxd-brand {
    flex: 1;
    font-size: 0.74rem;
    letter-spacing: 0.14em;
    text-align: center;
  }
}
</style>
