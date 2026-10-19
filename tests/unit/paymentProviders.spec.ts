import { isPaymentPlugin, type GraphqlClient, type PluginContext } from '@dantweb/oxid-fe-core';
import { describe, expect, it, vi } from 'vitest';
import { SealedConfigError } from '@dantweb/oxid-fe-core';
import mollie, {
  mollieLocale,
  parseMollieKeys,
  useMollieInline,
} from '../../plugins/payment-mollie';
import paypal, { parsePayPalKeys, usePayPalInline } from '../../plugins/payment-paypal';
import stripe, { parseStripeKeys, useStripeInline } from '../../plugins/payment-stripe';

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

/** The shop never answers: the sealed exchange fails. */
const failingContext = (config: Record<string, unknown> = {}): PluginContext =>
  ({
    client: { execute: vi.fn().mockRejectedValue(new Error('down')) } as unknown as GraphqlClient,
    auth: { payload: () => null },
    config,
  }) as unknown as PluginContext;

describe.each([
  { plugin: stripe, load: () => useStripeInline().loadKeys() },
  { plugin: paypal, load: () => usePayPalInline().loadKeys() },
  { plugin: mollie, load: () => useMollieInline().loadKeys() },
])('$plugin.name inline (iframe) mode', ({ plugin, load }) => {
  it('offers the inline component without any key in the configuration', () => {
    plugin.setup?.(failingContext());
    expect(plugin.inlineComponent?.()).toBeTypeOf('function');
  });

  it('falls back to the hosted page with mode: redirect', () => {
    plugin.setup?.(failingContext({ mode: 'redirect' }));
    expect(plugin.inlineComponent?.()).toBeNull();
  });

  it('falls back to the hosted page when the sealed exchange fails — never to a built-in key', async () => {
    plugin.setup?.(failingContext());

    await expect(load()).rejects.toBeInstanceOf(SealedConfigError);

    expect(plugin.inlineComponent?.()).toBeNull();
  });

  it('a fresh setup (new page) offers inline again', async () => {
    plugin.setup?.(failingContext());
    await load().catch(() => undefined);

    plugin.setup?.(failingContext());

    expect(plugin.inlineComponent?.()).toBeTypeOf('function');
  });
});

describe('what the shop may hand over (allow-listed values only)', () => {
  it('stripe: the publishable key', () => {
    expect(parseStripeKeys({ publishableKey: 'pk-x' })).toEqual({ publishableKey: 'pk-x' });
    expect(() => parseStripeKeys({})).toThrow(SealedConfigError);
    expect(() => parseStripeKeys({ publishableKey: '' })).toThrow(SealedConfigError);
    expect(() => parseStripeKeys({ publishableKey: true })).toThrow(SealedConfigError);
  });

  it('paypal: the client id', () => {
    expect(parsePayPalKeys({ clientId: 'id-1' })).toEqual({ clientId: 'id-1' });
    expect(() => parsePayPalKeys({ clientId: '' })).toThrow(SealedConfigError);
  });

  it('mollie: the profile id and the test mode (the shop decides, default test)', () => {
    expect(parseMollieKeys({ profileId: 'pfl_1', testMode: false })).toEqual({
      profileId: 'pfl_1',
      testMode: false,
    });
    expect(parseMollieKeys({ profileId: 'pfl_1' })).toEqual({ profileId: 'pfl_1', testMode: true });
    expect(() => parseMollieKeys({ testMode: true })).toThrow(SealedConfigError);
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
