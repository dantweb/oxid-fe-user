import { describe, expect, it } from 'vitest';
// @ts-expect-error untyped build script helpers (plain .mjs by design)
import { buildSeoRoutes, sitemapXml, snapshotPath, xmlEscape } from '../../scripts/seo-lib.mjs';

describe('seo-lib', () => {
  it('builds one route list for sitemap and prerenderer', () => {
    expect(buildSeoRoutes(['p1', 'p 2'])).toEqual([
      '/',
      '/shop',
      '/shop/product/p1',
      '/shop/product/p%202',
    ]);
  });

  it('renders a valid urlset with escaped locs and no trailing slash doubling', () => {
    const xml = sitemapXml('https://shop.example.com/', ['/', '/shop'], '2026-10-15');
    expect(xml).toContain('<loc>https://shop.example.com/</loc>');
    expect(xml).toContain('<loc>https://shop.example.com/shop</loc>');
    expect(xml).toContain('<lastmod>2026-10-15</lastmod>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('escapes XML special characters', () => {
    expect(xmlEscape('a&b<c>"d\'')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
  });

  it('maps routes to snapshot paths', () => {
    expect(snapshotPath('/')).toBe('index.html');
    expect(snapshotPath('/shop')).toBe('shop/index.html');
    expect(snapshotPath('/shop/product/x1')).toBe('shop/product/x1/index.html');
  });
});
