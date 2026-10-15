<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section>
    <h1>{{ t('notFound.headline') }}</h1>
    <router-link to="/">{{ t('nav.home') }}</router-link>
  </section>
</template>
