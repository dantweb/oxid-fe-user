import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore, type CartItem } from '../../plugins/shop/stores/cart';

const shirt: Omit<CartItem, 'amount'> = {
  productId: 'p-1',
  title: 'Hailys',
  price: 35.99,
  currencyName: 'EUR',
};

describe('useCartStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('adds items and merges repeated products', () => {
    const cart = useCartStore();

    cart.addItem(shirt);
    cart.addItem(shirt, 2);

    expect(cart.items).toHaveLength(1);
    expect(cart.itemCount).toBe(3);
    expect(cart.subtotal).toBeCloseTo(107.97);
    expect(cart.isEmpty).toBe(false);
  });

  it('updates amounts and drops an item at zero', () => {
    const cart = useCartStore();
    cart.addItem(shirt, 2);

    cart.updateAmount('p-1', 5);
    expect(cart.itemCount).toBe(5);

    cart.updateAmount('p-1', 0);
    expect(cart.isEmpty).toBe(true);
  });

  it('removes and clears items', () => {
    const cart = useCartStore();
    cart.addItem(shirt);
    cart.addItem({ ...shirt, productId: 'p-2' });

    cart.removeItem('p-1');
    expect(cart.items.map((item) => item.productId)).toEqual(['p-2']);

    cart.clear();
    expect(cart.isEmpty).toBe(true);
  });

  it('persists across store instances (guest cart survives reload)', () => {
    const cart = useCartStore();
    cart.addItem(shirt, 2);

    setActivePinia(createPinia());
    const reloaded = useCartStore();

    expect(reloaded.itemCount).toBe(2);
    expect(reloaded.items[0].title).toBe('Hailys');
  });

  it('starts empty when localStorage holds garbage', () => {
    localStorage.setItem('oxfe_shop_cart', '{not json');
    setActivePinia(createPinia());

    expect(useCartStore().isEmpty).toBe(true);
  });
});
