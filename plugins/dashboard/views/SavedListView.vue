<script setup lang="ts">
import {
  createSavedListsApi,
  type SavedList,
  type SavedListItem,
  type SavedListKind,
} from '@dantweb/oxid-fe-core';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AccountLayout from '../components/AccountLayout.vue';
import { useDashboardContext } from '../index';
import { refreshSummary } from '../state';

/** Wish list (`noticelist`) and gift registry (`wishlist`) — one list view, as in Apex. */
const props = defineProps<{ kind: SavedListKind }>();

const { t } = useI18n();
const { client } = useDashboardContext();
const lists = createSavedListsApi(client);
const list = ref<SavedList | null>(null);
const loaded = ref(false);
const busy = ref(false);

const page = props.kind === 'noticelist' ? 'wishlist' : 'giftRegistry';
const id = page; // test ids: wishlist-* / giftRegistry-*

onMounted(load);

async function load(): Promise<void> {
  list.value = await lists.get(props.kind);
  loaded.value = true;
}

async function remove(item: SavedListItem): Promise<void> {
  if (!list.value) {
    return;
  }
  busy.value = true;
  try {
    await lists.remove(list.value.id, item);
    await load();
    await refreshSummary(client);
  } finally {
    busy.value = false;
  }
}

async function togglePublic(): Promise<void> {
  if (!list.value) {
    return;
  }
  busy.value = true;
  try {
    await lists.setPublic(list.value.id, !list.value.public);
    await load();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AccountLayout :active="page">
    <h2>{{ t(`dashboard.menu.${page}`) }}</h2>
    <p v-if="loaded && (!list || list.items.length === 0)" :data-testid="`${id}-empty`">
      {{ t(`dashboard.${page}.empty`) }}
    </p>
    <ul v-else-if="list" class="items">
      <li v-for="item in list.items" :key="item.id" :data-testid="`${id}-row`">
        <router-link :to="`/shop/product/${item.product.id}`">{{ item.product.title }}</router-link>
        <span class="amount">× {{ item.amount }}</span>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="busy"
          :data-testid="`${id}-remove`"
          @click="remove(item)"
        >
          {{ t('dashboard.remove') }}
        </button>
      </li>
    </ul>

    <div v-if="kind === 'wishlist' && list" class="visibility">
      <p>
        {{ t('dashboard.giftRegistry.visibility') }}:
        <strong data-testid="giftRegistry-visibility">{{
          list.public ? t('dashboard.giftRegistry.public') : t('dashboard.giftRegistry.private')
        }}</strong>
      </p>
      <button
        type="button"
        class="btn btn-outline-primary"
        :disabled="busy"
        data-testid="giftRegistry-toggle"
        @click="togglePublic"
      >
        {{
          list.public
            ? t('dashboard.giftRegistry.makePrivate')
            : t('dashboard.giftRegistry.makePublic')
        }}
      </button>
    </div>
  </AccountLayout>
</template>

<style scoped>
.items {
  padding: 0;
  list-style: none;
}
.items li {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--oxfe-color-border, #e2e2e2);
}
.items li a {
  flex: 1;
}
.visibility {
  margin-top: 1.5rem;
}
</style>
