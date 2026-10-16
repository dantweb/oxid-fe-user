import { existsSync, readFileSync } from 'node:fs';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import { renderPublicConfig } from './scripts/public-config.mjs';

/**
 * Dev/preview twin of nginx: serves the RENDERED public config (/oxid-config.json — allow-list and
 * secret guard, see scripts/public-config.mjs) from the local oxid-config.yaml (else the committed
 * .dist), and answers 404 for the YAML and the instance folders: the raw deployment config is
 * never served, not even by the dev server (which would otherwise expose the project root).
 */
function serveInstanceConfig(): Plugin {
  const json: Connect.NextHandleFunction = (_request, response) => {
    const file = ['oxid-config.yaml', 'oxid-config.yaml.dist'].find((candidate) =>
      existsSync(candidate),
    );
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    try {
      response.end(file ? renderPublicConfig(readFileSync(file, 'utf-8')) : '{}');
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error instanceof Error ? error.message : error));
    }
  };
  const hidden: Connect.NextHandleFunction = (_request, response) => {
    response.statusCode = 404;
    response.end('Not found');
  };
  const install = (use: Connect.Server['use']): void => {
    use('/oxid-config.json', json);
    for (const path of ['/oxid-config.yaml', '/oxid-config.yaml.dist', '/instances']) {
      use(path, hidden);
    }
  };
  return {
    name: 'oxid-instance-config',
    configureServer: (server) => install(server.middlewares.use.bind(server.middlewares)),
    configurePreviewServer: (server) => install(server.middlewares.use.bind(server.middlewares)),
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
      // belt and braces: the dev server never reads deployment configs from disk for a browser
      fs: { deny: ['.env', '.env.*', 'oxid-config.yaml*', 'instances/**', '**/*.pem', '**/*.key'] },
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
