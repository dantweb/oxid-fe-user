import { createSavedListsApi, type GraphqlClient } from '@dantweb/oxid-fe-core';
import type { AccountCounts } from '../menu';

export interface AccountSummary {
  firstName: string;
  email: string;
  /** SUBSCRIBED · MISSING_DOUBLE_OPTIN · UNSUBSCRIBED … */
  newsletterStatus: string;
  counts: AccountCounts;
}

const SUMMARY_QUERY = /* GraphQL */ `
  query accountSummary {
    customer {
      firstName
      email
      newsletterStatus {
        status
      }
      orders {
        id
      }
      reviews {
        id
      }
      files {
        id
      }
    }
  }
`;

interface SummaryResponse {
  customer: {
    firstName: string;
    email: string;
    newsletterStatus: { status: string } | null;
    orders: unknown[];
    reviews: unknown[];
    files: unknown[];
  };
}

/** Everything the account menu and the dashboard cards show, in one go. */
export async function loadAccountSummary(client: GraphqlClient): Promise<AccountSummary> {
  const lists = createSavedListsApi(client);
  const [data, wishlist, giftRegistry] = await Promise.all([
    client.execute<SummaryResponse>(SUMMARY_QUERY),
    lists.count('noticelist'),
    lists.count('wishlist'),
  ]);
  const { customer } = data;
  return {
    firstName: customer.firstName,
    email: customer.email,
    newsletterStatus: customer.newsletterStatus?.status ?? 'UNSUBSCRIBED',
    counts: {
      orders: customer.orders.length,
      reviews: customer.reviews.length,
      downloads: customer.files.length,
      wishlist,
      giftRegistry,
    },
  };
}
