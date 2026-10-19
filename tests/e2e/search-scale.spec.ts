import { expect, test, type Page } from '@playwright/test';
import { PEROXID_CONFIG, withInstanceConfig } from './helpers/config';

interface SearchCall {
  q: string;
  limit: number;
  offset: number;
}

/**
 * A shop with millions of near-identical titles, simulated at the browser: every search is
 * answered with as many products as asked for. What is proven is what the STOREFRONT asks of
 * the shop — how many requests, how big, how deep — not the database (see
 * docs/dev_log/20261019/reports/search-scale-spike.md for that).
 */
async function endlessCatalogue(page: Page): Promise<SearchCall[]> {
  const calls: SearchCall[] = [];
  await page.route('**/graphql/**', async (route) => {
    const body = route.request().postDataJSON() as {
      query: string;
      variables: SearchCall;
    };
    if (!body.query.includes('query search(')) {
      return route.continue();
    }
    calls.push(body.variables);
    const products = Array.from({ length: body.variables.limit }, (_, i) => ({
      id: `p${body.variables.offset + i}`,
      title: `metall rod ${body.variables.offset + i} mm`,
      shortDescription: '',
      price: { price: 1, currency: { name: 'EUR', sign: '€' } },
      imageGallery: { thumb: '' },
    }));
    return route.fulfill({ json: { data: { products } } });
  });
  return calls;
}

test.describe('search on a very large catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await withInstanceConfig(page, PEROXID_CONFIG);
  });

  test('typing fast sends one small request, not one per key', async ({ page }) => {
    const calls = await endlessCatalogue(page);
    await page.goto('/');

    await page.getByTestId('pxd-search-input').pressSequentially('metall rod 100mm', { delay: 30 });
    await expect(page.getByTestId('pxd-suggestion').first()).toBeVisible({ timeout: 20_000 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ q: 'metall rod 100mm', limit: 5, offset: 0 });
    expect(await page.getByTestId('pxd-suggestion').count()).toBe(5);
  });

  test('wildcards typed by a shopper never reach the shop', async ({ page }) => {
    const calls = await endlessCatalogue(page);

    await page.goto('/search?q=%25%25rod');
    await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 20_000 });

    expect(calls.map((call) => call.q)).toEqual(['rod']);
  });

  test('paging stops at the depth cap and asks the shopper to refine', async ({ page }) => {
    const calls = await endlessCatalogue(page);
    await page.goto('/search?q=metall%20rod');
    const next = page.getByTestId('pxd-results-next');

    for (let pageNumber = 1; pageNumber < 20; pageNumber += 1) {
      await expect(next).toBeEnabled({ timeout: 20_000 });
      await next.click();
      await expect(page.getByTestId('pxd-results-title')).toBeVisible();
    }

    await expect(page.getByTestId('pxd-results-refine')).toBeVisible({ timeout: 20_000 });
    await expect(next).toBeDisabled();
    expect(Math.max(...calls.map((call) => call.offset))).toBe(19 * 12);
    expect(calls.every((call) => call.limit <= 13)).toBe(true);
  });

  test('going back to a search answers from the cache', async ({ page }) => {
    const calls = await endlessCatalogue(page);
    const cards = page.getByTestId('product-card');
    const openFirstProductAndGoBack = async (): Promise<void> => {
      await cards.first().click();
      await expect(page).toHaveURL(/\/shop\/product\//);
      await page.goBack();
      await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    };

    await page.goto('/search?q=metall%20rod');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    await openFirstProductAndGoBack();
    const settled = calls.length;
    await openFirstProductAndGoBack();

    expect(calls.length).toBe(settled);
  });
});
