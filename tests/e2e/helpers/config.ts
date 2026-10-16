import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Answers /oxid-config.yaml for one page with the given YAML — every instance scenario can then
 * be produced against any target (dev server, container, public URL) without redeploying.
 */
export async function withInstanceConfig(page: Page, yaml: string): Promise<void> {
  await page.route('**/oxid-config.yaml', (route) =>
    route.fulfill({ status: 200, contentType: 'application/yaml', body: yaml }),
  );
}

/** An instance running the peroxid layout plugin (listed last so it wins its slots). */
export const PEROXID_CONFIG = `plugins:
  shop: {}
  checkout: {}
  dashboard: {}
  peroxid: {}
`;

/** Runs a storefront GraphQL query through the deployment under test. */
export async function storefront<T>(
  request: APIRequestContext,
  query: string,
  baseUrl: string,
): Promise<T> {
  const response = await request.post(`${baseUrl}/graphql/`, {
    data: { query },
    headers: { 'User-Agent': 'Mozilla/5.0 (playwright)' },
  });
  return (await response.json()).data as T;
}

/** Every payment plugin on its hosted (redirect) page — for specs that prove the redirect flow. */
export const HOSTED_PAYMENTS_CONFIG = `plugins:
  shop: {}
  checkout: {}
  dashboard: {}
  payment-paypal:
    config:
      mode: redirect
  payment-stripe:
    config:
      mode: redirect
  payment-mollie:
    config:
      mode: redirect
`;
