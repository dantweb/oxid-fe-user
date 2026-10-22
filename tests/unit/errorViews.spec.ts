import { PluginRegistry } from '@dantweb/oxid-fe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import ErrorAlert from '../../src/errors/ErrorAlert.vue';
import LoginView from '../../src/views/LoginView.vue';
import ResetPasswordView from '../../src/views/ResetPasswordView.vue';
import checkoutPlugin from '../../plugins/checkout';
import CheckoutView from '../../plugins/checkout/views/CheckoutView.vue';
import dashboardPlugin from '../../plugins/dashboard';
import EmailForm from '../../plugins/dashboard/components/EmailForm.vue';
import AddressesView from '../../plugins/dashboard/views/AddressesView.vue';
import DeleteAccountView from '../../plugins/dashboard/views/DeleteAccountView.vue';
import NewsletterView from '../../plugins/dashboard/views/NewsletterView.vue';
import PasswordView from '../../plugins/dashboard/views/PasswordView.vue';
import ReviewsView from '../../plugins/dashboard/views/ReviewsView.vue';
import { summary } from '../../plugins/dashboard/state';
import dashboardEn from '../../plugins/dashboard/i18n/en.json';
import en from '../../src/i18n/en.json';
import {
  failure,
  mountView,
  RAW_SHOP_MESSAGE,
  settle,
  setValue,
  submit,
  type Handler,
} from './helpers/mountView';

const registryWith = (...plugins: Parameters<PluginRegistry['register']>[0][]): PluginRegistry => {
  const registry = new PluginRegistry();
  plugins.forEach((plugin) => registry.register(plugin));
  return registry;
};
const dashboard = () => ({
  registry: registryWith(dashboardPlugin, checkoutPlugin),
  setup: (context: Parameters<NonNullable<typeof dashboardPlugin.setup>>[0]) =>
    dashboardPlugin.setup?.(context),
});

/** Queries answer, mutations fail with a shop text that must not be shown. */
const failingMutations =
  (queries: Record<string, unknown> = {}): Handler =>
  (query) => {
    if (query.includes('mutation')) {
      throw failure();
    }
    const known = Object.entries(queries).find(([name]) => query.includes(name));
    if (known) {
      return known[1];
    }
    throw failure();
  };

const noRawMessage = (host: HTMLElement): void => {
  expect(host.textContent).not.toContain(RAW_SHOP_MESSAGE);
  expect(host.textContent).not.toContain('internal.example');
};
const textOf = (host: HTMLElement, testId: string): string =>
  host.querySelector(`[data-testid=${testId}]`)?.textContent?.trim() ?? '(missing)';

const ADDRESS = {
  salutation: 'MR',
  firstName: 'Ada',
  lastName: 'Lovelace',
  street: 'Main St',
  streetNumber: '1',
  zipCode: '12345',
  city: 'Berlin',
  country: { id: 'a7c40f631fc920687.20179984' },
};

beforeEach(() => {
  summary.value = null;
});

