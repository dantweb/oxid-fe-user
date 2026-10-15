import { expect, type APIRequestContext, type Page } from '@playwright/test';

export interface Credentials {
  email: string;
  password: string;
}

/** The base URL the suite runs against (a deployed instance, or the local dev server). */
export const DEFAULT_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/** Registers a fresh customer through the storefront API of the given instance. */
export async function registerCustomer(
  request: APIRequestContext,
  prefix: string,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<Credentials> {
  const credentials = {
    email: `${prefix}-${Date.now()}@oxid-test.local`,
    password: `${prefix}-Pass1!`,
  };
  const response = await request.post(`${baseUrl}/graphql/`, {
    data: {
      query: `mutation { customerRegister(customer: { email: "${credentials.email}", password: "${credentials.password}" }) { id } }`,
    },
    headers: { 'User-Agent': 'Mozilla/5.0 (playwright)' },
  });
  expect((await response.json()).data.customerRegister.id).toBeTruthy();
  return credentials;
}

/** Fills and submits the login form on the page that is currently open. */
export async function fillLogin(page: Page, credentials: Credentials): Promise<void> {
  await page.locator('input[name=email]').fill(credentials.email);
  await page.locator('input[name=password]').fill(credentials.password);
  await page.getByTestId('login-form').locator('button[type=submit]').click();
  await expect(page.getByTestId('nav-logout')).toBeVisible({ timeout: 20_000 });
}

export async function signIn(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/login');
  await fillLogin(page, credentials);
}
