import { expect, test, type Page } from '@playwright/test';
import { CAPS_CATEGORY_ID } from './fixtures/test-data';

/** GraphQL calls that ask about one category (its record and its product list). */
function countCategoryRequests(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (!request.url().includes('/graphql') || request.method() !== 'POST') {
      return;
    }
    const variables = (request.postDataJSON() as { variables?: Record<string, unknown> }).variables;
    if (variables?.id === CAPS_CATEGORY_ID || variables?.categoryId === CAPS_CATEGORY_ID) {
      count += 1;
    }
  });
  return () => count;
}

test.describe('request cache', () => {
  test('going back to a category does not ask the shop for it again', async ({ page }) => {
    const categoryRequests = countCategoryRequests(page);
    const cards = page.getByTestId('product-card');
    const openFirstProductAndGoBack = async (): Promise<void> => {
      await cards.first().click();
      await expect(page.getByTestId('product-price')).toBeVisible({ timeout: 20_000 });
      await page.goBack();
      await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    };

    await page.goto(`/shop/category/${CAPS_CATEGORY_ID}`);
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    expect(categoryRequests()).toBeGreaterThan(0);

    // the guest session arrives right after the first load and is part of the cache key, so the
    // first way back may still ask once; from then on the answers are cached
    await openFirstProductAndGoBack();
    const settled = categoryRequests();
    await openFirstProductAndGoBack();

    expect(categoryRequests()).toBe(settled);
  });
});
