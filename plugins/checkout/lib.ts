import type { PaymentPlugin } from '@dantweb/oxid-fe-core';
import type { BasketPayment } from './api/queries';

export interface PaymentChoice {
  payment: BasketPayment;
  /** null → classic path: basketSetPayment + placeOrder */
  plugin: PaymentPlugin | null;
}

/**
 * payment-base's provider modules (Stripe, PayPal, Mollie, …) register their payments under this
 * prefix; they are paid through `<provider>CheckoutStart`, never through the classic placeOrder.
 */
const CONTRACT_FIRST_PREFIX = 'oe_payments_';

/**
 * Maps the shop's offered payments to installed payment plugins. A contract-first payment whose
 * plugin this instance does not run is hidden (it could only fail); everything else without a
 * plugin — invoice, COD, … — stays on the classic basketSetPayment + placeOrder path, the same
 * split payment-base enforces server-side.
 */
export function mapPayments(
  payments: BasketPayment[],
  pluginFor: (paymentId: string) => PaymentPlugin | null,
): PaymentChoice[] {
  return payments
    .map((payment) => ({ payment, plugin: pluginFor(payment.id) }))
    .filter(
      (choice) => choice.plugin !== null || !choice.payment.id.startsWith(CONTRACT_FIRST_PREFIX),
    );
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
