import { expect, test } from '@playwright/test';
import { PEROXID_CONFIG, withInstanceConfig } from './helpers/config';

/**
 * Sprint 16: the peroxid header offers the language change as a dropdown (Apex shape) that behaves
 * exactly like the default header's switch: UI copy, shop-delivered content, <html lang> and the
 * persisted choice all follow.
 */
const TWO_LOCALES = `i18n: { default_locale: en, locales: [en, de] }\n${PEROXID_CONFIG}`;

test.describe('peroxid language switch', () => {
  test('desktop: a dropdown with the language names; choosing Deutsch switches everything', async ({
    page,
  }) => {
    await withInstanceConfig(page, TWO_LOCALES);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/search?q=park');
    await expect(page.getByTestId('product-card-title').first()).toContainText('Parking sensor', {
      timeout: 20_000,
    });

    const toggle = page.getByTestId('pxd-language');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText(/English/);
    await toggle.click();
    const options = page.getByTestId('pxd-language-option');
    await expect(options).toHaveText(['English', 'Deutsch']);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');

    await options.nth(1).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(toggle).toHaveText(/Deutsch/);
    await expect(page.getByTestId('pxd-results-title')).toContainText('Ergebnisse'); // UI copy
    await expect(page.getByTestId('product-card-title').first()).toContainText('Parksensor', {
      timeout: 20_000,
    }); // shop-delivered content
    expect(await page.evaluate(() => localStorage.getItem('oxfe_locale'))).toBe('de');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de', { timeout: 20_000 });
    await expect(page.getByTestId('pxd-language')).toHaveText(/Deutsch/);
  });

  test('keyboard: Escape closes the menu without changing anything', async ({ page }) => {
    await withInstanceConfig(page, TWO_LOCALES);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const toggle = page.getByTestId('pxd-language');
    await toggle.click();
    await expect(page.getByTestId('pxd-language-option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pxd-language-option')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('phone: the switch lives in the drawer', async ({ page }) => {
    await withInstanceConfig(page, TWO_LOCALES);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('pxd-header')).toBeVisible();
    await expect(page.getByTestId('pxd-language')).toHaveCount(0); // not in the compact bar
    await page.getByTestId('pxd-menu-toggle').click();
    const drawerSwitch = page.getByTestId('pxd-drawer').getByTestId('pxd-language-option');
    await expect(drawerSwitch).toHaveText(['English', 'Deutsch']);
    await drawerSwitch.nth(1).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('with a single configured language there is nothing to switch', async ({ page }) => {
    await withInstanceConfig(
      page,
      `i18n: { default_locale: de, locales: [de] }\n${PEROXID_CONFIG}`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('pxd-header')).toBeVisible();
    await expect(page.getByTestId('pxd-language')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });
});
