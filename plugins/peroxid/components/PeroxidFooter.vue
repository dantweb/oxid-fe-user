<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const year = new Date().getFullYear();
</script>

<template>
  <footer class="pxd-footer" data-testid="pxd-footer">
    <div class="pxd-footer__inner">
      <span class="pxd-footer__brand">{{ t('app.title') }}</span>
      <nav class="pxd-footer__links">
        <router-link to="/shop">{{ t('peroxid.footer.shop') }}</router-link>
        <router-link to="/search">{{ t('peroxid.footer.search') }}</router-link>
      </nav>
      <small>© {{ year }} {{ t('app.title') }} · {{ t('peroxid.footer.rights') }}</small>
    </div>
  </footer>
</template>

<style scoped>
.pxd-footer {
  margin-top: 72px;
  border-top: 1px solid var(--oxfe-color-border, #e4ded3);
  background: var(--oxfe-color-surface, #f1ede6);
}
.pxd-footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 32px;
  width: min(1200px, 100% - 32px);
  margin: 0 auto;
  padding: 32px 0;
}
.pxd-footer__brand {
  font-family: var(--oxfe-font-heading, sans-serif);
  letter-spacing: 0.3em;
  text-transform: uppercase;
}
.pxd-footer__links {
  display: flex;
  gap: 24px;
}
.pxd-footer__links a {
  color: var(--oxfe-color-text, #15130f);
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-decoration: none;
  text-transform: uppercase;
}
small {
  color: var(--oxfe-color-text-muted, #6b655b);
}
</style>
