import { EventBus, PluginRegistry, type IPlugin, type PaymentPlugin } from '@dantweb/oxid-fe-core';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import checkoutPlugin from '../../plugins/checkout';
import GuestCheckoutView from '../../plugins/checkout/views/GuestCheckoutView.vue';
import CheckoutEntry from '../../plugins/checkout/views/CheckoutEntry.vue';
import checkoutEn from '../../plugins/checkout/i18n/en.json';
import en from '../../src/i18n/en.json';
import { failure, mountView, RAW_SHOP_MESSAGE, settle, setValue } from './helpers/mountView';

const COUNTRIES = [
  { id: 'c-us', title: 'United States' },
  { id: 'a7c40f631fc920687.20179984', title: 'Germany' },
];

const start = vi.fn();
function fakeStripe(): PaymentPlugin {
  return {
    name: 'payment-stripe',
    version: '0.0.0',
    paymentId: 'oe_payments_stripe_wallet',
    start,
    checkoutReturn: vi.fn(),
    cancel: vi.fn(),
  } as unknown as PaymentPlugin;
}

interface Calls {
  mutations: string[];
}

function shop(calls: Calls) {
  return (query: string) => {
    if (query.includes('checkoutCountries')) {
      return { countries: COUNTRIES };
    }
    calls.mutations.push(query.match(/(basket\w+)\(/)?.[1] ?? query);
    return { basketCreate: { id: 'b-1' }, basketAddItem: { id: 'b-1' } };
  };
}

async function mountGuest(options: { start?: () => unknown; cart?: boolean } = {}) {
  localStorage.setItem(
    'oxfe_shop_cart',
    JSON.stringify(
      options.cart === false
        ? []
        : [{ productId: 'p-1', title: 'Destiny', price: 10, currencyName: 'EUR', amount: 2 }],
    ),
  );
  start.mockReset();
  start.mockImplementation(
    options.start ??
      (async () => ({
        contractId: 'c-9',
        contractToken: 't-9',
        orderNumber: '900',
        redirectUrl: 'about:blank#pay',
        renderMode: 'redirect',
      })),
  );
  const registry = new PluginRegistry();
  registry.register(checkoutPlugin);
  registry.register(fakeStripe() as IPlugin);
  const calls: Calls = { mutations: [] };
  const mounted = await mountView(GuestCheckoutView, {
    registry,
    handler: shop(calls),
    setup: (context) => {
      Object.assign(context.auth, { ensureSession: vi.fn().mockResolvedValue(undefined) });
      checkoutPlugin.setup?.(context);
    },
  });
  return { ...mounted, calls };
}

function fillGuest(host: HTMLElement, overrides: Record<string, string> = {}): void {
  const values: Record<string, string> = {
    email: 'gerda@example.com',
    firstName: 'Gerda',
    lastName: 'Gast',
    street: 'Bertoldstr',
    streetNumber: '48',
    zipCode: '79098',
    city: 'Freiburg',
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    setValue(host, `[data-testid=guest-form] input[name=${name}]`, value);
  }
}

async function chooseAndPay(host: HTMLElement): Promise<void> {
  host.querySelector<HTMLInputElement>('[data-testid=payment-oe_payments_stripe_wallet]')?.click();
  host.querySelector<HTMLInputElement>('[data-testid=confirm-terms]')?.click();
  await settle();
  host.querySelector<HTMLButtonElement>('[data-testid=pay-now]')?.click();
  await settle();
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('GuestCheckoutView (140c C3)', () => {
  it('shows the guest form with the shop countries and the instance payment plugins', async () => {
    const { host } = await mountGuest();

    expect(host.querySelector('[data-testid=guest-form]')).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('select[name=countryId] option')).map((o) =>
        o.textContent?.trim(),
      ),
    ).toEqual(['United States', 'Germany']);
    expect(host.querySelector<HTMLSelectElement>('select[name=countryId]')?.value).toBe(
      'a7c40f631fc920687.20179984',
    );
    expect(host.querySelector('[data-testid=payment-oe_payments_stripe_wallet]')).not.toBeNull();
    expect(host.querySelector('[data-testid=pay-now]')?.hasAttribute('disabled')).toBe(true);
  });

  it('shows an empty-cart note instead of the form when there is nothing to pay', async () => {
    const { host } = await mountGuest({ cart: false });

    expect(host.querySelector('[data-testid=guest-cart-empty]')).not.toBeNull();
    expect(host.querySelector('[data-testid=guest-form]')).toBeNull();
  });

  it('marks the missing fields and starts nothing while the details are incomplete', async () => {
    const { host, calls } = await mountGuest();

    await chooseAndPay(host);

    expect(host.querySelectorAll('.field-error').length).toBeGreaterThanOrEqual(7);
    expect(host.textContent).toContain(checkoutEn.guest.invalid.required);
    expect(calls.mutations).toEqual([]);
    expect(start).not.toHaveBeenCalled();
  });

  it('builds an anonymous basket, then starts the payment with the guest details', async () => {
    const { host, calls } = await mountGuest();
    fillGuest(host);

    await chooseAndPay(host);

    expect(calls.mutations).toEqual(['basketCreate', 'basketAddItem']);
    expect(start).toHaveBeenCalledTimes(1);
    const [basketId, options] = start.mock.calls[0];
    expect(basketId).toBe('b-1');
    expect(options.guest).toMatchObject({
      email: 'gerda@example.com',
      invoiceAddress: {
        firstName: 'Gerda',
        zipCode: '79098',
        countryId: 'a7c40f631fc920687.20179984',
      },
    });
    expect(options.guest.deliveryAddress).toBeUndefined();
    expect(options.returnUrl).toMatch(/\/checkout\/return\/payment-stripe$/);
    expect(host.querySelector('[data-testid=redirecting]')).not.toBeNull();
  });

  it('sends a second address only after "deliver elsewhere" was ticked and filled', async () => {
    const { host } = await mountGuest();
    fillGuest(host);
    host.querySelector<HTMLInputElement>('[data-testid=guest-deliver-elsewhere]')?.click();
    await settle();
    for (const [name, value] of Object.entries({
      deliveryFirstName: 'Hans',
      deliveryLastName: 'Gast',
      deliveryStreet: 'Hauptstr',
      deliveryStreetNumber: '1',
      deliveryZipCode: '10115',
      deliveryCity: 'Berlin',
    })) {
      setValue(host, `input[name=${name}]`, value);
    }

    await chooseAndPay(host);

    expect(start.mock.calls[0][1].guest.deliveryAddress).toMatchObject({
      firstName: 'Hans',
      city: 'Berlin',
    });
  });

  it('keeps the guest details in memory only; sessionStorage holds the attempt without them', async () => {
    const { host } = await mountGuest();
    fillGuest(host);

    await chooseAndPay(host);

    const stored = JSON.stringify({ ...sessionStorage, ...localStorage });
    expect(stored).toContain('t-9');
    expect(stored).not.toContain('gerda@example.com');
    expect(stored).not.toContain('Bertoldstr');
  });

  it('account_exists: translated text and a login link that returns to the checkout', async () => {
    const { host } = await mountGuest({
      start: async () => {
        throw failure('account_exists');
      },
    });
    fillGuest(host);

    await chooseAndPay(host);

    expect(host.querySelector('[data-testid=checkout-error]')?.textContent).toContain(
      en.errors.account_exists,
    );
    expect(host.textContent).not.toContain(RAW_SHOP_MESSAGE);
    const link = host.querySelector('[data-testid=guest-login-link]');
    expect(link?.getAttribute('href')).toBe('/login?redirect=/checkout');
  });

  it('guest_details_required from the shop is shown translated, never the field names it carries', async () => {
    const { host } = await mountGuest({
      start: async () => {
        throw failure('guest_details_required');
      },
    });
    fillGuest(host);

    await chooseAndPay(host);

    expect(host.querySelector('[data-testid=checkout-error]')?.textContent).toContain(
      en.errors.guest_details_required,
    );
    expect(host.querySelector('[data-testid=guest-login-link]')).toBeNull();
  });
});

