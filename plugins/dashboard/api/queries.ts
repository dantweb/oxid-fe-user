/** GraphQL Storefront documents for the account area (verified against b-7.4.x). */

interface OrderItem {
  id: string;
  amount: number;
  title: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: number;
  ordered: string | null;
  paid: string | null;
  cancelled: boolean;
  cost: { total: number; currency: { name: string } };
  items: OrderItem[];
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

export const ORDERS_QUERY = /* GraphQL */ `
  query accountOrders {
    customer {
      orders {
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
