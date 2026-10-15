<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section>
    <h1>{{ t('home.headline') }}</h1>
    <p>{{ t('home.intro') }}</p>
    <router-link to="/shop" data-testid="home-to-catalog">{{ t('home.toCatalog') }}</router-link>
  </section>
</template>
