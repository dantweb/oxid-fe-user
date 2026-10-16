import { defineStore } from 'pinia';

export interface CartItem {
  productId: string;
  title: string;
  price: number;
  currencyName: string;
  amount: number;
}

/** Guest cart lives in localStorage (vbwd shop-plugin pattern); user-basket sync lands with checkout. */
const STORAGE_KEY = 'oxfe_shop_cart';

function loadItems(): CartItem[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function persistItems(items: CartItem[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — cart stays in memory */
  }
}

export const useCartStore = defineStore('shop-cart', {
  state: () => ({ items: loadItems() }),
  getters: {
    itemCount: (state): number => state.items.reduce((sum, item) => sum + item.amount, 0),
    /** Distinct products (SKUs) in the cart — two units of one product count once. */
    skuCount: (state): number => state.items.length,
    subtotal: (state): number =>
      state.items.reduce((sum, item) => sum + item.amount * item.price, 0),
    isEmpty(): boolean {
      return this.items.length === 0;
    },
  },
  actions: {
    addItem(item: Omit<CartItem, 'amount'>, amount = 1): void {
      const existing = this.items.find((entry) => entry.productId === item.productId);
      if (existing) {
        existing.amount += amount;
      } else {
        this.items.push({ ...item, amount });
      }
      persistItems(this.items);
    },
    updateAmount(productId: string, amount: number): void {
      if (amount <= 0) {
        this.removeItem(productId);
        return;
      }
      const entry = this.items.find((item) => item.productId === productId);
      if (entry) {
        entry.amount = amount;
        persistItems(this.items);
      }
    },
    removeItem(productId: string): void {
      this.items = this.items.filter((item) => item.productId !== productId);
      persistItems(this.items);
    },
    clear(): void {
      this.items = [];
      persistItems(this.items);
    },
  },
});
