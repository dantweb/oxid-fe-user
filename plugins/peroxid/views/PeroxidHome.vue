<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import ProductRail from '../components/ProductRail.vue';
import { useStreams } from '../index';

const { t } = useI18n();
const streams = useStreams();

useHead({
  title: () => t('app.title'),
  meta: [{ name: 'description', content: () => t('peroxid.hero.lead') }],
});
</script>

<template>
  <div class="pxd-home">
    <section class="pxd-hero" data-testid="pxd-hero">
      <div class="pxd-hero__content">
        <p class="pxd-hero__eyebrow">{{ t('peroxid.hero.eyebrow') }}</p>
        <h1 class="pxd-hero__title" data-testid="pxd-hero-title">{{ t('peroxid.hero.title') }}</h1>
        <p class="pxd-hero__lead">{{ t('peroxid.hero.lead') }}</p>
        <div class="pxd-hero__cta">
          <router-link to="/shop" class="pxd-btn pxd-btn--solid" data-testid="pxd-hero-cta">
            {{ t('peroxid.hero.cta') }}
          </router-link>
          <a
            href="#pxd-stream-sales"
            class="pxd-btn pxd-btn--ghost"
            data-testid="pxd-hero-secondary"
          >
            {{ t('peroxid.hero.secondary') }}
          </a>
        </div>
      </div>
    </section>

    <ProductRail v-for="stream in streams" :key="stream.id" :stream="stream" />
  </div>
</template>

<style scoped>
.pxd-hero {
  display: flex;
  align-items: flex-end;
  min-height: clamp(380px, 64vh, 560px);
  margin-bottom: 56px;
  overflow: hidden;
  border-radius: var(--oxfe-radius-lg, 8px);
  color: #fbf9f6;
  /* fallback look; the peroxid theme replaces it with photography */
  background:
    radial-gradient(
      120% 120% at 85% 8%,
      color-mix(in srgb, var(--oxfe-color-accent, #b08d57) 40%, transparent),
      transparent 55%
    ),
    linear-gradient(135deg, #0e0d0b, #26211a 60%, #15130f);
  background-size: cover;
}
.pxd-hero__content {
  max-width: 640px;
  padding: clamp(24px, 5vw, 64px);
}
.pxd-hero__eyebrow {
  margin: 0 0 16px;
  color: var(--oxfe-color-accent, #b08d57);
  font-size: 0.75rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}
.pxd-hero__title {
  margin: 0 0 16px;
  font-family: var(--oxfe-font-heading, Georgia, serif);
  font-size: clamp(2.1rem, 7vw, 3.75rem);
  font-weight: 500;
  line-height: 1.08;
}
.pxd-hero__lead {
  margin: 0 0 28px;
  max-width: 46ch;
  font-size: clamp(0.95rem, 2.4vw, 1.1rem);
  line-height: 1.6;
  opacity: 0.88;
}
.pxd-hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.pxd-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 28px;
  border: 1px solid #fbf9f6;
  border-radius: 999px;
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-decoration: none;
  text-transform: uppercase;
  transition:
    background 0.25s,
    color 0.25s;
}
.pxd-btn--solid {
  background: #fbf9f6;
  color: #15130f;
}
.pxd-btn--solid:hover {
  background: var(--oxfe-color-accent, #b08d57);
  border-color: var(--oxfe-color-accent, #b08d57);
}
.pxd-btn--ghost {
  background: transparent;
  color: #fbf9f6;
}
.pxd-btn--ghost:hover {
  background: rgba(251, 249, 246, 0.14);
}
@media (max-width: 600px) {
  .pxd-hero__cta {
    flex-direction: column;
  }
  .pxd-btn {
    width: 100%;
    padding: 0 16px;
    font-size: 0.74rem;
    letter-spacing: 0.12em;
    white-space: nowrap;
  }
}
</style>
