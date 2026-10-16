import { expect, test, type Page } from '@playwright/test';
import { withInstanceConfig } from './helpers/config';

/**
 * Button styles with Apex parity (docs/account.md): the geometry is Apex's (Bootstrap 5 with Apex's
 * variables), the colours come from the theme tokens — so the default theme and the `apex` theme
 * share the shape and differ in colour.
 */
const BASE = 'plugins:\n  shop: {}\n  checkout: {}\n  dashboard: {}\n';
const WITH_APEX = `${BASE}theme:\n  default: default\n  active: apex\n`;

interface ButtonStyle {
  paddingTop: string;
  paddingRight: string;
  borderTopWidth: string;
  borderTopLeftRadius: string;
  lineHeightRatio: number;
  color: string;
  backgroundColor: string;
  borderTopColor: string;
  opacity: string;
  pointerEvents: string;
  textDecorationLine: string;
}

/** Renders a button with the given classes on the page and reads its computed style. */
async function styleOf(
  page: Page,
  classes: string,
  options: { disabled?: boolean; hover?: boolean } = {},
): Promise<ButtonStyle> {
  await page.evaluate(
    ({ classes, disabled }) => {
      document.getElementById('probe')?.remove();
      const button = document.createElement('button');
      button.id = 'probe';
      button.className = classes;
      button.textContent = 'Probe';
      button.style.transition = 'none'; // colours are asserted, not the hover animation
      button.disabled = disabled;
      document.body.appendChild(button);
    },
    { classes, disabled: options.disabled ?? false },
  );
  if (options.hover) {
    await page.locator('#probe').hover();
    await page.waitForTimeout(100);
  }
  return page.evaluate(() => {
    const style = getComputedStyle(document.getElementById('probe')!);
    return {
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      borderTopWidth: style.borderTopWidth,
      borderTopLeftRadius: style.borderTopLeftRadius,
      lineHeightRatio: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      textDecorationLine: style.textDecorationLine,
    };
  });
}

const BLACK = 'rgb(0, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const DEFAULT_PRIMARY = 'rgb(10, 93, 156)';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

test.describe('button geometry is Apex’s (Bootstrap 5 + Apex variables)', () => {
  test('.btn: padding .375rem .75rem, 1px border, radius .375rem, line-height 1.5', async ({
    page,
  }) => {
    await page.goto('/login');
    const btn = await styleOf(page, 'btn btn-primary');
    expect(btn).toMatchObject({
      paddingTop: '6px',
      paddingRight: '12px',
      borderTopWidth: '1px',
      borderTopLeftRadius: '6px',
    });
    expect(btn.lineHeightRatio).toBeCloseTo(1.5, 2);
  });

  test('.btn-sm: .25rem .5rem, radius .25rem — .btn-lg: .5rem 1rem, radius .5rem', async ({
    page,
  }) => {
    await page.goto('/login');
    expect(await styleOf(page, 'btn btn-primary btn-sm')).toMatchObject({
      paddingTop: '4px',
      paddingRight: '8px',
      borderTopLeftRadius: '4px',
    });
    expect(await styleOf(page, 'btn btn-primary btn-lg')).toMatchObject({
      paddingTop: '8px',
      paddingRight: '16px',
      borderTopLeftRadius: '8px',
    });
  });

  test('disabled buttons are dimmed to .65 and take no pointer events', async ({ page }) => {
    await page.goto('/login');
    expect(await styleOf(page, 'btn btn-primary', { disabled: true })).toMatchObject({
      opacity: '0.65',
      pointerEvents: 'none',
    });
  });

  test('.btn-link is underlined text, no fill', async ({ page }) => {
    await page.goto('/login');
    expect(await styleOf(page, 'btn btn-link')).toMatchObject({
      backgroundColor: TRANSPARENT,
      textDecorationLine: 'underline',
    });
  });
});

test.describe('colours come from the theme tokens', () => {
  test('default theme: primary fill is the theme’s blue, outline fills on hover', async ({
    page,
  }) => {
    await page.goto('/login');
    expect(await styleOf(page, 'btn btn-primary')).toMatchObject({
      color: WHITE,
      backgroundColor: DEFAULT_PRIMARY,
      borderTopColor: DEFAULT_PRIMARY,
    });
    expect(await styleOf(page, 'btn btn-outline-primary')).toMatchObject({
      color: DEFAULT_PRIMARY,
      backgroundColor: TRANSPARENT,
      borderTopColor: DEFAULT_PRIMARY,
    });
    expect(await styleOf(page, 'btn btn-outline-primary', { hover: true })).toMatchObject({
      color: WHITE,
      backgroundColor: DEFAULT_PRIMARY,
    });
  });

  test('apex theme: black primary, white text; outline is black and fills black on hover', async ({
    page,
  }) => {
    await withInstanceConfig(page, WITH_APEX);
    await page.goto('/login');
    await expect(page.locator('html')).toHaveCSS('--oxfe-color-primary', '#000000', {
      timeout: 20_000,
    });
    expect(await styleOf(page, 'btn btn-primary')).toMatchObject({
      color: WHITE,
      backgroundColor: BLACK,
      borderTopColor: BLACK,
    });
    expect(await styleOf(page, 'btn btn-outline-primary')).toMatchObject({
      color: BLACK,
      backgroundColor: TRANSPARENT,
      borderTopColor: BLACK,
    });
    expect(await styleOf(page, 'btn btn-outline-primary', { hover: true })).toMatchObject({
      color: WHITE,
      backgroundColor: BLACK,
    });
  });
});

test('the storefront’s own buttons use the shared styles (sign-in, add to cart)', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByTestId('login-form').locator('button[type=submit]')).toHaveClass(
    /\bbtn\b.*\bbtn-primary\b/,
  );
  await page.goto('/shop/product/066e3ce119c43c81cc0e46d4f1681eed');
  await expect(page.getByTestId('add-to-cart')).toHaveClass(/\bbtn-primary\b/);
  await expect(page.getByTestId('add-to-cart')).toHaveCSS('border-top-left-radius', '6px');
});
