import { expect, test } from '@playwright/test';
import { ensureAddress } from './helpers/checkout';
import { registerCustomer, signIn, type Credentials } from './helpers/session';

/**
 * A blank delivery step leaves the shopper with nothing to do. Two ways to get there, both must say
 * what is wrong and offer the way back:
 *  - the shop refuses a product ("can not be ordered" — the demo product "Hailys" is such a one);
 *  - the shop offers the cart no delivery method (its shipping rules): mocked here, the demo data
 *    has no such product.
 */
const PRODUCT_NOT_ORDERABLE = '062b2914d57389263ae7bdd773c70f4a';
const PRODUCT_WITH_DELIVERY = '066e3ce119c43c81cc0e46d4f1681eed';

let user: Credentials;
test.beforeAll(async ({ request }) => {
  user = await registerCustomer(request, 'fe-nodelivery');
});

async function checkoutWith(page: import('@playwright/test').Page, productId: string) {
  await signIn(page, user);
  await page.goto(`/shop/product/${productId}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();
  await page.goto('/checkout');
  await ensureAddress(page);
}

test('a product the shop refuses: the reason is shown with a way back — not a blank step', async ({
  page,
}) => {
  await checkoutWith(page, PRODUCT_NOT_ORDERABLE);

  await expect(page.getByTestId('checkout-error')).toContainText(/can not be ordered/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('checkout-error-cart')).toHaveAttribute('href', '/shop/cart');
  await expect(page.getByTestId('confirm-terms')).toHaveCount(0);
});

test('a cart without any delivery method says so and offers the cart', async ({ page }) => {
  await page.route('**/graphql/**', async (route) => {
    if ((route.request().postData() ?? '').includes('checkoutDeliveryMethods')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { basketDeliveryMethods: [] } }),
      });
    }
    return route.continue();
  });
  await checkoutWith(page, PRODUCT_WITH_DELIVERY);

  await expect(page.getByTestId('no-delivery')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('no-delivery-cart')).toHaveAttribute('href', '/shop/cart');
  await expect(page.getByTestId('confirm-terms')).toHaveCount(0);
});

test('a deliverable cart still shows the delivery method and the payment step', async ({
  page,
}) => {
  await checkoutWith(page, PRODUCT_WITH_DELIVERY);

  await expect(page.getByTestId('no-delivery')).toHaveCount(0);
  await expect(page.getByTestId('confirm-terms')).toBeVisible({ timeout: 30_000 });
});
