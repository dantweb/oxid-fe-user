/** The account pages, as Apex's "Where do you want to go?" menu and dashboard cards list them. */
export type AccountPage =
  | 'dashboard'
  | 'password'
  | 'newsletter'
  | 'addresses'
  | 'orders'
  | 'wishlist'
  | 'giftRegistry'
  | 'reviews'
  | 'downloads';

export interface AccountCounts {
  orders: number;
  reviews: number;
  downloads: number;
  wishlist: number;
  giftRegistry: number;
}

interface AccountMenuEntry {
  key: AccountPage;
  to: string;
  /** i18n key under `dashboard.` */
  labelKey: string;
  /** shown as a badge next to the label when there is something in the list */
  badge?: number;
}

export function buildAccountMenu(counts: AccountCounts): AccountMenuEntry[] {
  const withBadge = (count: number): { badge?: number } => (count > 0 ? { badge: count } : {});
  const menu: AccountMenuEntry[] = [
    { key: 'dashboard', to: '/dashboard', labelKey: 'menu.dashboard' },
    { key: 'password', to: '/dashboard/password', labelKey: 'menu.password' },
    { key: 'newsletter', to: '/dashboard/newsletter', labelKey: 'menu.newsletter' },
    { key: 'addresses', to: '/dashboard/addresses', labelKey: 'menu.addresses' },
    { key: 'orders', to: '/dashboard/orders', labelKey: 'menu.orders' },
    {
      key: 'wishlist',
      to: '/dashboard/wishlist',
      labelKey: 'menu.wishlist',
      ...withBadge(counts.wishlist),
    },
    {
      key: 'giftRegistry',
      to: '/dashboard/gift-registry',
      labelKey: 'menu.giftRegistry',
      ...withBadge(counts.giftRegistry),
    },
  ];
  // like Apex, pages without anything to show stay out of the way
  if (counts.reviews > 0) {
    menu.push({ key: 'reviews', to: '/dashboard/reviews', labelKey: 'menu.reviews' });
  }
  if (counts.downloads > 0) {
    menu.push({ key: 'downloads', to: '/dashboard/downloads', labelKey: 'menu.downloads' });
  }
  return menu;
}
