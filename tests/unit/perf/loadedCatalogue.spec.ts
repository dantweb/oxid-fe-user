// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SEARCH_QUERY } from '../../../plugins/shop/search/searchQuery';
import { runSql } from '../../../scripts/perf/search-index/mysql';
import { MATRIX_SIZE, sample, toArticleRow } from '../../../scripts/perf/search-index/rodCatalogue';

const perfUrl = process.env.PERF_GRAPHQL_URL ?? '';
const SEED = 20261020;
const COUNT = 5_000_000;

async function searchTitles(q: string): Promise<string[]> {
  const response = await fetch(perfUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { q, limit: 5, offset: 0 } }),
  });
  const body = (await response.json()) as { data: { products: Array<{ title: string }> } };
  return body.data.products.map((product) => product.title);
}

function firstRodNotIn(picked: Uint32Array): number {
  const inShop = new Uint8Array(MATRIX_SIZE);
  picked.forEach((index) => {
    inShop[index] = 1;
  });
  return inShop.indexOf(0);
}

/** Runs only against the loaded perf database (sprint 17, S3). */
describe.runIf(perfUrl)('loaded rod catalogue in example_perf', () => {
  const picked = sample(SEED, COUNT);

  it('holds exactly the 5 000 000 sampled ROD- articles', () => {
    expect(runSql("SELECT COUNT(*) FROM oxarticles WHERE OXARTNUM LIKE 'ROD-%'").trim()).toBe(
      String(COUNT),
    );
  }, 120_000);

  it('finds a sampled rod through the quicksearch query', async () => {
    const title = String(toArticleRow(picked[0]).OXTITLE);
    expect(await searchTitles(title)).toEqual([title]);
  }, 120_000);

  it('does not find a rod the sample left out', async () => {
    const title = String(toArticleRow(firstRodNotIn(picked)).OXTITLE);
    expect(await searchTitles(title)).toEqual([]);
  }, 120_000);
});
