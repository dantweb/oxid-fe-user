import { expect, test } from '@playwright/test';
import { canSignIn, gqlAs, waitForMail } from './helpers/api';
import { ORDERABLE_PRODUCT_ID } from './fixtures/test-data';
import { fillLogin, registerCustomer, signIn, type Credentials } from './helpers/session';

/**
 * The account area with Apex parity (docs/account.md): dashboard cards + menu, password, newsletter,
 * billing & shipping, wish list, gift registry, reviews, downloads, forgot / reset password, delete.
 */
test.describe.configure({ mode: 'serial' });

/**
 * Two account features are shop settings (as in Apex): customers may manage their reviews
 * (`blAllowUsersToManageTheirReviews`) and delete their account (`blAllowUsersToDeleteTheirAccount`).
 * Both are off in this shop: the default run proves the refusal is shown and nothing is lost;
 * with the settings on, run with E2E_SHOP_ALLOWS_ACCOUNT_MANAGEMENT=1 to prove the real thing.
 */
const SHOP_ALLOWS = process.env.E2E_SHOP_ALLOWS_ACCOUNT_MANAGEMENT === '1';
test.setTimeout(120_000);

let user: Credentials;
const newPassword = 'fe-acct-Pass2!';

test.beforeAll(async ({ request }) => {
  user = await registerCustomer(request, 'fe-acct');
});

test('guests are redirected to login; after signing in the dashboard shows Hello <name> and is noindex', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 20_000 });
  await fillLogin(page, user);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 }); // redirect-back after login
  await expect(page.getByTestId('account-email')).toHaveText(user.email);
  await expect(page.getByTestId('account-hello')).toContainText(/Hello|Hallo/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
});

test('the dashboard shows Apex’s cards with counts; the menu lists the pages and marks the active one', async ({
  page,
}) => {
  await signIn(page, user);
  await page.goto('/dashboard');

  for (const card of [
    'orders',
    'password',
    'newsletter',
    'addresses',
    'wishlist',
    'giftRegistry',
    'delete',
  ]) {
    await expect(page.getByTestId(`card-${card}`)).toBeVisible();
  }
  await expect(page.getByTestId('card-orders-count')).toContainText('0');
  // nothing to show → these stay out of the way
  await expect(page.getByTestId('card-downloads')).toHaveCount(0);
  await expect(page.getByTestId('card-reviews')).toHaveCount(0);

  await page.getByTestId('account-menu-toggle').click();
  await expect(page.getByTestId('account-menu-dashboard')).toHaveAttribute('aria-current', 'page');
  for (const entry of [
    'password',
    'newsletter',
    'addresses',
    'orders',
    'wishlist',
    'giftRegistry',
  ]) {
    await expect(page.getByTestId(`account-menu-${entry}`)).toBeVisible();
  }
  await expect(page.getByTestId('account-menu-downloads')).toHaveCount(0);

  // the whole card is the click target (stretched link)
  await page.getByTestId('account-menu-toggle').click();
  await page.getByTestId('card-orders').click({ position: { x: 20, y: 20 } });
  await expect(page).toHaveURL(/\/dashboard\/orders$/);
  await expect(page.getByTestId('orders-empty')).toBeVisible({ timeout: 20_000 });
});

test('billing & shipping: e-mail, invoice address and delivery addresses', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/dashboard/addresses');

  await page.locator('input[name=firstName]').fill('Acct');
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
  await page.getByTestId('delivery-row').getByRole('button').click();
  await expect(page.getByTestId('delivery-row')).toHaveCount(0, { timeout: 20_000 });

  const changed = `fe-acct-changed-${Date.now()}@oxid-test.local`;
  await page.locator('[data-testid="email-form"] input[name=email]').fill(changed);
  await page.getByTestId('save-email').click();
  await expect(page.getByTestId('email-saved')).toBeVisible({ timeout: 20_000 });
  user = { ...user, email: changed };
  await page.goto('/dashboard');
  await expect(page.getByTestId('account-email')).toHaveText(changed);
});

