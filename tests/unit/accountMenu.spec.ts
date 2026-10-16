import { describe, expect, it } from 'vitest';
import { buildAccountMenu, type AccountCounts } from '../../plugins/dashboard/menu';

const counts = (over: Partial<AccountCounts> = {}): AccountCounts => ({
  orders: 0,
  reviews: 0,
  downloads: 0,
  wishlist: 0,
  giftRegistry: 0,
  ...over,
});
const keys = (menu: ReturnType<typeof buildAccountMenu>) => menu.map((entry) => entry.key);

describe('buildAccountMenu (Apex: "Where do you want to go?")', () => {
  it('lists the Apex pages in Apex order', () => {
    expect(keys(buildAccountMenu(counts()))).toEqual([
      'dashboard',
      'password',
      'newsletter',
      'addresses',
      'orders',
      'wishlist',
      'giftRegistry',
    ]);
  });

  it('offers reviews only to customers who have written some', () => {
    expect(keys(buildAccountMenu(counts()))).not.toContain('reviews');
    expect(keys(buildAccountMenu(counts({ reviews: 1 })))).toContain('reviews');
  });

  it('offers downloads only to customers who have files', () => {
    expect(keys(buildAccountMenu(counts()))).not.toContain('downloads');
    expect(keys(buildAccountMenu(counts({ downloads: 2 })))).toContain('downloads');
  });

  it('shows count badges on wish list and gift registry only when there is something', () => {
    const menu = buildAccountMenu(counts({ wishlist: 3 }));
    const badge = (key: string) => menu.find((entry) => entry.key === key)?.badge;

    expect(badge('wishlist')).toBe(3);
    expect(badge('giftRegistry')).toBeUndefined();
  });

  it('points every entry at its route', () => {
    const to = Object.fromEntries(
      buildAccountMenu(counts({ downloads: 1, reviews: 1 })).map((e) => [e.key, e.to]),
    );

    expect(to).toMatchObject({
      dashboard: '/dashboard',
      password: '/dashboard/password',
      newsletter: '/dashboard/newsletter',
      addresses: '/dashboard/addresses',
      orders: '/dashboard/orders',
      wishlist: '/dashboard/wishlist',
      giftRegistry: '/dashboard/gift-registry',
      reviews: '/dashboard/reviews',
      downloads: '/dashboard/downloads',
    });
  });
});
