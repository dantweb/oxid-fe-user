import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCore } from '../../src/core';
import { CATALOG_READ, SUGGESTION_READ } from '../../plugins/shop/api/cachePolicy';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|vue)$/.test(name) ? [path] : [];
  });
}

const CACHED = /CATALOG_READ|SUGGESTION_READ|cacheTtlMs/;

describe('request cache policy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names short TTLs: suggestions shorter than catalog reads', () => {
    expect(CATALOG_READ.cacheTtlMs).toBe(60_000);
    expect(SUGGESTION_READ.cacheTtlMs).toBe(30_000);
  });

  it('the app core wires a cache: an opted-in read is fetched once', async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ data: { n: 1 } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const { client } = createCore('/graphql/');

    await client.execute('query { n }', {}, CATALOG_READ);
    await client.execute('query { n }', {}, CATALOG_READ);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it.each([
    'plugins/shop/views/ProductCatalog.vue',
    'plugins/shop/views/CategoryView.vue',
    'plugins/shop/views/ProductDetail.vue',
    'plugins/peroxid/components/ProductRail.vue',
  ])('%s reads through the catalog policy', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/CATALOG_READ/);
  });

  it.each(['plugins/checkout', 'plugins/dashboard', 'plugins/payment-paypal', 'src'])(
    'basket, account, checkout and payment code (%s) never opts into the cache',
    (dir) => {
      const offenders = sourceFiles(dir).filter((file) => CACHED.test(readFileSync(file, 'utf8')));
      expect(offenders).toEqual([]);
    },
  );

  it.each(['plugins/payment-stripe', 'plugins/payment-mollie'])('%s never caches', (dir) => {
    expect(sourceFiles(dir).filter((f) => CACHED.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
