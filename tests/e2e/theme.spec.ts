import { expect, test, type Page } from '@playwright/test';

/**
 * Theming: the instance's `theme:` config picks the look. The config is served per instance, so
 * every scenario is produced by answering /oxid-config.yaml — it works against any target.
 */

async function withTheme(page: Page, theme: { default: string; active?: string }): Promise<void> {
  const yaml = `theme:\n  default: ${theme.default}\n${theme.active ? `  active: ${theme.active}\n` : ''}`;
  await page.route('**/oxid-config.yaml', (route) =>
    route.fulfill({ status: 200, contentType: 'application/yaml', body: yaml }),
  );
}

const bodyBackground = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function expectImageLoaded(page: Page, testId: string, fragment: string): Promise<void> {
  const image = page.getByTestId(testId);
  await expect(image).toHaveAttribute('src', new RegExp(fragment));
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
}

test.describe('themes', () => {
  test('default theme: reference look, logo and hero image from the theme folder', async ({
    page,
    request,
  }) => {
    await withTheme(page, { default: 'default' });
    await page.goto('/');

    await expect(page.getByTestId('home-hero')).toBeVisible();
    expect(await bodyBackground(page)).toBe('rgb(255, 255, 255)');
    await expectImageLoaded(page, 'theme-logo', '/themes/default/images/logo\\.png');

    const hero = await page
      .getByTestId('home-hero')
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(hero).toContain('/themes/default/images/hero.jpg');
    const heroUrl = new URL(hero.match(/url\("?([^")]+)"?\)/)![1], page.url()).toString();
    const image = await request.get(heroUrl);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/jpeg');

    // the app's primary button/link colors come from the token contract
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--oxfe-color-primary').trim(),
    );
    expect(primary).toBe('#0a5d9c');
  });

  test('dark child theme: own colors, own logo and hero, inherited tokens', async ({ page }) => {
    await withTheme(page, { default: 'default', active: 'dark' });
    await page.goto('/');

    await expect(page.getByTestId('home-hero')).toBeVisible();
    expect(await bodyBackground(page)).toBe('rgb(18, 18, 18)');
    await expectImageLoaded(page, 'theme-logo', '/themes/dark/images/logo-dark\\.png');

    const hero = await page
      .getByTestId('home-hero')
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(hero).toContain('/themes/dark/images/hero-dark.jpg');

    // --oxfe-radius-lg is declared only by the PARENT theme: the child inherits it
    const radius = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--oxfe-radius-lg').trim(),
    );
    expect(radius).toBe('8px');

    // components follow the tokens: the catalog's cards use the dark border color
    await page.goto('/shop');
    const card = page.getByTestId('product-card').first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const border = await card.evaluate((element) => getComputedStyle(element).borderTopColor);
    expect(border).toBe('rgb(51, 51, 51)');
  });

  test('an unknown active theme falls back to theme.default', async ({ page }) => {
    await withTheme(page, { default: 'default', active: 'no-such-theme' });
    await page.goto('/');

    await expect(page.getByTestId('home-hero')).toBeVisible();
    expect(await bodyBackground(page)).toBe('rgb(255, 255, 255)');
    await expectImageLoaded(page, 'theme-logo', '/themes/default/images/logo\\.png');
  });

  test('with no loadable theme the storefront still works on the component fallbacks', async ({
    page,
  }) => {
    await withTheme(page, { default: 'nothing-here', active: 'nor-here' });
    await page.goto('/');

    await expect(page.getByTestId('home-hero')).toBeVisible();
    await expect(page.locator('#oxfe-theme-css')).toHaveCount(0);
    await expect(page.getByTestId('theme-logo')).toHaveCount(0);
    expect(await bodyBackground(page)).toBe('rgb(255, 255, 255)');

    await page.getByTestId('home-to-catalog').click();
    await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 20_000 });
  });
});
