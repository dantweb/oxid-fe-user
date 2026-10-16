import { test } from '@playwright/test';
import { gqlAs } from './helpers/api';
import { withInstanceConfig } from './helpers/config';
import { ORDERABLE_PRODUCT_ID } from './fixtures/test-data';
import { registerCustomer, signIn } from './helpers/session';

/** Evidence for docs/dev_log/20261016/reports/account: every account page in two themes. */
const OUT = 'docs/dev_log/20261016/reports/account';
const BASE = 'plugins:\n  shop: {}\n  checkout: {}\n  dashboard: {}\n';
const THEMES = { default: BASE, apex: `${BASE}theme:\n  default: default\n  active: apex\n` };
const PAGES = [
  ['dashboard', '/dashboard'],
  ['password', '/dashboard/password'],
  ['newsletter', '/dashboard/newsletter'],
  ['billing-shipping', '/dashboard/addresses'],
  ['orders', '/dashboard/orders'],
  ['wish-list', '/dashboard/wishlist'],
  ['gift-registry', '/dashboard/gift-registry'],
  ['reviews', '/dashboard/reviews'],
  ['downloads', '/dashboard/downloads'],
  ['delete', '/dashboard/delete'],
] as const;

test.setTimeout(240_000);
test.use({ viewport: { width: 1280, height: 900 } });

for (const [theme, config] of Object.entries(THEMES)) {
  test(`account pages — ${theme} theme`, async ({ page, request }) => {
    const customer = await registerCustomer(request, `fe-evidence-${theme}`);
    await gqlAs(
      request,
      customer,
      `mutation ($id: String!) { reviewSet(review: { productId: $id, text: "Solid and well made.", rating: 4 }) { id } }`,
      { id: ORDERABLE_PRODUCT_ID },
    );
    for (const kind of ['noticelist', 'wishlist']) {
      const { basketCreate } = await gqlAs<{ basketCreate: { id: string } }>(
        request,
        customer,
        `mutation ($t: String!) { basketCreate(basket: { title: $t, public: false }) { id } }`,
        { t: kind },
      );
      await gqlAs(
        request,
        customer,
        `mutation ($b: ID!, $p: ID!) { basketAddItem(basketId: $b, productId: $p, amount: 1) { id } }`,
        { b: basketCreate.id, p: ORDERABLE_PRODUCT_ID },
      );
    }

    await withInstanceConfig(page, config);
    await signIn(page, customer);
    for (const [name, path] of PAGES) {
      await page.goto(path);
      await page.getByTestId('account-hello').waitFor();
      await page.waitForTimeout(600);
      if (name === 'dashboard') {
        await page.getByTestId('account-menu-toggle').click();
        await page.screenshot({ path: `${OUT}/${theme}-dashboard-menu.png` });
        await page.getByTestId('account-menu-toggle').click();
      }
      await page.screenshot({ path: `${OUT}/${theme}-${name}.png` });
    }

    await page.goto('/forgot-password');
    await page.screenshot({ path: `${OUT}/${theme}-forgot-password.png` });
    await page.goto('/reset-password?uid=example');
    await page.screenshot({ path: `${OUT}/${theme}-reset-password.png` });
  });
}
