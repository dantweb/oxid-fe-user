<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FILES_QUERY, type CustomerFile } from '../api/queries';
import AccountLayout from '../components/AccountLayout.vue';
import { useDashboardContext } from '../index';

const { t } = useI18n();
const { client } = useDashboardContext();
const files = ref<CustomerFile[]>([]);
const loaded = ref(false);

const failed = ref(false);

onMounted(async () => {
  try {
    const data = await client.execute<{ customer: { files: CustomerFile[] } }>(FILES_QUERY);
    files.value = data.customer.files;
  } catch {
    failed.value = true;
  }
  loaded.value = true;
});
</script>

<template>
  <AccountLayout active="downloads">
    <h2>{{ t('dashboard.menu.downloads') }}</h2>
    <p>{{ t('dashboard.cards.downloadsText') }}</p>
    <p v-if="failed" class="alert alert-danger" role="alert" data-testid="downloads-error">
      {{ t('dashboard.downloads.failed') }}
    </p>
    <p v-else-if="loaded && files.length === 0" data-testid="downloads-empty">
      {{ t('dashboard.downloads.empty') }}
    </p>
    <ul v-else>
      <li v-for="file in files" :key="file.id" data-testid="download-row">
        {{ file.filename }}
        <span class="muted">
          —
          {{
            t('dashboard.downloads.count', { used: file.downloadCount, max: file.maxDownloadCount })
          }}
        </span>
        <em v-if="!file.valid"> ({{ t('dashboard.downloads.expired') }})</em>
      </li>
    </ul>
  </AccountLayout>
</template>

<style scoped>
.muted {
  color: var(--oxfe-color-text-muted, #555);
}
</style>
