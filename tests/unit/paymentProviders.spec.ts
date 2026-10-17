import { isPaymentPlugin, type GraphqlClient, type PluginContext } from '@dantweb/oxid-fe-core';
import { describe, expect, it, vi } from 'vitest';
import mollie, { mollieLocale } from '../../plugins/payment-mollie';
import paypal from '../../plugins/payment-paypal';
import stripe from '../../plugins/payment-stripe';

const cases = [
  { plugin: paypal, paymentId: 'oe_payments_paypal', startField: 'paypalCheckoutStart' },
  { plugin: stripe, paymentId: 'oe_payments_stripe_wallet', startField: 'stripeCheckoutStart' },
  { plugin: mollie, paymentId: 'oe_payments_mollie', startField: 'mollieCheckoutStart' },
];

describe.each(cases)('$plugin.name', ({ plugin, paymentId, startField }) => {
  it('is a payment plugin for its OXID payment id', () => {
    expect(isPaymentPlugin(plugin)).toBe(true);
    expect(plugin.paymentId).toBe(paymentId);
  });

  it('starts through its provider-prefixed mutation after setup', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ [startField]: { contractId: 'c1', renderMode: 'redirect' } });
    plugin.setup?.({ client: { execute } as unknown as GraphqlClient } as PluginContext);

    const result = await plugin.start('basket-1', { returnUrl: 'https://app/r' });

    expect(result.contractId).toBe('c1');
    expect(execute.mock.calls[0][0]).toContain(`${startField}(`);
  });
});

describe('stripe return', () => {
  it('forwards session_id from the return URL as checkoutSessionId', async () => {
    const execute = vi.fn().mockResolvedValue({ stripeCheckoutReturn: { status: 'committed' } });
    stripe.setup?.({ client: { execute } as unknown as GraphqlClient } as PluginContext);

    await stripe.checkoutReturn('c1', 't1', { session_id: 'cs_test_1' });

    const [document, variables] = execute.mock.calls[0];
    expect(document).toContain('checkoutSessionId: $checkoutSessionId');
    expect(variables).toMatchObject({ checkoutSessionId: 'cs_test_1' });
  });
});

describe.each([
  { plugin: stripe, key: 'publishable_key', value: 'pk_test_1' },
  { plugin: paypal, key: 'client_id', value: 'client-1' },
  { plugin: mollie, key: 'profile_id', value: 'pfl_1' },
])('$plugin.name inline (iframe) mode', ({ plugin, key, value }) => {
  const setupWith = (config: Record<string, unknown>) =>
    plugin.setup?.({ client: {} as GraphqlClient, config } as PluginContext);

  it('offers the inline component once the provider’s public value is configured', () => {
    setupWith({ [key]: value });
    expect(plugin.inlineComponent?.()).toBeTypeOf('function');
  });

  it('falls back to the hosted page without the public value', () => {
    setupWith({});
    expect(plugin.inlineComponent?.()).toBeNull();
  });

  it('falls back to the hosted page with mode: redirect', () => {
    setupWith({ [key]: value, mode: 'redirect' });
    expect(plugin.inlineComponent?.()).toBeNull();
  });
});

describe('mollie start options', () => {
  it('sends the Components card token and the chosen method with the start mutation', async () => {
    const execute = vi.fn().mockResolvedValue({ mollieCheckoutStart: { contractId: 'c1' } });
    mollie.setup?.({
      client: { execute } as unknown as GraphqlClient,
      config: {},
    } as PluginContext);

    await mollie.start('b1', {
      returnUrl: 'https://app/r',
      uiMode: 'embedded',
      providerOptions: { method: 'creditcard', cardToken: 'tkn_1' },
    });

    const [document, variables] = execute.mock.calls[0];
    expect(document).toContain('cardToken: $cardToken');
    expect(variables).toMatchObject({
      uiMode: 'embedded',
      method: 'creditcard',
      cardToken: 'tkn_1',
    });
  });
});

describe('mollieLocale', () => {
  it('follows the active storefront language', () => {
    expect(mollieLocale('de', null)).toBe('de_DE');
    expect(mollieLocale('en', null)).toBe('en_US');
  });

  it('an instance’s explicit locale wins; an unknown language falls back to en_US', () => {
    expect(mollieLocale('de', 'nl_NL')).toBe('nl_NL');
    expect(mollieLocale('xx', null)).toBe('en_US');
  });
});
