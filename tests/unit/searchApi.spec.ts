import { describe, expect, it, vi, type Mock } from 'vitest';
import { CATALOG_READ, SUGGESTION_READ } from '../../plugins/shop/api/cachePolicy';
import {
  fetchResultsPage,
  fetchSuggestions,
  MAX_PAGES,
  MIN_CHARS,
  normalizeTerm,
  PAGE_SIZE,
  SUGGESTION_LIMIT,
  type SearchClient,
} from '../../plugins/shop/search/searchApi';

const product = (n: number) => ({ id: String(n), title: `P${n}` });
const products = (count: number) => Array.from({ length: count }, (_, i) => product(i));

function clientReturning(list: unknown[]): SearchClient & { execute: Mock } {
  return { execute: vi.fn(async () => ({ products: list })) } as unknown as SearchClient & {
    execute: Mock;
  };
}

describe('normalizeTerm', () => {
  it('trims and collapses whitespace so equal searches share a cache entry', () => {
    expect(normalizeTerm('  metall   rod  100mm ')).toBe('metall rod 100mm');
  });

  it('removes the LIKE wildcard % a shopper might type', () => {
    expect(normalizeTerm('%rod')).toBe('rod');
    expect(normalizeTerm('ro%d')).toBe('rod');
    expect(normalizeTerm('U_shape')).toBe('U_shape');
  });
});

describe('fetchSuggestions', () => {
  it('asks for nothing below the minimum length', async () => {
    const client = clientReturning([]);

    expect(await fetchSuggestions(client, 'a'.repeat(MIN_CHARS - 1))).toEqual([]);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it('asks for a handful of products with the suggestion cache policy', async () => {
    const client = clientReturning(products(SUGGESTION_LIMIT));

    const result = await fetchSuggestions(client, ' metall  rod ');

    expect(result).toHaveLength(SUGGESTION_LIMIT);
    expect(client.execute).toHaveBeenCalledWith(
      expect.any(String),
      { q: 'metall rod', limit: SUGGESTION_LIMIT, offset: 0 },
      SUGGESTION_READ,
    );
  });
});

describe('fetchResultsPage', () => {
  it('asks for one more than a page to know whether a next page exists', async () => {
    const client = clientReturning(products(PAGE_SIZE + 1));

    const page = await fetchResultsPage(client, 'rod', 0);

    expect(client.execute).toHaveBeenCalledWith(
      expect.any(String),
      { q: 'rod', limit: PAGE_SIZE + 1, offset: 0 },
      CATALOG_READ,
    );
    expect(page.products).toHaveLength(PAGE_SIZE);
    expect(page.hasNext).toBe(true);
    expect(page.refine).toBe(false);
  });

  it('a page that is exactly full does not invent a next page', async () => {
    const page = await fetchResultsPage(clientReturning(products(PAGE_SIZE)), 'rod', 0);

    expect(page.hasNext).toBe(false);
  });

  it('computes the offset from the page number', async () => {
    const client = clientReturning([]);

    await fetchResultsPage(client, 'rod', 3);

    expect(client.execute).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ offset: 3 * PAGE_SIZE }),
      CATALOG_READ,
    );
  });

  it('on the last allowed page it stops paging and asks the shopper to refine', async () => {
    const page = await fetchResultsPage(
      clientReturning(products(PAGE_SIZE + 1)),
      'rod',
      MAX_PAGES - 1,
    );

    expect(page.hasNext).toBe(false);
    expect(page.refine).toBe(true);
  });

  it('never asks the shop beyond the depth cap', async () => {
    const client = clientReturning(products(PAGE_SIZE));

    const page = await fetchResultsPage(client, 'rod', MAX_PAGES);

    expect(client.execute).not.toHaveBeenCalled();
    expect(page).toEqual({ products: [], hasNext: false, refine: true });
  });

  it('asks for nothing below the minimum length', async () => {
    const client = clientReturning([]);

    const page = await fetchResultsPage(client, 'a', 0);

    expect(client.execute).not.toHaveBeenCalled();
    expect(page).toEqual({ products: [], hasNext: false, refine: false });
  });
});
