import { expect, test, type Page } from '@playwright/test';
import {
  ORDERABLE_PRODUCT_ID,
  STRIPE_CARD_DETAILS,
  STRIPE_TEST_CARDS,
  TEST_USER,
} from './fixtures/test-data';
import { HOSTED_PAYMENTS_CONFIG, withInstanceConfig } from './helpers/config';
import { signIn } from './helpers/session';

/**
 * A completed payment, end to end: storefront checkout → Stripe's hosted page
 * (test card, pattern from the Stripe module's Helper.fillStripeCardDetailsWithCard)
 * → return view shows the committed order → the order is live in /dashboard/orders.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

async function ensureAddress(page: Page): Promise<void> {
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
  await expect(page.getByTestId('payment-oe_payments_stripe_wallet')).toBeVisible({
    timeout: 30_000,
  });
}

async function payOnStripeHostedPage(page: Page, cardNumber: string): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  await page.waitForLoadState('domcontentloaded');

  const email = page.getByRole('textbox', { name: 'Email' });
  await email.waitFor({ state: 'visible', timeout: 30_000 });
  // unique per session: a returning email makes Stripe offer Link instead of the plain card form
  await email.fill(`stripe-e2e-${Date.now()}@oxid-test.local`);

  // the card fields only appear after the "Card" accordion entry is selected
  await page.getByText('Card', { exact: true }).first().click({ force: true });

  await page.locator('#cardNumber').fill(cardNumber);
  await page.locator('#cardExpiry').fill(STRIPE_CARD_DETAILS.expiry);
  await page.locator('#cardCvc').fill(STRIPE_CARD_DETAILS.cvc);
  await page.locator('#billingName').fill(STRIPE_CARD_DETAILS.name);

  const pay = page.locator('[data-testid="hosted-payment-submit-button"]').first();
  await expect(pay).toBeEnabled({ timeout: 20_000 });
  // Stripe's invisible bot-check layer can sit over the button; a plain click then waits forever
  await pay.click({ timeout: 15_000 }).catch(() => pay.click({ force: true, timeout: 15_000 }));
}

test('pays with a Stripe test card, the order is committed and live in the dashboard', async ({
  page,
}) => {
  await withInstanceConfig(page, HOSTED_PAYMENTS_CONFIG); // this spec proves the hosted flow
  await signIn(page, { email: TEST_USER.email, password: TEST_USER.password });

  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();

  await page.goto('/checkout');
  await ensureAddress(page);
  await page.getByTestId('payment-oe_payments_stripe_wallet').check();
  await page.getByTestId('confirm-terms').check();
  await page.getByTestId('pay-now').click();

  await payOnStripeHostedPage(page, STRIPE_TEST_CARDS.VISA_SUCCESS);

  // back on the storefront: the return view settles the contract
  await page.waitForURL(/\/checkout\/return\/payment-stripe/, { timeout: 90_000 });
  const committed = page.getByTestId('return-committed');
  await expect(committed).toBeVisible({ timeout: 60_000 });
  const orderNumber = (await committed.innerText()).match(/\d+/)?.[0];
  expect(orderNumber, 'order number on the confirmation').toBeTruthy();

  // the order exists in the account area and is live: with automatic capture it is "paid";
  // with the shop's manual capture mode the payment is authorized and the order stays "open"
  // until the merchant captures (OXPAID is only set by the capture).
  await page.goto('/dashboard/orders');
  const row = page.getByTestId('order-row').filter({
    has: page.getByRole('link', { name: `#${orderNumber}`, exact: true }),
  });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText(/paid|bezahlt|open|offen/i);
  await expect(row).not.toContainText(/cancelled|storniert/i);
});

test('a declined card keeps the shopper on Stripe with the decline message', async ({ page }) => {
  await withInstanceConfig(page, HOSTED_PAYMENTS_CONFIG); // this spec proves the hosted flow
  await signIn(page, { email: TEST_USER.email, password: TEST_USER.password });

  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await page.getByTestId('add-to-cart').click();
  await page.goto('/checkout');
  await ensureAddress(page);
  await page.getByTestId('payment-oe_payments_stripe_wallet').check();
  await page.getByTestId('confirm-terms').check();
  await page.getByTestId('pay-now').click();

  await payOnStripeHostedPage(page, STRIPE_TEST_CARDS.CARD_DECLINED);

  await expect(page.getByText(/card was declined/i).first()).toBeVisible({ timeout: 30_000 });

  await expect(page).toHaveURL(/checkout\.stripe\.com/);
});
