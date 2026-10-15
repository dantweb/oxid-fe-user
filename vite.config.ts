import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const shopUrl = env.VITE_SHOP_URL ?? 'http://localhost.local';

  return {
    plugins: [vue()],
    resolve: {
      // @dantweb/oxid-fe-core is consumed as a file: link; without dedupe the
      // bundler resolves its externalized vue/pinia/vue-router imports to the
      // library's OWN node_modules copy -> two pinia instances, broken stores.
      dedupe: ['vue', 'pinia', 'vue-router', 'zod'],
    },
    server: {
      host: true,
      port: 5173,
      // Same-origin in dev too: the app always talks to /graphql/ on its own origin.
      proxy: {
        '/graphql': { target: shopUrl, changeOrigin: true },
        '/out/pictures': { target: shopUrl, changeOrigin: true },
      },
    },
    test: {
      environment: 'happy-dom',
      include: ['tests/unit/**/*.spec.ts'],
      exclude: [...configDefaults.exclude, 'tests/e2e/**'],
      coverage: {
        provider: 'v8',
        include: ['src/**', 'plugins/**'],
        reporter: ['text-summary', 'json-summary'],
        reportsDirectory: 'coverage',
      },
    },
  };
});
