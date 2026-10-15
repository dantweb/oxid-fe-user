import { expect, test } from '@playwright/test';
import { fillLogin, registerCustomer, signIn, type Credentials } from './helpers/session';

test.describe.configure({ mode: 'serial' });

let user: Credentials;
const newPassword = 'fe-dash-Pass2!';

test.beforeAll(async ({ request }) => {
  user = await registerCustomer(request, 'fe-dash');
});

test('guests are redirected to login; the account area is noindex', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 20_000 });

  // sign in on the redirected page itself, so redirect-back is exercised
  await fillLogin(page, user);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 }); // redirect-back after login
  await expect(page.getByTestId('account-email')).toHaveText(user.email);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
});

test('orders, addresses and newsletter work end to end', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/dashboard');

  await page.getByTestId('tile-orders').click();
  await expect(page.getByTestId('orders-empty')).toBeVisible({ timeout: 20_000 });

  await page.goto('/dashboard/addresses');
  await page.locator('input[name=firstName]').fill('Dash');
  await page.locator('input[name=lastName]').fill('Tester');
  await page.locator('input[name=street]').fill('Bertoldstr');
  await page.locator('input[name=streetNumber]').fill('48');
  await page.locator('input[name=zipCode]').fill('79098');
  await page.locator('input[name=city]').fill('Freiburg');
  await page.getByTestId('save-invoice').click();
  await expect(page.getByTestId('invoice-saved')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('add-delivery').click();
  await page.locator('input[name=dFirstName]').fill('Depot');
  await page.locator('input[name=dLastName]').fill('Tester');
  await page.locator('input[name=dStreet]').fill('Lagerweg');
  await page.locator('input[name=dStreetNumber]').fill('1');
  await page.locator('input[name=dZipCode]').fill('79098');
  await page.locator('input[name=dCity]').fill('Freiburg');
  await page.getByTestId('save-delivery').click();
  await expect(page.getByTestId('delivery-row')).toHaveCount(1, { timeout: 20_000 });

  await page.goto('/dashboard');
  await page.getByTestId('newsletter-toggle').click();
  // double opt-in shop: subscribing lands in "confirmation pending" until the email is confirmed
  await expect(page.getByTestId('newsletter-status')).toHaveText('confirmation pending', {
    timeout: 20_000,
  });
});

test('password change takes effect for the next sign-in', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/dashboard/profile');
  await page.locator('input[name=oldPassword]').fill(user.password);
  await page.locator('input[name=newPassword]').fill(newPassword);
  await page.getByTestId('change-password').click();
  await expect(page.getByTestId('password-changed')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('nav-logout').click();
  await signIn(page, { ...user, password: newPassword });
  await page.goto('/dashboard');
  await expect(page.getByTestId('account-email')).toHaveText(user.email);
});
