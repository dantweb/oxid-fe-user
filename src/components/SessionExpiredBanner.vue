<script setup lang="ts">
import { CoreEvents } from '@dantweb/oxid-fe-core';
import { inject, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { coreKey } from '../core';

const core = inject(coreKey);
if (!core) {
  throw new Error('SessionExpiredBanner needs the app core');
}
const { t } = useI18n();
const visible = ref(false);

const unsubscribe = core.events.on(CoreEvents.SessionExpired, () => {
  visible.value = true;
});
onBeforeUnmount(unsubscribe);
</script>

<template>
  <div v-if="visible" class="banner" role="alert" data-testid="session-expired">
    <span>{{ t('session.expired') }}</span>
    <router-link to="/login" @click="visible = false">{{ t('nav.login') }}</router-link>
    <button type="button" @click="visible = false">{{ t('session.dismiss') }}</button>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: #fff3cd;
  border-bottom: 1px solid #e0c668;
}
</style>
