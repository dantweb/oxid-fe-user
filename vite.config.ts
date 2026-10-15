import { existsSync, readFileSync } from 'node:fs';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';

/** Dev/preview twin of nginx's /oxid-config.yaml: the local file, else the committed .dist. */
function serveInstanceConfig(): Plugin {
  const middleware: Connect.NextHandleFunction = (_request, response) => {
    const file = ['oxid-config.yaml', 'oxid-config.yaml.dist'].find((candidate) =>
      existsSync(candidate),
    );
    response.setHeader('Content-Type', 'application/yaml');
    response.setHeader('Cache-Control', 'no-store');
    response.end(file ? readFileSync(file) : '');
  };
  return {
    name: 'oxid-instance-config',
    configureServer: (server) => void server.middlewares.use('/oxid-config.yaml', middleware),
    configurePreviewServer: (server) =>
      void server.middlewares.use('/oxid-config.yaml', middleware),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const shopUrl = env.VITE_SHOP_URL ?? 'http://localhost.local';

  return {
    plugins: [vue(), serveInstanceConfig()],
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
