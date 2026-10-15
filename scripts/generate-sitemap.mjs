#!/usr/bin/env node
/**
 * Writes dist/sitemap.xml from the storefront catalog.
 * Env: FRONTEND_ORIGIN (loc base), VITE_SHOP_URL (GraphQL), SEO_PRODUCT_LIMIT (default 48).
 */
import { writeFileSync } from 'node:fs';
import { fetchProductIds, seoEnv } from './seo-shared.mjs';
import { buildSeoRoutes, sitemapXml } from './seo-lib.mjs';

const { origin, limit } = seoEnv();
const ids = await fetchProductIds(limit);
const routes = buildSeoRoutes(ids);
writeFileSync(
  'dist/sitemap.xml',
  sitemapXml(origin, routes, new Date().toISOString().slice(0, 10)),
);
console.log(`sitemap.xml: ${routes.length} urls (origin ${origin})`);
