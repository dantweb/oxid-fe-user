<script setup lang="ts">
import { CATALOG_READ } from '../../shop/api/cachePolicy';
import { formatPrice } from '@dantweb/oxid-fe-core';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ProductListItem } from '../../shop/api/queries';
import { usePeroxidContext } from '../index';
import { streamRequest, type StreamConfig } from '../streams';

const props = defineProps<{ stream: StreamConfig }>();

const { t, te } = useI18n();
const { client } = usePeroxidContext();

const products = ref<ProductListItem[]>([]);
const state = ref<'loading' | 'ready' | 'empty'>('loading');
const track = ref<HTMLElement | null>(null);

const title =
  props.stream.title ??
  (te(`peroxid.streams.${props.stream.id}`)
    ? t(`peroxid.streams.${props.stream.id}`)
    : props.stream.id);

onMounted(async () => {
  const request = streamRequest(props.stream);
  try {
    const data = await client.execute<Record<string, unknown>>(
      request.document,
      request.variables,
      CATALOG_READ,
    );
    products.value = request.pick(data);
  } catch {
    products.value = [];
  }
  state.value = products.value.length > 0 ? 'ready' : 'empty';
});

function scroll(direction: 1 | -1): void {
  const element = track.value;
  element?.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: 'smooth' });
}
</script>

<template>
  <section
    v-if="state !== 'empty'"
    :id="`pxd-stream-${stream.id}`"
    class="pxd-rail"
    :data-testid="`pxd-rail-${stream.id}`"
  >
    <header class="pxd-rail__head">
      <h2 data-testid="pxd-rail-title">{{ title }}</h2>
      <div class="pxd-rail__nav">
        <button
          type="button"
          :aria-label="t('peroxid.streams.prev')"
          data-testid="pxd-rail-prev"
          @click="scroll(-1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button
          type="button"
          :aria-label="t('peroxid.streams.next')"
          data-testid="pxd-rail-next"
          @click="scroll(1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </header>

    <ul ref="track" class="pxd-rail__track" data-testid="pxd-rail-track">
      <template v-if="state === 'loading'">
        <li v-for="n in 4" :key="n" class="pxd-card pxd-card--skeleton" aria-hidden="true" />
      </template>
      <li
        v-for="product in products"
        v-else
        :key="product.id"
        class="pxd-card"
        data-testid="pxd-card"
      >
        <router-link :to="`/shop/product/${product.id}`">
          <div class="pxd-card__media">
            <img :src="product.imageGallery.thumb" :alt="product.title" loading="lazy" />
          </div>
          <h3>{{ product.title }}</h3>
          <p>{{ formatPrice(product.price.price, product.price.currency.name) }}</p>
        </router-link>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pxd-rail {
  margin-bottom: 56px;
  min-width: 0;
}
.pxd-rail__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--oxfe-color-border, #e4ded3);
}
h2 {
  margin: 0;
  font-family: var(--oxfe-font-heading, sans-serif);
  font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 500;
}
.pxd-rail__nav {
  display: none;
  gap: 8px;
}
.pxd-rail__nav button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--oxfe-color-border, #e4ded3);
  border-radius: 50%;
  background: transparent;
  color: var(--oxfe-color-text, #15130f);
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}
.pxd-rail__nav button:hover {
  background: var(--oxfe-color-primary, #15130f);
  color: var(--oxfe-color-primary-contrast, #fbf9f6);
}
.pxd-rail__nav svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* arrow buttons only on wide screens with a mouse; phones and tablets swipe */
@media (min-width: 900px) and (hover: hover) and (pointer: fine) {
  .pxd-rail__nav {
    display: flex;
  }
}
.pxd-rail__track {
  display: flex;
  gap: 16px;
  margin: 0;
  padding: 0 0 12px;
  overflow-x: auto;
  list-style: none;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.pxd-rail__track::-webkit-scrollbar {
  display: none;
}
/* phones: ~72% wide so the next card peeks in — the swipe affordance */
.pxd-card {
  flex: 0 0 72%;
  min-width: 0;
  scroll-snap-align: start;
}
@media (min-width: 600px) {
  .pxd-card {
    flex-basis: 240px;
  }
}
.pxd-card a {
  display: block;
  color: inherit;
  text-decoration: none;
}
.pxd-card__media {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 5;
  padding: 16px;
  border-radius: var(--oxfe-radius-md, 6px);
  background: var(--oxfe-color-surface, #f1ede6);
  transition: transform 0.3s ease;
}
.pxd-card a:hover .pxd-card__media {
  transform: translateY(-4px);
}
.pxd-card img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.pxd-card h3 {
  margin: 14px 0 4px;
  overflow: hidden;
  font-size: 0.95rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pxd-card p {
  margin: 0;
  color: var(--oxfe-color-text-muted, #6b655b);
  font-size: 0.9rem;
}
.pxd-card--skeleton {
  aspect-ratio: 4 / 5;
  border-radius: var(--oxfe-radius-md, 6px);
  background: var(--oxfe-color-surface, #f1ede6);
  animation: pxd-pulse 1.4s ease-in-out infinite;
}
@keyframes pxd-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
