import { expect, test, type Page, type Request } from '@playwright/test';
import { canSignIn } from './helpers/api';
import { fillLogin, registerCustomer, signIn, type Credentials } from './helpers/session';

/**
 * SEAL-1 in the storefront, in a real browser against the real shop: what the browser sends and receives for the
 * chosen operations is read from the NETWORK LOG. Passwords, the e-mail and the address fields never appear in a
 * request body in the plain, the personal data comes back sealed, and the pages still show everything (the app
 * opens the sealed fields). Needs the shop module oxid-sealed-channel.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

interface Exchange {
  operation: string;
  requestBody: string;
  responseBody: string;
}

function recordGraphql(page: Page): { exchanges: Exchange[]; settle: () => Promise<unknown> } {
  const exchanges: Exchange[] = [];
  const pending: Promise<void>[] = [];
  page.on('requestfinished', (request: Request) => {
    if (!request.url().includes('/graphql')) {
      return;
    }
    pending.push(
      (async () => {
        const response = await request.response();
        const body = request.postData() ?? '';
        const query = (JSON.parse(body || '{}') as { query?: string }).query ?? '';
        exchanges.push({
          operation: /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '',
          requestBody: body,
          responseBody: response ? await response.text().catch(() => '') : '',
        });
      })(),
    );
  });
  return { exchanges, settle: () => Promise.all(pending) };
}

const named = (exchanges: Exchange[], operation: string) =>
  exchanges.filter((exchange) => exchange.operation === operation);

let user: Credentials;
test.beforeAll(async ({ request }) => {
  user = await registerCustomer(request, 'fe-seal');
});

test('login: the password never leaves the browser in the plain; the dashboard shows the e-mail from a sealed answer', async ({
  page,
}) => {
  const { exchanges, settle } = recordGraphql(page);

  await page.goto('/login');
  await fillLogin(page, user);
  await page.goto('/dashboard');
  await expect(page.getByTestId('account-email')).toHaveText(user.email);
  await settle();

  const login = named(exchanges, 'sealedLogin')[0];
  expect(login.requestBody).not.toContain(user.password);
  expect(login.requestBody).toContain('SealedValueInput');
  expect(named(exchanges, 'sealedChannelOpen').length).toBeGreaterThanOrEqual(1);
  const summary = named(exchanges, 'accountSummary')[0];
  expect(summary.responseBody).toContain('sealedPii');
  expect(summary.responseBody).not.toContain(user.email);
  // no request of the session carries a password as a plain string (the username of the login stays plain); the anonymous guest
  // `token` query has none to send
  for (const exchange of exchanges) {
    expect(exchange.requestBody, exchange.operation).not.toMatch(/"password":"/);
  }
});

test('addresses and e-mail: the writes travel sealed and the book comes back sealed', async ({
  page,
}) => {
  const { exchanges, settle } = recordGraphql(page);
  await signIn(page, user);
  await page.goto('/dashboard/addresses');

  await page.locator('input[name=firstName]').fill('Acct');
  await page.locator('input[name=lastName]').fill('Sealer');
  await page.locator('input[name=street]').fill('Bertoldstr');
  await page.locator('input[name=streetNumber]').fill('48');
  await page.locator('input[name=zipCode]').fill('79098');
  await page.locator('input[name=city]').fill('Freiburg');
  await page.getByTestId('save-invoice').click();
  await expect(page.getByTestId('invoice-saved')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('add-delivery').click();
  await page.locator('input[name=dFirstName]').fill('Depot');
  await page.locator('input[name=dLastName]').fill('Sealer');
  await page.locator('input[name=dStreet]').fill('Lagerweg');
  await page.locator('input[name=dStreetNumber]').fill('1');
  await page.locator('input[name=dZipCode]').fill('79098');
  await page.locator('input[name=dCity]').fill('Freiburg');
  await page.getByTestId('save-delivery').click();
  await expect(page.getByTestId('delivery-row')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByTestId('delivery-row')).toContainText('Lagerweg');

  const changed = `fe-seal-changed-${Date.now()}@oxid-test.local`;
  await page.locator('[data-testid="email-form"] input[name=email]').fill(changed);
  await page.getByTestId('save-email').click();
  await expect(page.getByTestId('email-saved')).toBeVisible({ timeout: 20_000 });
  user = { ...user, email: changed };
  await settle();

  const writes = [
    ...named(exchanges, 'setInvoiceAddress'),
    ...named(exchanges, 'accountDeliveryAddressAdd'),
    ...named(exchanges, 'accountEmailUpdate'),
  ];
  expect(writes).toHaveLength(3);
  for (const write of writes) {
    for (const plain of ['Bertoldstr', 'Lagerweg', 'Sealer', changed, '79098']) {
      expect(write.requestBody, write.operation).not.toContain(plain);
    }
  }
  const book = named(exchanges, 'accountDeliveryAddresses').at(-1);
  expect(book?.responseBody).toContain('sealedAddress');
  expect(book?.responseBody).not.toContain('Lagerweg');
  const invoice = named(exchanges, 'checkoutCustomer')[0] ?? named(exchanges, 'accountSummary')[0];
  expect(invoice.responseBody).not.toContain(changed);
});

test('password change: neither the old nor the new password is in the request; the new one works', async ({
  page,
  request,
}) => {
  const { exchanges, settle } = recordGraphql(page);
  await signIn(page, user);
  await page.goto('/dashboard/password');
  const next = 'fe-seal-Pass2!';
  await page.locator('input[name=oldPassword]').fill(user.password);
  await page.locator('input[name=newPassword]').fill(next);
  await page.locator('input[name=repeatPassword]').fill(next);
  await page.getByTestId('change-password').click();
  await expect(page.getByTestId('password-changed')).toBeVisible({ timeout: 20_000 });
  await settle();

  const change = named(exchanges, 'accountPasswordChange')[0];
  expect(change.requestBody).not.toContain(user.password);
  expect(change.requestBody).not.toContain(next);
  expect(await canSignIn(request, { ...user, password: next })).toBe(true);
  user = { ...user, password: next };
});

test('a replayed login request is refused by the shop', async ({ page }) => {
  const { exchanges, settle } = recordGraphql(page);
  const requests: { url: string; headers: Record<string, string>; body: string }[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/graphql') && (r.postData() ?? '').includes('sealedLogin')) {
      requests.push({ url: r.url(), headers: r.headers(), body: r.postData() ?? '' });
    }
  });
  await page.goto('/login');
  await fillLogin(page, user);
  await settle();
  expect(named(exchanges, 'sealedLogin')).toHaveLength(1);

  const login = requests[0];
  const replay = await page.request.post(login.url, {
    headers: Object.fromEntries(
      Object.entries(login.headers).filter(
        ([name]) => !name.startsWith(':') && name !== 'content-length',
      ),
    ),
    data: login.body,
  });
  const body = (await replay.json()) as { errors?: { extensions?: { errorCode?: string } }[] };
  expect(body.errors?.[0]?.extensions?.errorCode).toBe('sealed_value_invalid');
});
