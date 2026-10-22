import { describe, expect, it } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import checkoutPlugin from '../../plugins/checkout';
import { guestCheckoutGuard } from '../../src/router';
import { parseInstanceConfig } from './helpers/yamlConfig';

const route = (meta: Record<string, unknown>, fullPath = '/checkout'): RouteLocationNormalized =>
  ({ fullPath, matched: [{ meta }], meta }) as unknown as RouteLocationNormalized;
const shopper = (authenticated: boolean) => ({ isAuthenticated: () => authenticated });

describe('checkout.guest — instance option (140c C4)', () => {
  it('is on by default and boolean only', () => {
    expect(parseInstanceConfig('').checkout.guest).toBe(true);
    expect(parseInstanceConfig('checkout: { guest: false }').checkout.guest).toBe(false);
    expect(() => parseInstanceConfig('checkout: { guest: maybe }')).toThrow(/invalid/);
  });
});

describe('checkout routes — no login wall of their own (140c C3)', () => {
  it('none of the three requires auth by itself; each is marked as open to guests', () => {
    expect(checkoutPlugin.routes?.length).toBe(3);
    for (const entry of checkoutPlugin.routes ?? []) {
      expect(entry.meta?.requiresAuth, entry.path).toBeUndefined();
      expect(entry.meta?.guestCheckout, entry.path).toBe(true);
    }
  });
});

describe('guestCheckoutGuard', () => {
  it('lets a guest through to a guest-checkout route when the instance allows it', () => {
    expect(guestCheckoutGuard(shopper(false), true)(route({ guestCheckout: true }))).toBe(true);
  });

  it('sends a guest to the login when the instance turns guest checkout off (as before 140c)', () => {
    const outcome = guestCheckoutGuard(shopper(false), false)(route({ guestCheckout: true }));

    expect(outcome).toEqual({ path: '/login', query: { redirect: '/checkout' } });
  });

  it('never stops a logged-in shopper', () => {
    expect(guestCheckoutGuard(shopper(true), false)(route({ guestCheckout: true }))).toBe(true);
  });

  it('leaves every other route to the auth guard', () => {
    expect(guestCheckoutGuard(shopper(false), false)(route({ requiresAuth: true }))).toBe(true);
    expect(guestCheckoutGuard(shopper(false), false)(route({}))).toBe(true);
  });
});
