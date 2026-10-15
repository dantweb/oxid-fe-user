<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
useHead({
  title: () => t('app.title'),
  meta: [{ name: 'description', content: () => t('home.intro') }],
});
</script>

<template>
  <section>
    <h1>{{ t('home.headline') }}</h1>
    <p>{{ t('home.intro') }}</p>
    <router-link to="/shop" data-testid="home-to-catalog">{{ t('home.toCatalog') }}</router-link>
  </section>
</template>
