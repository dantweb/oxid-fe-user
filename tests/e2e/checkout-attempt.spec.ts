import { expect, test, type Page } from '@playwright/test';
import { HOSTED_PAYMENTS_CONFIG, withInstanceConfig } from './helpers/config';
import { registerCustomer, signIn } from './helpers/session';

/**
 * Sprint 138e: `oxfe_checkout_attempt` (contract id + token) in sessionStorage lives only while it
 * is needed. The provider's answer is scripted here (no sandbox needed): every outcome of the return
 * page, the cancel page and a logout must leave the storage empty.
 */
const KEY = 'oxfe_checkout_attempt';
const ATTEMPT = {
  provider: 'payment-stripe',
  contractId: 'c-e2e-1',
  contractToken: 't-e2e-1',
  orderNumber: '832',
};

const stored = (page: Page): Promise<string | null> =>
  page.evaluate((key) => sessionStorage.getItem(key), KEY);

async function signedInWithAttempt(
  page: Page,
  request: Parameters<typeof registerCustomer>[0],
): Promise<void> {
  await withInstanceConfig(page, HOSTED_PAYMENTS_CONFIG);
  await signIn(page, await registerCustomer(request, 'fe-attempt'));
  await page.evaluate(
    ([key, value]) => sessionStorage.setItem(key, value),
    [KEY, JSON.stringify(ATTEMPT)],
  );
}

/** Answers `stripeCheckoutReturn` with the given result (and `stripeCheckoutCancel`). */
async function scriptProvider(
  page: Page,
  status: 'committed' | 'failed' | 'pending',
): Promise<void> {
  await page.route('**/graphql/**', async (route) => {
    const body = route.request().postData() ?? '';
    const respond = (data: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
    if (body.includes('stripeCheckoutReturn')) {
      return respond({ stripeCheckoutReturn: { status, orderId: null, orderNumber: '832' } });
    }
    if (body.includes('stripeCheckoutCancel')) {
      return respond({ stripeCheckoutCancel: { cancelled: true, contractId: 'c-e2e-1' } });
    }
    return route.continue();
  });
}

test.describe('the stored checkout attempt', () => {
  test('is gone after a committed return', async ({ page, request }) => {
    await signedInWithAttempt(page, request);
    await scriptProvider(page, 'committed');

    await page.goto('/checkout/return/payment-stripe');

    await expect(page.getByTestId('return-committed')).toBeVisible();
    expect(await stored(page)).toBeNull();
  });

  test('is gone after a failed return', async ({ page, request }) => {
    await signedInWithAttempt(page, request);
    await scriptProvider(page, 'failed');

    await page.goto('/checkout/return/payment-stripe');

    await expect(page.getByTestId('return-failed')).toBeVisible();
    expect(await stored(page)).toBeNull();
  });

  test('stays while the return is pending and is gone once the wait is over', async ({
    page,
    request,
  }) => {
    await signedInWithAttempt(page, request);
    await scriptProvider(page, 'pending');

    await page.goto('/checkout/return/payment-stripe');

    await expect(page.getByTestId('return-checking')).toBeVisible();
    expect(await stored(page)).not.toBeNull();
    await expect(page.getByTestId('return-pending')).toBeVisible({ timeout: 20_000 });
    expect(await stored(page)).toBeNull();
  });

  test('is gone after a cancel', async ({ page, request }) => {
    await signedInWithAttempt(page, request);
    await scriptProvider(page, 'pending');

    await page.goto('/checkout/cancel/payment-stripe');

    await expect(page.getByTestId('cancel-done')).toBeVisible();
    expect(await stored(page)).toBeNull();
  });

  test('is gone after a logout', async ({ page, request }) => {
    await signedInWithAttempt(page, request);
    await page.goto('/shop');
    expect(await stored(page)).not.toBeNull();

    await page.getByTestId('nav-logout').click();

    await expect.poll(() => stored(page)).toBeNull();
  });
});
