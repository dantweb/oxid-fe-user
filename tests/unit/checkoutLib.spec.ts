import type { PaymentPlugin } from '@dantweb/oxid-fe-core';
import { describe, expect, it } from 'vitest';
import { checkoutUrls, mapPayments } from '../../plugins/checkout/lib';

const paypalPlugin = { name: 'payment-paypal', paymentId: 'oe_payments_paypal' } as PaymentPlugin;

describe('mapPayments', () => {
  it('pairs contract-first ids with their plugin and leaves the rest classic', () => {
    const payments = [
      { id: 'oe_payments_paypal', title: 'PayPal' },
      { id: 'oxidinvoice', title: 'Invoice' },
    ];

    const mapped = mapPayments(payments, (id) =>
      id === 'oe_payments_paypal' ? paypalPlugin : null,
    );

    expect(mapped[0].plugin).toBe(paypalPlugin);
    expect(mapped[1].plugin).toBeNull();
    expect(mapped.map((entry) => entry.payment.title)).toEqual(['PayPal', 'Invoice']);
  });
});

describe('checkoutUrls', () => {
  it('builds provider-scoped return and cancel urls without double slashes', () => {
    expect(checkoutUrls('http://localhost:5173/', 'payment-paypal')).toEqual({
      returnUrl: 'http://localhost:5173/checkout/return/payment-paypal',
      cancelUrl: 'http://localhost:5173/checkout/cancel/payment-paypal',
    });
  });
});
