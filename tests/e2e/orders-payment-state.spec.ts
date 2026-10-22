import { expect, test, type Page } from '@playwright/test';
import { HOSTED_PAYMENTS_CONFIG, withInstanceConfig } from './helpers/config';
import { registerCustomer, signIn } from './helpers/session';

/**
 * Sprint 139c C4: the orders list shows where the payment behind an order stands, from
 * `Order.paymentContract { state provider }` (payment-base, via the documented @ExtendType).
 */
const order = (id: string, number: number, paymentContract: unknown) => ({
  id,
  orderNumber: number,
  ordered: '2026-10-22T10:00:00+00:00',
  paid: null,
  cancelled: false,
  cost: { total: 19.9, currency: { name: 'EUR' } },
  items: [],
  paymentContract,
});

async function signedInCustomer(page: Page, request: Parameters<typeof registerCustomer>[0]) {
  await withInstanceConfig(page, HOSTED_PAYMENTS_CONFIG);
  await signIn(page, await registerCustomer(request, 'fe-orders'));
}

test('the orders list shows a payment badge per order, none for a classic payment', async ({
  page,
  request,
}) => {
  await signedInCustomer(page, request);
  await page.route('**/graphql/**', async (route) => {
    if (!(route.request().postData() ?? '').includes('accountOrders')) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: {
            orders: [
              order('o3', 830, null),
              order('o2', 831, { state: 'pending', provider: 'paypal' }),
              order('o1', 832, { state: 'committed', provider: 'stripe' }),
            ],
          },
        },
      }),
    });
  });

  await page.goto('/dashboard/orders');

  const rows = page.getByTestId('order-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('#832');
  await expect(rows.nth(0).getByTestId('order-payment-badge')).toContainText('Stripe');
  await expect(rows.nth(0).getByTestId('order-payment-badge')).toHaveAttribute(
    'data-state',
    'completed',
  );
  await expect(rows.nth(1).getByTestId('order-payment-badge')).toHaveAttribute(
    'data-state',
    'pending',
  );
  await expect(rows.nth(2).getByTestId('order-payment-badge')).toHaveCount(0);
});

test('the real shop accepts the paymentContract selection (empty list, no error)', async ({
  page,
  request,
}) => {
  await signedInCustomer(page, request);
  const answers: string[] = [];
  page.on('response', async (response) => {
    const body = response.request().postData() ?? '';
    if (response.url().includes('/graphql') && body.includes('accountOrders')) {
      answers.push(await response.text());
    }
  });

  await page.goto('/dashboard/orders');

  await expect(page.getByTestId('orders-empty')).toBeVisible({ timeout: 20_000 });
  expect(answers.length).toBe(1);
  expect(answers[0]).not.toContain('"errors"');
});
