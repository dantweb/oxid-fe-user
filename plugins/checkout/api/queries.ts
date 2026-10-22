/** GraphQL Storefront documents for the checkout flow (verified against b-7.4.x). */

export interface InvoiceAddress {
  salutation: string | null;
  firstName: string;
  lastName: string;
  street: string;
  streetNumber: string;
  zipCode: string;
  city: string;
  country: { id: string; title: string } | null;
}

export interface DeliveryMethod {
  id: string;
  title: string;
}

export interface BasketPayment {
  id: string;
  title: string;
}

export const INVOICE_ADDRESS_QUERY = /* GraphQL */ `
  query checkoutCustomer {
    customer {
      email
    }
    customerInvoiceAddress {
      salutation
      firstName
      lastName
      street
      streetNumber
      zipCode
      city
      country {
        id
        title
      }
    }
  }
`;

export const SET_INVOICE_ADDRESS = /* GraphQL */ `
  mutation setInvoiceAddress($address: InvoiceAddressInput!) {
    customerInvoiceAddressSet(invoiceAddress: $address) {
      firstName
    }
  }
`;

export const BASKET_CREATE = /* GraphQL */ `
  mutation checkoutBasketCreate($title: String!) {
    basketCreate(basket: { title: $title, public: false }) {
      id
    }
  }
`;

export const BASKET_ADD_ITEM = /* GraphQL */ `
  mutation checkoutBasketAddItem($basketId: ID!, $productId: ID!, $amount: Float!) {
    basketAddItem(basketId: $basketId, productId: $productId, amount: $amount) {
      id
    }
  }
`;

export const BASKET_DELIVERY_METHODS = /* GraphQL */ `
  query checkoutDeliveryMethods($basketId: ID!) {
    basketDeliveryMethods(basketId: $basketId) {
      id
      title
    }
  }
`;

export const BASKET_SET_DELIVERY_METHOD = /* GraphQL */ `
  mutation checkoutSetDeliveryMethod($basketId: ID!, $deliveryMethodId: ID!) {
    basketSetDeliveryMethod(basketId: $basketId, deliveryMethodId: $deliveryMethodId) {
      id
    }
  }
`;

export const BASKET_PAYMENTS = /* GraphQL */ `
  query checkoutPayments($basketId: ID!) {
    basketPayments(basketId: $basketId) {
      id
      title
    }
  }
`;

export const BASKET_SET_PAYMENT = /* GraphQL */ `
  mutation checkoutSetPayment($basketId: ID!, $paymentId: ID!) {
    basketSetPayment(basketId: $basketId, paymentId: $paymentId) {
      id
    }
  }
`;

export const PLACE_ORDER = /* GraphQL */ `
  mutation checkoutPlaceOrder($basketId: ID!) {
    placeOrder(basketId: $basketId, confirmTermsAndConditions: true) {
      id
      orderNumber
    }
  }
`;

/** Countries for the address forms — answered to an anonymous token too. */
export const COUNTRIES_QUERY = /* GraphQL */ `
  query checkoutCountries {
    countries {
      id
      title
    }
  }
`;
