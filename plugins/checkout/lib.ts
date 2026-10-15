import type { PaymentPlugin } from '@dantweb/oxid-fe-core';
import type { BasketPayment } from './api/queries';

export interface PaymentChoice {
  payment: BasketPayment;
  /** null → classic path: basketSetPayment + placeOrder */
  plugin: PaymentPlugin | null;
}

/**
 * Maps the shop's offered payments to installed payment plugins; ids without
 * a plugin stay on the classic placeOrder path (invoice, COD, …) — the same
 * split payment-base enforces server-side.
 */
export function mapPayments(
  payments: BasketPayment[],
  pluginFor: (paymentId: string) => PaymentPlugin | null,
): PaymentChoice[] {
  return payments.map((payment) => ({ payment, plugin: pluginFor(payment.id) }));
}

export function checkoutUrls(
  origin: string,
  provider: string,
): { returnUrl: string; cancelUrl: string } {
  const base = origin.replace(/\/$/, '');
  return {
    returnUrl: `${base}/checkout/return/${provider}`,
    cancelUrl: `${base}/checkout/cancel/${provider}`,
  };
}
