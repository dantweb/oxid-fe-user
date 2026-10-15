import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCheckoutStore } from '../../plugins/checkout/stores/checkout';

const attempt = {
  provider: 'payment-paypal',
  contractId: 'c-1',
  contractToken: 't-1',
  orderNumber: '832',
};

describe('useCheckoutStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
  });

  it('persists the attempt across store instances (survives the PSP round trip)', () => {
    useCheckoutStore().setAttempt(attempt);

    setActivePinia(createPinia());
    expect(useCheckoutStore().attempt).toEqual(attempt);
  });

  it('clears the attempt', () => {
    const store = useCheckoutStore();
    store.setAttempt(attempt);
    store.clear();

    setActivePinia(createPinia());
    expect(useCheckoutStore().attempt).toBeNull();
  });

  it('tolerates garbage in sessionStorage', () => {
    sessionStorage.setItem('oxfe_checkout_attempt', '{broken');
    setActivePinia(createPinia());
    expect(useCheckoutStore().attempt).toBeNull();
  });
});
