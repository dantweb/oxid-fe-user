<script setup lang="ts">
import { defineAsyncComponent, inject } from 'vue';
import AppFooter from './components/AppFooter.vue';
import AppHeader from './components/AppHeader.vue';
import SessionExpiredBanner from './components/SessionExpiredBanner.vue';
import { coreKey } from './core';
import { resolveLayoutView } from './layout';

const core = inject(coreKey);
if (!core) {
  throw new Error('App needs the app core');
}
// a layout plugin (e.g. peroxid) may take over the header and footer
const Header = resolveLayoutView(core.registry, 'header', AppHeader);
const Footer = resolveLayoutView(core.registry, 'footer', AppFooter);
// global components plugins contribute (cookie consent, banners …)
const overlays = core.registry.overlays().map((loader) => defineAsyncComponent(loader));
</script>

<template>
  <div class="app">
    <SessionExpiredBanner />
    <component :is="Header" />
    <main class="app__main">
      <router-view />
    </main>
    <component :is="Footer" />
    <component :is="overlay" v-for="(overlay, index) in overlays" :key="index" />
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: var(--oxfe-font-family, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
  color: var(--oxfe-color-text, #1a1a1a);
  background: var(--oxfe-color-background, #fff);
}
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app__main {
  flex: 1;
  width: min(var(--oxfe-container-max-width, 1100px), 100% - 32px);
  margin: 0 auto;
  padding: 24px 0;
}
a {
  color: var(--oxfe-color-link, #0a5d9c);
}
button {
  cursor: pointer;
}
</style>
