#!/usr/bin/env node
/**
 * Build-time prerenderer (ADR-003): serves dist/ with `vite preview`, renders the
 * indexable routes in Playwright chromium against the live shop, and writes each
 * page's HTML snapshot into dist/ for nginx to serve; the SPA hydrates over it.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';
import { buildSeoRoutes, snapshotPath } from './seo-lib.mjs';
import { fetchProductIds, seoEnv } from './seo-shared.mjs';

const PORT = 4173;
const { limit } = seoEnv();

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
try {
  await waitFor(`http://localhost:${PORT}/`);
  const ids = await fetchProductIds(limit);
  const routes = buildSeoRoutes(ids);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const route of routes) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 20_000 });
    const html = await page.content();
    const target = join('dist', snapshotPath(route));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `<!doctype html>\n${html.replace(/^<!doctype html>\n?/i, '')}`);
    console.log(`prerendered ${route} -> ${target}`);
  }
  await browser.close();
  console.log(`prerender: ${routes.length} routes`);
} finally {
  preview.kill();
}

async function waitFor(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      /* server not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`preview server did not come up at ${url}`);
}
