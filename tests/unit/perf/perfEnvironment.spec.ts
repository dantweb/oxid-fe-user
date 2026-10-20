// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SEARCH_QUERY } from '../../../plugins/shop/search/searchQuery';
import { PERF_MARKER_TITLE } from '../../../scripts/perf/search-index/perfDatabase';

const perfUrl = process.env.PERF_GRAPHQL_URL ?? '';
const demoUrl = process.env.DEMO_GRAPHQL_URL ?? 'http://localhost/graphql/';

async function searchTitles(url: string, q: string): Promise<string[]> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { q, limit: 5, offset: 0 } }),
  });
  const body = (await response.json()) as { data: { products: Array<{ title: string }> } };
  return body.data.products.map((product) => product.title);
}

/** Runs only against the SDK with the cloned DB up (see sprint 17, S1). */
/** With 5 M articles loaded, a search that matches nothing scans them all: allow it time. */
const SCAN_TIMEOUT = 120_000;

describe.runIf(perfUrl)('perf environment: example_perf on its own entry point', () => {
  it(
    'perf endpoint answers the quicksearch query',
    async () => {
      expect(Array.isArray(await searchTitles(perfUrl, 'a'))).toBe(true);
    },
    SCAN_TIMEOUT,
  );

  it(
    'perf endpoint reads example_perf, not example',
    async () => {
      expect(await searchTitles(perfUrl, PERF_MARKER_TITLE)).toEqual([PERF_MARKER_TITLE]);
    },
    SCAN_TIMEOUT,
  );

  it(
    'demo endpoint does not see the perf marker',
    async () => {
      expect(await searchTitles(demoUrl, PERF_MARKER_TITLE)).toEqual([]);
    },
    SCAN_TIMEOUT,
  );
});
