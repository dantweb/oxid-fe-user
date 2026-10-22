import type { GuestDetails } from '@dantweb/oxid-fe-core';
import { defineStore } from 'pinia';

interface CheckoutAttempt {
  provider: string;
  contractId: string;
  contractToken: string;
  orderNumber: string | null;
}

/**
 * The open checkout attempt. Persisted in sessionStorage because the shopper
 * leaves to the PSP and comes back — the contractToken is the proof of
 * ownership for return/cancel and must survive that round trip.
 */
const STORAGE_KEY = 'oxfe_checkout_attempt';

function loadAttempt(): CheckoutAttempt | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CheckoutAttempt) : null;
  } catch {
    return null;
  }
}

export const useCheckoutStore = defineStore('checkout', {
  // `guest` (sprint 140c) is deliberately NOT persisted: e-mail and addresses of a shopper without
  // an account stay in this page view's memory and are gone with a reload (138e policy).
  state: () => ({ attempt: loadAttempt(), guest: null as GuestDetails | null }),
  actions: {
    setAttempt(attempt: CheckoutAttempt): void {
      this.attempt = attempt;
      try {
        globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(attempt));
      } catch {
        /* state survives in memory for this tab */
      }
    },
    setGuest(details: GuestDetails): void {
      this.guest = details;
    },
    clear(): void {
      this.attempt = null;
      this.guest = null;
      try {
        globalThis.sessionStorage?.removeItem(STORAGE_KEY);
      } catch {
        /* nothing stored */
      }
    },
  },
});
