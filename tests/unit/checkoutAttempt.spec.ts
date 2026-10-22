import { CoreEvents, EventBus, type IPlugin, type PaymentPlugin } from '@dantweb/oxid-fe-core';
import { PluginRegistry } from '@dantweb/oxid-fe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import checkoutPlugin from '../../plugins/checkout';
import CancelView from '../../plugins/checkout/views/CancelView.vue';
import ReturnView from '../../plugins/checkout/views/ReturnView.vue';
import { useCheckoutStore } from '../../plugins/checkout/stores/checkout';
import { failure, mountView } from './helpers/mountView';

const STORAGE_KEY = 'oxfe_checkout_attempt';
const attempt = {
  provider: 'payment-fake',
  contractId: 'c-1',
  contractToken: 't-1',
  orderNumber: '832',
};
const stored = (): string | null => sessionStorage.getItem(STORAGE_KEY);

type ReturnResult = Awaited<ReturnType<PaymentPlugin['checkoutReturn']>>;

function fakeProvider(checkoutReturn: PaymentPlugin['checkoutReturn']): PaymentPlugin {
  return {
    name: 'payment-fake',
    version: '0.0.0',
    paymentId: 'oe_payments_fake',
    start: vi.fn(),
    checkoutReturn,
    cancel: vi.fn().mockResolvedValue({ cancelled: true }),
  } as unknown as PaymentPlugin;
}

async function mountReturn(provider: PaymentPlugin, route = '/checkout/return/payment-fake') {
  const registry = new PluginRegistry();
  registry.register(provider as IPlugin);
  return mountView(ReturnView, {
    registry,
    route,
    props: { provider: 'payment-fake' },
    setup: (context) => checkoutPlugin.setup?.(context),
  });
}

beforeEach(() => {
  sessionStorage.clear();
  setActivePinia(createPinia());
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
});
afterEach(() => vi.useRealTimers());

describe('oxfe_checkout_attempt is dropped when it has served its purpose (138e E3)', () => {
  it('on logout (CoreEvents.AuthLogout)', () => {
    const events = new EventBus();
    checkoutPlugin.setup?.({ events } as never);
    expect(stored()).not.toBeNull();

    events.emit(CoreEvents.AuthLogout);

    expect(stored()).toBeNull();
    expect(useCheckoutStore().attempt).toBeNull();
  });

  it('on a return the provider reports as failed', async () => {
    const provider = fakeProvider(async () => ({ status: 'failed' }) as ReturnResult);

    const { host } = await mountReturn(provider);

    expect(host.querySelector('[data-testid=return-failed]')).not.toBeNull();
    expect(stored()).toBeNull();
  });

  it('on a committed return', async () => {
    const provider = fakeProvider(
      async () => ({ status: 'committed', orderNumber: '832' }) as ReturnResult,
    );

    const { host } = await mountReturn(provider);

    expect(host.querySelector('[data-testid=return-committed]')).not.toBeNull();
    expect(stored()).toBeNull();
  });

  it('after the pending timeout, not before', async () => {
    vi.useFakeTimers();
    const checkoutReturn = vi.fn(async () => ({ status: 'pending' }) as ReturnResult);
    const { host, settle } = await mountReturn(fakeProvider(checkoutReturn));

    expect(stored()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(4 * 2000 + 100);
    await settle();
    expect(stored()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    await settle();

    expect(checkoutReturn).toHaveBeenCalledTimes(5);
    expect(host.querySelector('[data-testid=return-pending]')).not.toBeNull();
    expect(stored()).toBeNull();
  });

  it('keeps the attempt when the shop was merely unreachable (a reload can retry)', async () => {
    const provider = fakeProvider(async () => {
      throw failure('network_error');
    });

    const { host } = await mountReturn(provider);

    expect(host.querySelector('[data-testid=return-failed]')).not.toBeNull();
    expect(stored()).not.toBeNull();
  });

  it('drops it when the shop refused the return', async () => {
    const provider = fakeProvider(async () => {
      throw failure('contract_not_found');
    });

    await mountReturn(provider);

    expect(stored()).toBeNull();
  });

  it('keeps the attempt of another provider untouched', async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...attempt, provider: 'payment-other' }));

    const { host } = await mountReturn(
      fakeProvider(async () => ({ status: 'committed' }) as never),
    );

    expect(host.querySelector('[data-testid=return-failed]')).not.toBeNull();
    expect(stored()).not.toBeNull();
  });

  it('on cancel', async () => {
    const registry = new PluginRegistry();
    registry.register(fakeProvider(vi.fn()) as IPlugin);
    await mountView(CancelView, {
      registry,
      props: { provider: 'payment-fake' },
      setup: (context) => checkoutPlugin.setup?.(context),
    });

    expect(stored()).toBeNull();
  });
});
