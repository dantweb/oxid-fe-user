import { GraphqlError } from '@dantweb/oxid-fe-core';
import { describe, expect, it, vi } from 'vitest';
import { loadOrders } from '../../plugins/dashboard/api/orders';
import { ORDERS_QUERY } from '../../plugins/dashboard/api/queries';
import { paymentBadgeFor } from '../../plugins/dashboard/paymentBadge';
import OrdersView from '../../plugins/dashboard/views/OrdersView.vue';
import dashboardPlugin from '../../plugins/dashboard';
import { PluginRegistry } from '@dantweb/oxid-fe-core';
import { mountView } from './helpers/mountView';

const order = (extra: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNumber: 832,
  ordered: '2026-10-22T10:00:00+00:00',
  paid: null,
  cancelled: false,
  cost: { total: 12.5, currency: { name: 'EUR' } },
  items: [],
  ...extra,
});

describe('paymentBadgeFor — the contract state of an order, as a badge', () => {
  it.each([
    ['committed', 'completed', 'success'],
    ['fulfilled', 'completed', 'success'],
    ['ready_to_commit', 'processing', 'info'],
    ['authorized', 'authorized', 'info'],
    ['pending', 'pending', 'warning'],
    ['draft', 'pending', 'warning'],
    ['failed', 'failed', 'danger'],
    ['cancelled', 'cancelled', 'neutral'],
    ['expired', 'expired', 'neutral'],
  ])('maps %s to the %s badge (%s)', (state, key, tone) => {
    expect(paymentBadgeFor({ state, provider: 'stripe' })).toMatchObject({ key, tone });
  });

  it('ignores the case of the state', () => {
    expect(paymentBadgeFor({ state: 'COMMITTED', provider: 'stripe' })?.key).toBe('completed');
  });

  it('shows an unknown state as "unknown" instead of hiding the payment', () => {
    expect(paymentBadgeFor({ state: 'quantum', provider: 'stripe' })).toMatchObject({
      key: 'unknown',
      tone: 'neutral',
    });
  });

  it('has no badge for an order without a contract (classic payment)', () => {
    expect(paymentBadgeFor(null)).toBeNull();
    expect(paymentBadgeFor(undefined)).toBeNull();
  });

  it('names the provider for display', () => {
    expect(paymentBadgeFor({ state: 'committed', provider: 'stripe' })?.provider).toBe('Stripe');
    expect(paymentBadgeFor({ state: 'committed', provider: 'paypal' })?.provider).toBe('PayPal');
    expect(paymentBadgeFor({ state: 'committed', provider: 'mollie' })?.provider).toBe('Mollie');
    expect(paymentBadgeFor({ state: 'committed', provider: 'acme' })?.provider).toBe('Acme');
  });
});

describe('loadOrders — the optional paymentContract selection', () => {
  it('asks for paymentContract { state provider }', () => {
    expect(ORDERS_QUERY).toMatch(/paymentContract\s*\{\s*state\s+provider\s*\}/);
  });

  it('returns the orders of a shop that has the field', async () => {
    const execute = vi.fn().mockResolvedValue({
      customer: {
        orders: [order({ paymentContract: { state: 'committed', provider: 'stripe' } })],
      },
    });

    const orders = await loadOrders({ execute } as never);

    expect(orders[0].paymentContract).toEqual({ state: 'committed', provider: 'stripe' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('asks again without the selection when the shop does not know the field', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        new GraphqlError('Cannot query field "paymentContract" on type "Order".', 'graphql', [
          { message: 'Cannot query field "paymentContract" on type "Order".' },
        ]),
      )
      .mockResolvedValueOnce({ customer: { orders: [order()] } });

    const orders = await loadOrders({ execute } as never);

    expect(orders).toHaveLength(1);
    expect(execute.mock.calls[1][0]).not.toContain('paymentContract');
  });

  it('does not swallow other failures', async () => {
    const execute = vi.fn().mockRejectedValue(new GraphqlError('boom', 'network_error', []));

    await expect(loadOrders({ execute } as never)).rejects.toThrow('boom');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe('OrdersView — payment state badge', () => {
  async function mountOrders(orders: unknown[]) {
    const registry = new PluginRegistry();
    registry.register(dashboardPlugin);
    return mountView(OrdersView, {
      registry,
      setup: (context) => dashboardPlugin.setup?.(context),
      handler: (query) => {
        if (query.includes('accountOrders')) {
          return { customer: { orders } };
        }
        return {
          customer: { firstName: 'Ada', email: 'a@b.de', orders: [], reviews: [], files: [] },
        };
      },
    });
  }

  it('shows the badge with the provider for an order with a contract', async () => {
    const { host } = await mountOrders([
      order({ paymentContract: { state: 'committed', provider: 'stripe' } }),
    ]);
    const badge = host.querySelector('[data-testid=order-payment-badge]');

    expect(badge?.textContent).toContain('Stripe');
    expect(badge?.getAttribute('data-state')).toBe('completed');
  });

  it('shows no badge for a classic order', async () => {
    const { host } = await mountOrders([order({ paymentContract: null })]);

    expect(host.querySelector('[data-testid=order-row]')).not.toBeNull();
    expect(host.querySelector('[data-testid=order-payment-badge]')).toBeNull();
  });
});
