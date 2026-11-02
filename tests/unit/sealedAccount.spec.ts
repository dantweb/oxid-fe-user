import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAccountSummary } from '../../plugins/dashboard/api/summary';
import {
  DELIVERY_ADDRESSES_QUERY,
  DELIVERY_ADDRESS_ADD,
  EMAIL_UPDATE,
  PASSWORD_CHANGE,
  SEAL_DELIVERY_ADDRESS,
  SEAL_EMAIL_UPDATE,
  SEAL_PASSWORD_CHANGE,
} from '../../plugins/dashboard/api/queries';
import {
  INVOICE_ADDRESS_QUERY,
  SEAL_INVOICE_ADDRESS,
  SET_INVOICE_ADDRESS,
} from '../../plugins/checkout/api/queries';
import { createCore } from '../../src/core';
import { ShopDouble, type Envelope } from './helpers/sealedChannelShop';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

interface Call {
  query: string;
  variables: Record<string, unknown>;
  headers: Record<string, string>;
  body: string;
}

/** The shop: the Node double answers the handshake, `handler` every other request. */
function shop(handler: (call: Call, shop: ShopDouble) => unknown) {
  const double = new ShopDouble();
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = String(init.body);
      const parsed = JSON.parse(body) as { query: string; variables?: Record<string, unknown> };
      const call: Call = {
        query: parsed.query,
        variables: parsed.variables ?? {},
        headers: (init.headers ?? {}) as Record<string, string>,
        body,
      };
      calls.push(call);
      if (call.query.includes('sealedChannelOpen')) {
        return json({
          data: { sealedChannelOpen: double.open(String(call.variables.clientPublicKey), 'shop') },
        });
      }
      return json(handler(call, double) as object);
    }),
  );
  return { calls, double, last: () => calls[calls.length - 1] };
}

const claimed = new Set<string>();
const sealedAnswer = (call: Call, double: ShopDouble, path: string, value: unknown) => {
  const [id, counter] = call.headers['X-Sealed-Channel'].split('.');
  // a request claims its counter once, however many fields it seals
  if (!claimed.has(call.headers['X-Sealed-Channel'])) {
    claimed.add(call.headers['X-Sealed-Channel']);
    double.claim(id, Number(counter));
  }
  return double.seal(id, Number(counter), path, JSON.stringify(value));
};

afterEach(() => vi.unstubAllGlobals());