describe('CheckoutEntry — which checkout a shopper gets', () => {
  async function mountEntry(authenticated: boolean, events = new EventBus()) {
    const registry = new PluginRegistry();
    registry.register(checkoutPlugin);
    const mounted = await mountView(CheckoutEntry, {
      registry,
      handler: () => ({ countries: COUNTRIES }),
      setup: (context) => {
        Object.assign(context.auth, { isAuthenticated: () => authenticated });
        Object.assign(context, { events });
        checkoutPlugin.setup?.(context);
      },
    });
    await settle();
    return { ...mounted, events };
  }

  it('gives a logged-in shopper the customer checkout, never the guest form', async () => {
    const { host } = await mountEntry(true);

    await vi.waitFor(() => expect(host.querySelector('[data-testid=address-form]')).not.toBeNull());
    expect(host.querySelector('[data-testid=guest-form]')).toBeNull();
  });

  it('gives a shopper without a customer session the guest checkout', async () => {
    localStorage.setItem(
      'oxfe_shop_cart',
      JSON.stringify([{ productId: 'p', title: 't', price: 1, currencyName: 'EUR', amount: 1 }]),
    );
    const { host } = await mountEntry(false);

    await vi.waitFor(() => expect(host.querySelector('[data-testid=guest-form]')).not.toBeNull());
    expect(host.querySelector('[data-testid=address-form]')).toBeNull();
  });
});