describe('views never render the raw shop message (sprint 138f F3)', () => {
  it('LoginView: a refused login shows the translated invalid_login text', async () => {
    const { host } = await mountView(LoginView, {
      login: () => Promise.reject(failure('invalid_login')),
    });
    setValue(host, 'input[name=email]', 'a@b.de');
    setValue(host, 'input[name=password]', 'x');
    await submit(host, '[data-testid=login-form]');

    expect(textOf(host, 'login-error')).toBe(en.errors.invalid_login);
    noRawMessage(host);
  });

  it('LoginView: an unknown code shows the view fallback', async () => {
    const { host } = await mountView(LoginView, { login: () => Promise.reject(failure()) });
    setValue(host, 'input[name=email]', 'a@b.de');
    setValue(host, 'input[name=password]', 'x');
    await submit(host, '[data-testid=login-form]');

    expect(textOf(host, 'login-error')).toBe(en.login.failed);
    noRawMessage(host);
  });

  it('ResetPasswordView', async () => {
    const { host } = await mountView(ResetPasswordView, { route: '/reset-password?uid=abc' });
    const inputs = host.querySelectorAll('input');
    inputs.forEach((_input, index) =>
      setValue(host, `label:nth-of-type(${index + 1}) input`, 'secret1'),
    );
    await submit(host, '[data-testid=reset-form]');

    expect(textOf(host, 'reset-error')).toBe(en.reset.failed);
    noRawMessage(host);
  });

  it('PasswordView', async () => {
    const { host } = await mountView(PasswordView, { ...dashboard(), handler: failingMutations() });
    host.querySelectorAll('input').forEach((_input, index) => {
      setValue(host, `label:nth-of-type(${index + 1}) input`, 'secret1');
    });
    await submit(host, '[data-testid=password-form]');

    expect(textOf(host, 'password-error')).toBe(dashboardEn.password.failed);
    noRawMessage(host);
  });

  it('ReviewsView', async () => {
    const { host, settle: wait } = await mountView(ReviewsView, {
      ...dashboard(),
      handler: failingMutations({
        accountReviews: { customer: { reviews: [{ id: 'r1', text: 'nice', rating: 5 }] } },
      }),
    });
    host.querySelector<HTMLElement>('[data-testid=review-delete]')?.click();
    await wait();

    expect(textOf(host, 'reviews-error')).toBe(dashboardEn.reviews.failed);
    noRawMessage(host);
  });

  it('DeleteAccountView', async () => {
    const { host, settle: wait } = await mountView(DeleteAccountView, {
      ...dashboard(),
      handler: failingMutations(),
    });
    host.querySelector<HTMLElement>('[data-testid=delete-confirm]')?.click();
    await wait();

    expect(textOf(host, 'delete-error')).toBe(dashboardEn.delete.failed);
    noRawMessage(host);
  });

  it('EmailForm', async () => {
    const { host } = await mountView(EmailForm, { ...dashboard(), handler: failingMutations() });
    setValue(host, 'input[name=email]', 'new@example.com');
    await submit(host, '[data-testid=email-form]');

    expect(textOf(host, 'email-error')).toBe(dashboardEn.email.failed);
    noRawMessage(host);
  });

  it('NewsletterView', async () => {
    summary.value = {
      firstName: 'Ada',
      email: 'a@b.de',
      newsletterStatus: 'UNSUBSCRIBED',
      counts: { orders: 0, reviews: 0, downloads: 0, wishlist: 0, giftRegistry: 0 },
    };
    const { host, settle: wait } = await mountView(NewsletterView, {
      ...dashboard(),
      handler: failingMutations(),
    });
    host.querySelector<HTMLElement>('[data-testid=newsletter-toggle]')?.click();
    await wait();

    expect(textOf(host, 'newsletter-error')).toBe(dashboardEn.newsletter.failed);
    noRawMessage(host);
  });

  it('AddressesView', async () => {
    const { host } = await mountView(AddressesView, {
      ...dashboard(),
      handler: failingMutations({
        checkoutCustomer: { customerInvoiceAddress: ADDRESS },
        accountDeliveryAddresses: { customerDeliveryAddresses: [] },
      }),
    });
    await submit(host, '[data-testid=invoice-form]');
    const alert = host.querySelector('[data-testid=invoice-form] [role=alert]');

    expect(alert?.textContent?.trim()).toBe(en.errors.generic);
    noRawMessage(host);
  });

  it('CheckoutView: a failing basket shows the wrapped, mapped text', async () => {
    const { host } = await mountView(CheckoutView, {
      registry: registryWith(checkoutPlugin),
      setup: (context) => checkoutPlugin.setup?.(context),
      handler: (query) => {
        if (query.includes('checkoutCustomer')) {
          return { customerInvoiceAddress: ADDRESS };
        }
        throw failure('basket_not_found');
      },
    });
    await settle();

    expect(textOf(host, 'checkout-error')).toBe(
      `The basket could not be prepared: ${en.errors.basket_not_found}`,
    );
    noRawMessage(host);
  });

  it('CheckoutView: a failing address save shows the mapped text', async () => {
    const { host } = await mountView(CheckoutView, {
      registry: registryWith(checkoutPlugin),
      setup: (context) => checkoutPlugin.setup?.(context),
      handler: (query) => {
        if (query.includes('checkoutCustomer')) {
          return { customerInvoiceAddress: null };
        }
        throw failure('invalid_token');
      },
    });
    const form = host.querySelector('[data-testid=address-form]');
    form?.querySelectorAll('input').forEach((input) => {
      input.value = input.name === 'zipCode' ? '12345' : 'Ada';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await submit(host, '[data-testid=address-form]');

    expect(textOf(host, 'address-error')).toBe(en.errors.invalid_token);
    noRawMessage(host);
  });
});

describe('ErrorAlert details block (sprint 138f F4)', () => {
  it('is absent by default', async () => {
    const { host } = await mountView(ErrorAlert, { props: { error: failure('provider_failed') } });

    expect(host.querySelector('[data-testid=error-details]')).toBeNull();
    noRawMessage(host);
  });

  it('shows code and raw message, collapsed, when the instance sets debug.errors', async () => {
    const { host } = await mountView(ErrorAlert, {
      props: { error: failure('provider_failed') },
      debugErrors: true,
    });
    const details = host.querySelector('[data-testid=error-details]');

    expect(details?.tagName).toBe('DETAILS');
    expect(details?.hasAttribute('open')).toBe(false);
    expect(details?.textContent).toContain('provider_failed');
    expect(details?.textContent).toContain(RAW_SHOP_MESSAGE);
  });

  it('shows a pre-translated string as it is, without details', async () => {
    const { host } = await mountView(ErrorAlert, {
      props: { error: 'Passwords differ' },
      debugErrors: true,
    });

    expect(host.textContent).toContain('Passwords differ');
    expect(host.querySelector('[data-testid=error-details]')).toBeNull();
  });
});
