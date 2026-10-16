import { expect, type Page } from '@playwright/test';
import { ORDERABLE_PRODUCT_ID, TEST_USER } from '../fixtures/test-data';
import { signIn } from './session';

export const PAYMENT_IDS = {
  stripe: 'oe_payments_stripe_wallet',
  paypal: 'oe_payments_paypal',
  mollie: 'oe_payments_mollie',
} as const;

export type PaymentKey = keyof typeof PAYMENT_IDS;

/** Fills the invoice address when the account has none yet (the saved one is reused otherwise). */
export async function ensureAddress(page: Page): Promise<void> {
  const form = page.getByTestId('address-form');
  if (await form.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator('input[name=firstName]').fill('Marc');
    await page.locator('input[name=lastName]').fill('Muster');
    await page.locator('input[name=street]').fill('Bertoldstr');
    await page.locator('input[name=streetNumber]').fill('48');
    await page.locator('input[name=zipCode]').fill('79098');
    await page.locator('input[name=city]').fill('Freiburg');
    await page.getByTestId('save-address').click();
  }
}

/** Signed-in shopper with one product in the cart, on the payment step, method chosen. */
export async function openPaymentStep(page: Page, payment: PaymentKey): Promise<void> {
  await signIn(page, { email: TEST_USER.email, password: TEST_USER.password });
  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();
  await page.goto('/checkout');
  await ensureAddress(page);
  const method = page.getByTestId(`payment-${PAYMENT_IDS[payment]}`);
  await expect(method).toBeVisible({ timeout: 30_000 });
  await method.check();
}

export const confirmTerms = (page: Page) => page.getByTestId('confirm-terms').check();

/** After the provider finished: the return route settles the contract and shows the order number. */
export async function expectCommittedOrder(page: Page, provider: string): Promise<string> {
  await page.waitForURL(new RegExp(`/checkout/return/${provider}`), { timeout: 120_000 });
  const committed = page.getByTestId('return-committed');
  await expect(committed).toBeVisible({ timeout: 90_000 });
  const orderNumber = (await committed.innerText()).match(/\d+/)?.[0];
  expect(orderNumber, 'order number on the confirmation').toBeTruthy();
  return orderNumber!;
}

/** The order is live in the account: paid (automatic capture) or open (authorized), never cancelled. */
export async function expectOrderInDashboard(
  page: Page,
  orderNumber: string,
  state: RegExp = /paid|bezahlt|open|offen/i,
): Promise<void> {
  await page.goto('/dashboard/orders');
  const row = page.getByTestId('order-row').filter({
    has: page.getByRole('link', { name: `#${orderNumber}`, exact: true }),
  });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText(state);
  await expect(row).not.toContainText(/cancelled|storniert/i);
}
