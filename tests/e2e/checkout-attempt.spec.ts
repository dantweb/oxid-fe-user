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

/**
 * Sprint 138c: a page that has used the query string of its link removes it from the address bar
 * (history, bookmarks, screenshots, access logs of the next hop never see it).
 */
test.describe('no query string stays after use', () => {
  const search = (page: Page): Promise<string> => page.evaluate(() => window.location.search);

  /** Records the variables of every `stripeCheckoutReturn` call; the answer can change mid-test. */
  async function recordReturns(page: Page, answer: { status: string }) {
    const calls: Record<string, unknown>[] = [];
    await page.route('**/graphql/**', async (route) => {
      const request = route.request();
      if (!(request.postData() ?? '').includes('stripeCheckoutReturn')) {
        return route.continue();
      }
      calls.push(JSON.parse(request.postData() ?? '{}').variables ?? {});
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { stripeCheckoutReturn: { ...answer, orderId: null, orderNumber: '832' } },
        }),
      });
    });
    return calls;
  }

  test('the return page hands over the provider parameter, then shows the bare route', async ({
    page,
    request,
  }) => {
    await signedInWithAttempt(page, request);
    const answer = { status: 'committed' };
    const calls = await recordReturns(page, answer);

    await page.goto('/checkout/return/payment-stripe?session_id=cs_test_e2e');

    await expect(page.getByTestId('return-committed')).toBeVisible();
    expect(calls[0]).toMatchObject({ checkoutSessionId: 'cs_test_e2e', contractId: 'c-e2e-1' });
    expect(await search(page)).toBe('');
    expect(new URL(page.url()).pathname).toBe('/checkout/return/payment-stripe');
  });

  test('a reload of the return page works from the stored attempt, not from the URL', async ({
    page,
    request,
  }) => {
    await signedInWithAttempt(page, request);
    const answer = { status: 'pending' };
    const calls = await recordReturns(page, answer);

    await page.goto('/checkout/return/payment-stripe?session_id=cs_test_e2e');
    await expect(page.getByTestId('return-checking')).toBeVisible();
    expect(await search(page)).toBe('');
    expect(calls[0]).toHaveProperty('checkoutSessionId', 'cs_test_e2e');

    calls.length = 0;
    answer.status = 'committed';
    await page.reload();

    await expect(page.getByTestId('return-committed')).toBeVisible();
    expect(calls[0]).toMatchObject({ contractId: 'c-e2e-1', contractToken: 't-e2e-1' });
    expect(calls[0]).not.toHaveProperty('checkoutSessionId');
    expect(await search(page)).toBe('');
  });

  test('the cancel page drops the provider token too', async ({ page, request }) => {
    await signedInWithAttempt(page, request);
    await scriptProvider(page, 'pending');

    await page.goto('/checkout/cancel/payment-stripe?token=EC-E2E');

    await expect(page.getByTestId('cancel-done')).toBeVisible();
    expect(await search(page)).toBe('');
  });

  test('the password-reset page keeps the key in the page, not in the address', async ({
    page,
  }) => {
    await withInstanceConfig(page, HOSTED_PAYMENTS_CONFIG);
    let sentKey: unknown;
    await page.route('**/graphql/**', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      if (!String(body.query).includes('customerPasswordReset')) {
        return route.continue();
      }
      sentKey = body.variables?.key;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customerPasswordReset: true } }),
      });
    });

    await page.goto('/reset-password?uid=reset-key-e2e');
    await expect(page.getByTestId('reset-form')).toBeVisible();
    expect(await search(page)).toBe('');
    await page.locator('input[name=password]').fill('New-Pass-1!');
    await page.locator('input[name=repeat]').fill('New-Pass-1!');
    await page.getByTestId('reset-submit').click();

    await expect(page.getByTestId('reset-done')).toBeVisible();
    expect(sentKey).toBe('reset-key-e2e');
  });
});
