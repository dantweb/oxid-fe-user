import { expect, type Page } from '@playwright/test';
import { STRIPE_CARD_DETAILS } from '../fixtures/test-data';

/** Pays on Stripe's hosted Checkout page with a test card (pattern: the Stripe module's Helper). */
export async function payOnStripeHostedPage(page: Page, cardNumber: string): Promise<void> {
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
