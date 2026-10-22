/** GraphQL Storefront documents for the account area (verified against b-7.4.x). */

interface OrderItem {
  id: string;
  amount: number;
  title: string;
}

/** The payment contract behind an order (payment-base's `Order.paymentContract`; null: classic payment). */
export interface OrderPaymentContract {
  state: string;
  provider: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: number;
  ordered: string | null;
  paid: string | null;
  cancelled: boolean;
  cost: { total: number; currency: { name: string } };
  items: OrderItem[];
  paymentContract?: OrderPaymentContract | null;
}

export interface DeliveryAddress {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  streetNumber: string;
  zipCode: string;
  city: string;
}

/** Everything the storefront `Order` type has on its own — the part every shop answers. */
const ORDER_FIELDS = /* GraphQL */ `
  id
  orderNumber
  ordered
  paid
  cancelled
  cost {
    total
    currency {
      name
    }
  }
  items {
    id
    amount
    title
  }
`;

/** `Order.paymentContract` exists when payment-base 1.4+ runs next to graphql-storefront (sprint 139c). */
export const ORDERS_QUERY = /* GraphQL */ `
  query accountOrders {
    customer {
      orders {
        ${ORDER_FIELDS}
        paymentContract {
          state
          provider
        }
      }
    }
  }
`;

/** The same list for a shop without that field. */
export const ORDERS_QUERY_WITHOUT_CONTRACT = /* GraphQL */ `
  query accountOrders {
    customer {
      orders {
        ${ORDER_FIELDS}
      }
    }
  }
`;

export const DELIVERY_ADDRESSES_QUERY = /* GraphQL */ `
  query accountDeliveryAddresses {
    customerDeliveryAddresses {
      id
      firstName
      lastName
      street
      streetNumber
      zipCode
      city
    }
  }
`;

export const DELIVERY_ADDRESS_ADD = /* GraphQL */ `
  mutation accountDeliveryAddressAdd($address: DeliveryAddressInput!) {
    customerDeliveryAddressAdd(deliveryAddress: $address) {
      id
    }
  }
`;

export const DELIVERY_ADDRESS_DELETE = /* GraphQL */ `
  mutation accountDeliveryAddressDelete($id: ID!) {
    customerDeliveryAddressDelete(deliveryAddressId: $id)
  }
`;

export const PASSWORD_CHANGE = /* GraphQL */ `
  mutation accountPasswordChange($old: String!, $new: String!) {
    customerPasswordChange(old: $old, new: $new) {
      accessToken
    }
  }
`;

export const NEWSLETTER_SUBSCRIBE = /* GraphQL */ `
  mutation accountNewsletterSubscribe($email: String!) {
    newsletterSubscribe(newsletterStatus: { email: $email }) {
      status
    }
  }
`;

export const NEWSLETTER_UNSUBSCRIBE = /* GraphQL */ `
  mutation accountNewsletterUnsubscribe($email: String!) {
    newsletterUnsubscribe(newsletterStatus: { email: $email })
  }
`;

export const EMAIL_UPDATE = /* GraphQL */ `
  mutation accountEmailUpdate($email: String!) {
    customerEmailUpdate(email: $email) {
      email
    }
  }
`;

export interface CustomerReview {
  id: string;
  text: string | null;
  rating: number | null;
  createAt: string | null;
  product: { id: string; title: string } | null;
}

export const REVIEWS_QUERY = /* GraphQL */ `
  query accountReviews {
    customer {
      reviews {
        id
        text
        rating
        createAt
        product {
          id
          title
        }
      }
    }
  }
`;

export const REVIEW_DELETE = /* GraphQL */ `
  mutation accountReviewDelete($id: ID!) {
    reviewDelete(reviewId: $id)
  }
`;

export interface CustomerFile {
  id: string;
  filename: string;
  downloadCount: number;
  maxDownloadCount: number;
  validUntil: string | null;
  valid: boolean;
}

export const FILES_QUERY = /* GraphQL */ `
  query accountFiles {
    customer {
      files {
        id
        filename
        downloadCount
        maxDownloadCount
        validUntil
        valid
      }
    }
  }
`;

export const CUSTOMER_DELETE = /* GraphQL */ `
  mutation accountCustomerDelete {
    customerDelete
  }
`;
