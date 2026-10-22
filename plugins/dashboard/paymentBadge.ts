import type { OrderPaymentContract } from './api/queries';

export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface PaymentBadge {
  /** `dashboard.orders.payment.<key>` */
  key: string;
  tone: BadgeTone;
  provider: string;
}

/** contract state (payment-base: DRAFT → PENDING → AUTHORIZED → READY_TO_COMMIT → COMMITTED → FULFILLED | CANCELLED | EXPIRED | FAILED) → badge */
const BY_STATE: Record<string, { key: string; tone: BadgeTone }> = {
  committed: { key: 'completed', tone: 'success' },
  fulfilled: { key: 'completed', tone: 'success' },
  ready_to_commit: { key: 'processing', tone: 'info' },
  authorized: { key: 'authorized', tone: 'info' },
  pending: { key: 'pending', tone: 'warning' },
  draft: { key: 'pending', tone: 'warning' },
  failed: { key: 'failed', tone: 'danger' },
  cancelled: { key: 'cancelled', tone: 'neutral' },
  expired: { key: 'expired', tone: 'neutral' },
};

const PROVIDER_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  mollie: 'Mollie',
};

function providerName(provider: string): string {
  return PROVIDER_NAMES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** The badge for an order's payment; null for an order without a contract (classic payment). */
export function paymentBadgeFor(
  contract: OrderPaymentContract | null | undefined,
): PaymentBadge | null {
  if (!contract) {
    return null;
  }
  const known = BY_STATE[contract.state.toLowerCase()] ?? { key: 'unknown', tone: 'neutral' };
  return { ...known, provider: providerName(contract.provider) };
}