test('newsletter: subscribe (double opt-in pending) and unsubscribe', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/dashboard/newsletter');

  await expect(page.getByTestId('newsletter-status')).toHaveText(/not subscribed|nicht angemeldet/);
  await page.getByTestId('newsletter-toggle').click();
  // double opt-in shop: subscribing lands in "confirmation pending" until the e-mail is confirmed
  await expect(page.getByTestId('newsletter-status')).toHaveText(
    /confirmation pending|Bestätigung ausstehend/,
    { timeout: 20_000 },
  );
  await page.goto('/dashboard');
  await expect(page.getByTestId('card-newsletter')).toContainText(
    /confirmation pending|Bestätigung/,
  );

  await page.goto('/dashboard/newsletter');
  await page.getByTestId('newsletter-toggle').click();
  await expect(page.getByTestId('newsletter-status')).toHaveText(
    /not subscribed|nicht angemeldet/,
    {
      timeout: 20_000,
    },
  );
});

test('wish list and gift registry: save from the product page, count badges, remove', async ({
  page,
}) => {
  await signIn(page, user);
  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);

  await page.getByTestId('add-to-wishlist').click();
  await expect(page.getByTestId('saved-note')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-to-gift-registry').click();
  await expect(page.getByTestId('saved-note')).toContainText(/gift registry|Wunschzettel/, {
    timeout: 20_000,
  });

  await page.goto('/dashboard');
  await expect(page.getByTestId('card-wishlist-count')).toContainText('1');
  await expect(page.getByTestId('card-giftRegistry-count')).toContainText('1');
  await page.getByTestId('account-menu-toggle').click();
  await expect(page.getByTestId('account-badge-wishlist')).toHaveText('1');
  await expect(page.getByTestId('account-badge-giftRegistry')).toHaveText('1');

  await page.getByTestId('account-menu-wishlist').click();
  await expect(page.getByTestId('wishlist-row')).toHaveCount(1, { timeout: 20_000 });
  await page.getByTestId('wishlist-remove').click();
  await expect(page.getByTestId('wishlist-empty')).toBeVisible({ timeout: 20_000 });

  // gift registry: private by default, can be made public and private again
  await page.goto('/dashboard/gift-registry');
  await expect(page.getByTestId('giftRegistry-row')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByTestId('giftRegistry-visibility')).toHaveText(/private|privat/);
  await page.getByTestId('giftRegistry-toggle').click();
  await expect(page.getByTestId('giftRegistry-visibility')).toHaveText(/public|öffentlich/, {
    timeout: 20_000,
  });
  await page.getByTestId('giftRegistry-toggle').click();
  await expect(page.getByTestId('giftRegistry-visibility')).toHaveText(/private|privat/, {
    timeout: 20_000,
  });
  await page.getByTestId('giftRegistry-remove').click();
  await expect(page.getByTestId('giftRegistry-empty')).toBeVisible({ timeout: 20_000 });
});

test('a guest on a product page is offered to sign in to save for later', async ({ page }) => {
  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await expect(page.getByTestId('add-to-wishlist')).toHaveCount(0);
  await page.getByTestId('login-to-save').click();
  await expect(page).toHaveURL(/\/login\?redirect=.*product/);
});

test('reviews: appear once the customer has some; deleting works when the shop allows it, else the reason is shown', async ({
  page,
  request,
}) => {
  await gqlAs(
    request,
    user,
    `mutation ($id: String!) { reviewSet(review: { productId: $id, text: "Solid", rating: 4 }) { id } }`,
    { id: ORDERABLE_PRODUCT_ID },
  );
  await signIn(page, user);
  await page.goto('/dashboard');
  await expect(page.getByTestId('card-reviews-count')).toContainText('1');
  await page.getByTestId('account-menu-toggle').click();
  await page.getByTestId('account-menu-reviews').click();
  await expect(page.getByTestId('review-row')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByTestId('review-row')).toContainText('Solid');

  await page.getByTestId('review-delete').click();
  if (SHOP_ALLOWS) {
    await expect(page.getByTestId('reviews-empty')).toBeVisible({ timeout: 20_000 });
  } else {
    // the shop does not let customers manage their reviews — the reason is shown, the review stays
    await expect(page.getByTestId('reviews-error')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('review-row')).toHaveCount(1);
  }
});

test('downloads: the page exists and says so when the customer has no files', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/dashboard/downloads');
  await expect(page.getByTestId('downloads-empty')).toBeVisible({ timeout: 20_000 });
});

