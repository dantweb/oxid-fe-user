import { expect, test } from '@playwright/test';
import { defaultInstanceConfig } from '../../src/config/schema';
import {
  deployedConfig,
  deployedConfigFile,
  deployedConfigText,
  escapeRegExp,
  productsPerPage,
  shopName,
} from './helpers/instance-config';

/**
 * Proof that the deployment is driven by `oxid-config.yaml`: what the storefront serves and
 * shows at /shop is what this repo's file says — and the file differs from the built-in
 * defaults, so these checks cannot pass on defaults by accident.
 * Run against the public instance:  E2E_BASE_URL=https://daniil.oxiddev.de:8443 npx playwright test deployed-config
 */
test.describe('the deployment uses oxid-config.yaml', () => {
  test('the file is a real instance config, not a copy of the defaults', () => {
    expect(deployedConfigFile).toBe('oxid-config.yaml');
    const defaults = defaultInstanceConfig();
    expect(deployedConfig().instance.id).not.toBe(defaults.instance.id);
    expect(shopName()).not.toBe(defaults.instance.name);
    expect(productsPerPage()).not.toBe(12);
  });

  test('the server serves exactly this file at /oxid-config.yaml', async ({ request }) => {
    const response = await request.get('/oxid-config.yaml');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('yaml');
    expect(response.headers()['cache-control']).toContain('no-store');
    expect((await response.text()).trim()).toBe(deployedConfigText().trim());
  });

  test('/shop shows the configured shop name, page size and languages', async ({ page }) => {
    await page.goto('/shop');

    // shop name from `instance.name`: header brand and page title
    await expect(page.locator('.header__brand')).toHaveText(shopName());
    await expect(page).toHaveTitle(new RegExp(` · ${escapeRegExp(shopName())}$`));

    // page size from `plugins.shop.config.products_per_page`
    await expect(page.getByTestId('product-card')).toHaveCount(productsPerPage(), {
      timeout: 20_000,
    });

    // languages from `i18n.locales`
    const options = page.getByTestId('locale-switcher').locator('option');
    await expect(options).toHaveText(deployedConfig().i18n.locales.map((l) => l.toUpperCase()));
  });

  test('the configured page size really drives pagination', async ({ page }) => {
    await page.goto('/shop');
    const titles = page.getByTestId('product-card-title');
    await expect(titles).toHaveCount(productsPerPage(), { timeout: 20_000 });
    const firstPage = await titles.allInnerTexts();

    await page.getByRole('button', { name: /next|weiter/i }).click();
    await expect(titles.first()).not.toHaveText(firstPage[0], { timeout: 20_000 });
    await expect(titles).toHaveCount(productsPerPage());
    expect(await titles.allInnerTexts()).not.toEqual(firstPage);
  });
});
