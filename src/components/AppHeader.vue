<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { coreKey } from '../core';
import LocaleSwitcher from './LocaleSwitcher.vue';

const core = inject(coreKey);
if (!core) {
  throw new Error('AppHeader needs the app core');
}
const { t } = useI18n();
const router = useRouter();
const authStore = core.useAuthStore();

const navItems = computed(() =>
  core.registry.navItems.filter((item) => !item.requiresAuth || authStore.authenticated),
);

function logout(): void {
  authStore.logout();
  void router.push('/');
}
</script>

<template>
  <header class="header">
    <nav class="header__nav">
      <router-link to="/" class="header__brand">{{ t('app.title') }}</router-link>
      <router-link v-for="item in navItems" :key="item.to" :to="item.to">
        {{ t(item.labelKey) }}
      </router-link>
    </nav>
    <nav class="header__nav">
      <LocaleSwitcher />
      <span v-if="authStore.authenticated" data-testid="header-username">
        {{ authStore.username }}
      </span>
      <router-link v-if="!authStore.authenticated" to="/login" data-testid="nav-login">
        {{ t('nav.login') }}
      </router-link>
      <button v-else type="button" data-testid="nav-logout" @click="logout">
        {{ t('nav.logout') }}
      </button>
    </nav>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-bottom: 1px solid #e2e2e2;
}
.header__nav {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header__brand {
  font-weight: 700;
  text-decoration: none;
}
</style>
