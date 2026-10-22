import { GraphqlError, type GraphqlClient } from '@dantweb/oxid-fe-core';
import { ORDERS_QUERY, ORDERS_QUERY_WITHOUT_CONTRACT, type CustomerOrder } from './queries';

interface OrdersResponse {
  customer: { orders: CustomerOrder[] };
}

/** The shop's own validation error for a field its schema lacks — payment-base is not installed. */
function isMissingContractField(cause: unknown): boolean {
  return cause instanceof GraphqlError && cause.message.includes('paymentContract');
}

/**
 * The customer's orders, with the payment contract of each when the shop offers the field. A shop
 * without payment-base answers the first query with a validation error: ask again without it.
 */
export async function loadOrders(client: Pick<GraphqlClient, 'execute'>): Promise<CustomerOrder[]> {
  try {
    return (await client.execute<OrdersResponse>(ORDERS_QUERY)).customer.orders;
  } catch (cause) {
    if (!isMissingContractField(cause)) {
      throw cause;
    }
  }
  return (await client.execute<OrdersResponse>(ORDERS_QUERY_WITHOUT_CONTRACT)).customer.orders;
}
