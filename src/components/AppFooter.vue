<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <footer class="footer">
    <span>{{ t('app.title') }}</span>
  </footer>
</template>

<style scoped>
.footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e2e2;
  color: #666;
  font-size: 14px;
}
</style>