describe('the storefront over the sealed channel', () => {
  it('opens the channel for the app "shop", anonymous, once', async () => {
    const { calls } = shop(() => ({ data: { customerPasswordChange: 1 } }));
    const { client } = createCore('/graphql/');

    await client
      .execute(PASSWORD_CHANGE, { old: 'a', new: 'b' }, SEAL_PASSWORD_CHANGE)
      .catch(() => undefined);
    await client
      .execute(PASSWORD_CHANGE, { old: 'a', new: 'b' }, SEAL_PASSWORD_CHANGE)
      .catch(() => undefined);

    const handshakes = calls.filter((call) => call.query.includes('sealedChannelOpen'));
    expect(handshakes).toHaveLength(1);
    expect(handshakes[0].variables.app).toBe('shop');
  });

  it('changes the password with both passwords sealed, in the order of the arguments', async () => {
    const { calls, double } = shop((call, s) => {
      const old = s.unseal(call.variables.old as Envelope, 'sealedCustomerPasswordChange.old');
      const next = s.unseal(call.variables.new as Envelope, 'sealedCustomerPasswordChange.new');
      return { data: { sealedCustomerPasswordChange: { accessToken: `${old}>${next}` } } };
    });
    const { client } = createCore('/graphql/');

    const data = await client.execute<{ sealedCustomerPasswordChange: { accessToken: string } }>(
      PASSWORD_CHANGE,
      { old: 'old secret', new: 'new secret' },
      SEAL_PASSWORD_CHANGE,
    );

    expect(data.sealedCustomerPasswordChange.accessToken).toBe('old secret>new secret');
    const request = calls.find((call) =>
      call.query.includes('sealedCustomerPasswordChange'),
    ) as Call;
    expect(request.body).not.toContain('old secret');
    expect(request.body).not.toContain('new secret');
    expect((request.variables.old as Envelope).counter).toBeLessThan(
      (request.variables.new as Envelope).counter,
    );
    void double;
  });

  it('updates the e-mail sealed', async () => {
    const { calls } = shop((call, s) => {
      s.unseal(call.variables.email as Envelope, 'sealedCustomerEmailUpdate.email');
      return { data: { sealedCustomerEmailUpdate: { id: 'c1' } } };
    });
    const { client } = createCore('/graphql/');

    await client.execute(EMAIL_UPDATE, { email: 'jane@example.org' }, SEAL_EMAIL_UPDATE);

    expect(
      calls.find((call) => call.query.includes('sealedCustomerEmailUpdate'))?.body,
    ).not.toContain('jane@example.org');
  });

  it('writes an address as one sealed JSON object', async () => {
    let opened = '';
    const { calls } = shop((call, s) => {
      opened = s.unseal(
        call.variables.address as Envelope,
        'sealedCustomerDeliveryAddressAdd.address',
      );
      return { data: { sealedCustomerDeliveryAddressAdd: { id: 'a1' } } };
    });
    const { client } = createCore('/graphql/');
    const address = { firstName: 'Jane', street: 'Main St', zipCode: '53111', city: 'Bonn' };

    await client.execute(
      DELIVERY_ADDRESS_ADD,
      { address: JSON.stringify(address) },
      SEAL_DELIVERY_ADDRESS,
    );

    expect(JSON.parse(opened)).toEqual(address);
    expect(calls.find((call) => call.query.includes('sealedCustomerDelivery'))?.body).not.toContain(
      'Main St',
    );
  });

  it('reads the address book and the invoice address in the plain shape from sealed fields', async () => {
    shop((call, s) => {
      if (call.query.includes('accountDeliveryAddresses')) {
        return {
          data: {
            customerDeliveryAddresses: [
              {
                id: 'a1',
                sealedAddress: sealedAnswer(call, s, 'customerDeliveryAddresses.0.sealedAddress', {
                  street: 'Main St',
                  city: 'Bonn',
                }),
              },
            ],
          },
        };
      }
      return {
        data: {
          customer: {
            sealedPii: sealedAnswer(call, s, 'customer.sealedPii', { email: 'jane@example.org' }),
          },
          customerInvoiceAddress: {
            sealedAddress: sealedAnswer(call, s, 'customerInvoiceAddress.sealedAddress', {
              firstName: 'Jane',
              zipCode: '53111',
            }),
            country: { id: 'DE', title: 'Germany' },
          },
        },
      };
    });
    const { client } = createCore('/graphql/');

    const book = await client.execute<{
      customerDeliveryAddresses: { street: string; city: string }[];
    }>(DELIVERY_ADDRESSES_QUERY);
    const invoice = await client.execute<{
      customer: { email: string };
      customerInvoiceAddress: { firstName: string; zipCode: string; country: { id: string } };
    }>(INVOICE_ADDRESS_QUERY);

    expect(book.customerDeliveryAddresses[0]).toMatchObject({ street: 'Main St', city: 'Bonn' });
    expect(invoice.customer.email).toBe('jane@example.org');
    expect(invoice.customerInvoiceAddress).toMatchObject({
      firstName: 'Jane',
      zipCode: '53111',
      country: { id: 'DE' },
    });
  });

  it('sets the invoice address sealed', async () => {
    const { calls } = shop((call, s) => {
      s.unseal(call.variables.address as Envelope, 'sealedCustomerInvoiceAddressSet.address');
      return { data: { sealedCustomerInvoiceAddressSet: { salutation: 'MR' } } };
    });
    const { client } = createCore('/graphql/');

    await client.execute(
      SET_INVOICE_ADDRESS,
      { address: JSON.stringify({ street: 'Secret Way' }) },
      SEAL_INVOICE_ADDRESS,
    );

    expect(
      calls.find((call) => call.query.includes('sealedCustomerInvoiceAddressSet'))?.body,
    ).not.toContain('Secret Way');
  });

  it('shows the account summary from the sealed personal fields', async () => {
    shop((call, s) => {
      if (call.query.includes('accountSummary')) {
        return {
          data: {
            customer: {
              sealedPii: sealedAnswer(call, s, 'customer.sealedPii', {
                email: 'jane@example.org',
                firstName: 'Jane',
              }),
              newsletterStatus: { status: 'SUBSCRIBED' },
              orders: [{ id: 'o1' }],
              reviews: [],
              files: [],
            },
          },
        };
      }
      return { data: { customer: { baskets: [] } } };
    });
    const { client } = createCore('/graphql/');

    const summary = await loadAccountSummary(client);

    expect(summary).toMatchObject({
      firstName: 'Jane',
      email: 'jane@example.org',
      newsletterStatus: 'SUBSCRIBED',
    });
    expect(summary.counts.orders).toBe(1);
  });

  it('logs in with the password sealed: the request carries no plain password', async () => {
    const jwt = `x.${btoa(JSON.stringify({ exp: 4_000_000_000, useranonymous: false, tokenid: 't' }))}.y`;
    const { calls } = shop((call, s) => {
      s.unseal(call.variables.password as Envelope, 'sealedLogin.password');
      return { data: { sealedLogin: { accessToken: jwt, refreshToken: 'r' } } };
    });
    const { auth } = createCore('/graphql/');

    await auth.login('jane@example.org', 'correct horse');

    const login = calls.find((call) => call.query.includes('sealedLogin')) as Call;
    expect(login.body).not.toContain('correct horse');
    expect(login.query).not.toContain('query login');
  });
});
