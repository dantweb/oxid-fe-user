import type { GraphqlClient } from '@dantweb/oxid-fe-core';
import { CATALOG_READ, SUGGESTION_READ } from '../api/cachePolicy';
import type { ProductListItem } from '../api/queries';
import { SEARCH_QUERY } from './searchQuery';

// The shop may hold millions of products with near-identical titles: every limit below keeps one
// keystroke or one click cheap for it.
export const MIN_CHARS = 2;
export const SUGGESTION_LIMIT = 5;
export const PAGE_SIZE = 12;
/** Deeper than this the shopper refines the search; offsets grow expensive for the database. */
export const MAX_PAGES = 20;

export type SearchClient = Pick<GraphqlClient, 'execute'>;

export interface ResultsPage {
  products: ProductListItem[];
  hasNext: boolean;
  /** More results exist than the depth cap lets the shopper page through. */
  refine: boolean;
}

/**
 * One search shape for the cache and the shop: trimmed, single-spaced, and without `%` — the
 * shopper types words, not LIKE patterns, and equal searches must share one cache entry.
 */
export function normalizeTerm(raw: string): string {
  return raw.replace(/%/g, '').replace(/\s+/g, ' ').trim();
}

async function search(
  client: SearchClient,
  variables: { q: string; limit: number; offset: number },
  cache: typeof CATALOG_READ,
): Promise<ProductListItem[]> {
  const data = await client.execute<{ products: ProductListItem[] }>(
    SEARCH_QUERY,
    variables,
    cache,
  );
  return data.products;
}

export async function fetchSuggestions(
  client: SearchClient,
  raw: string,
): Promise<ProductListItem[]> {
  const q = normalizeTerm(raw);
  if (q.length < MIN_CHARS) {
    return [];
  }
  return search(client, { q, limit: SUGGESTION_LIMIT, offset: 0 }, SUGGESTION_READ);
}

/** Asks for one product more than a page: that is how "is there a next page" is known without counting. */
export async function fetchResultsPage(
  client: SearchClient,
  raw: string,
  page: number,
): Promise<ResultsPage> {
  const q = normalizeTerm(raw);
  if (q.length < MIN_CHARS) {
    return { products: [], hasNext: false, refine: false };
  }
  if (page >= MAX_PAGES) {
    return { products: [], hasNext: false, refine: true };
  }
  const found = await search(
    client,
    { q, limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE },
    CATALOG_READ,
  );
  const more = found.length > PAGE_SIZE;
  const atCap = page + 1 >= MAX_PAGES;
  return {
    products: found.slice(0, PAGE_SIZE),
    hasNext: more && !atCap,
    refine: more && atCap,
  };
}
