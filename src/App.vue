<script setup lang="ts">
import AppFooter from './components/AppFooter.vue';
import AppHeader from './components/AppHeader.vue';
import SessionExpiredBanner from './components/SessionExpiredBanner.vue';
</script>

<template>
  <div class="app">
    <SessionExpiredBanner />
    <AppHeader />
    <main class="app__main">
      <router-view />
    </main>
    <AppFooter />
  </div>
</template>

<style>
body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  color: #1a1a1a;
  background: #fff;
}
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app__main {
  flex: 1;
  width: min(1100px, 100% - 32px);
  margin: 0 auto;
  padding: 24px 0;
}
a {
  color: #0a5d9c;
}
button {
  cursor: pointer;
}
</style>