test('password: a mismatching repeat and a wrong current password are refused; the change takes effect for the next sign-in', async ({
  page,
  request,
}) => {
  await signIn(page, user);
  await page.goto('/dashboard/password');

  await page.locator('input[name=oldPassword]').fill(user.password);
  await page.locator('input[name=newPassword]').fill(newPassword);
  await page.locator('input[name=repeatPassword]').fill('something-else');
  await page.getByTestId('change-password').click();
  await expect(page.getByTestId('password-error')).toBeVisible();

  await page.locator('input[name=oldPassword]').fill('definitely-wrong');
  await page.locator('input[name=repeatPassword]').fill(newPassword);
  await page.getByTestId('change-password').click();
  await expect(page.getByTestId('password-error')).toBeVisible({ timeout: 20_000 });
  expect(await canSignIn(request, { ...user, password: newPassword })).toBe(false);

  await page.locator('input[name=oldPassword]').fill(user.password);
  await page.getByTestId('change-password').click();
  await expect(page.getByTestId('password-changed')).toBeVisible({ timeout: 20_000 });
  expect(await canSignIn(request, { ...user, password: newPassword })).toBe(true);
  expect(await canSignIn(request, user)).toBe(false);
  user = { ...user, password: newPassword };

  // sign out (the layouts keep the button in different places): drop the stored session
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await signIn(page, user);
  await page.goto('/dashboard');
  await expect(page.getByTestId('account-email')).toHaveText(user.email);
});

test('forgot password: the mail’s key sets a new password (and an unknown address gets the same neutral answer)', async ({
  page,
  request,
}) => {
  const forgetful = await registerCustomer(request, 'fe-forgot');

  await page.goto('/login');
  await page.getByTestId('forgot-link').click();
  await expect(page).toHaveURL(/\/forgot-password$/);

  // unknown address → the neutral answer, no hint whether it exists
  await page.locator('input[name=email]').fill(`nobody-${Date.now()}@oxid-test.local`);
  await page.getByTestId('forgot-submit').click();
  await expect(page.getByTestId('forgot-sent')).toBeVisible({ timeout: 20_000 });

  await page.goto('/forgot-password');
  await page.locator('input[name=email]').fill(forgetful.email);
  await page.getByTestId('forgot-submit').click();
  await expect(page.getByTestId('forgot-sent')).toBeVisible({ timeout: 20_000 });

  const mail = await waitForMail(request, forgetful.email);
  const key = mail.match(/uid=([0-9a-zA-Z]+)/)?.[1];
  expect(key, 'update key in the shop’s mail').toBeTruthy();

  await page.goto(`/reset-password?uid=${key}`);
  await page.locator('input[name=password]').fill('fe-forgot-New1!');
  await page.locator('input[name=repeat]').fill('mismatch');
  await page.getByTestId('reset-submit').click();
  await expect(page.getByTestId('reset-error')).toBeVisible();
  await page.locator('input[name=repeat]').fill('fe-forgot-New1!');
  await page.getByTestId('reset-submit').click();
  await expect(page.getByTestId('reset-done')).toBeVisible({ timeout: 20_000 });

  expect(await canSignIn(request, { ...forgetful, password: 'fe-forgot-New1!' })).toBe(true);
  expect(await canSignIn(request, forgetful)).toBe(false);
});

test('delete my account: cancel keeps it; the confirmation deletes it when the shop allows it, else the reason is shown', async ({
  page,
  request,
}) => {
  const leaving = await registerCustomer(request, 'fe-delete');
  await signIn(page, leaving);
  await page.goto('/dashboard');
  await page.getByTestId('card-delete').click({ position: { x: 20, y: 20 } });
  await expect(page).toHaveURL(/\/dashboard\/delete$/);
  await expect(page.getByTestId('delete-warning')).toBeVisible();

  await page.getByTestId('delete-cancel').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await canSignIn(request, leaving)).toBe(true);

  await page.goto('/dashboard/delete');
  await page.getByTestId('delete-confirm').click();
  if (SHOP_ALLOWS) {
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    expect(await canSignIn(request, leaving)).toBe(false);
  } else {
    // sprint 138f: the translated text, not the shop's own reason ("… not enabled")
    await expect(page.getByTestId('delete-error')).toContainText(
      'The account could not be deleted',
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByTestId('delete-error')).not.toContainText(/not enabled/i);
    await expect(page).toHaveURL(/\/dashboard\/delete$/);
    expect(await canSignIn(request, leaving)).toBe(true); // nothing was lost
  }
});
