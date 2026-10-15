import { isPaymentPlugin, type GraphqlClient, type PluginContext } from '@dantweb/oxid-fe-core';
import { describe, expect, it, vi } from 'vitest';
import mollie from '../../plugins/payment-mollie';
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
