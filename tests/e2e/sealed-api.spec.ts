import {
  GraphqlClient,
  GraphqlError,
  openAnswers,
  SEALED_ENVELOPE,
  SealedChannel,
} from '@dantweb/oxid-fe-core';
import { expect, test } from '@playwright/test';

/**
 * SEAL-1, the operations the storefront app has no screen for: registration and the plain-token round trip, with the
 * real client library of oxid-fe-core (WebCrypto of Node) against the real shop. No browser: the point is that the
 * TypeScript client and the PHP module agree on the wire.
 */
/** The app's own same-origin proxy of the shop's GraphQL endpoint (the dev server or the deployed instance under test). */
const SHOP = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const URL = `${SHOP.replace(/\/$/, '')}/graphql/`;
const SEALED = `{ ${SEALED_ENVELOPE} }`;

test.setTimeout(60_000);

function session() {
  const client = new GraphqlClient({ url: URL });
  const channel = new SealedChannel(client, { app: 'shop' });
  return { client, channel };
}

test('registers with a sealed e-mail and password, reads the sealed personal data back, and signs in sealed', async () => {
  const { client, channel } = session();
  const email = `fe-seal-api-${Date.now()}@oxid-test.local`;
  const password = 'fe-seal-api-Pass1!';

  const registered = await channel.run(async (request) => {
    const input = {
      email: await request.seal('sealedCustomerRegister.customer.email', email),
      password: await request.seal('sealedCustomerRegister.customer.password', password),
      birthdate: '1990-02-03',
    };
    const data = await client.execute<Record<string, unknown>>(
      `mutation ($customer: SealedCustomerRegisterInput!) {
        sealedCustomerRegister(customer: $customer) { id sealedPii ${SEALED} } }`,
      { customer: input },
      { headers: request.answerHeaders() },
    );
    await openAnswers(request, data);
    return data.sealedCustomerRegister as { id: string; email: string; birthdate: string };
  });
  expect(registered.id).toBeTruthy();
  expect(registered.email).toBe(email);
  expect(registered.birthdate).toBe('1990-02-03');

  const token = await channel.run(async (request) => {
    const data = await client.execute<{ sealedToken: string }>(
      'mutation ($u: String!, $p: SealedValueInput!) { sealedToken(username: $u, password: $p) }',
      { u: email, p: await request.seal('sealedToken.password', password) },
      { omitToken: true },
    );
    return data.sealedToken;
  });
  expect(token.split('.')).toHaveLength(3);

  const login = await channel.run(async (request) => {
    const data = await client.execute<{
      sealedLogin: { accessToken: string; refreshToken: string };
    }>(
      `mutation ($u: String!, $p: SealedValueInput!) {
        sealedLogin(username: $u, password: $p) { accessToken refreshToken } }`,
      { u: email, p: await request.seal('sealedLogin.password', password) },
      { omitToken: true },
    );
    return data.sealedLogin;
  });
  expect(login.accessToken.split('.')).toHaveLength(3);
  expect(login.refreshToken.length).toBeGreaterThan(10);
});

test('a wrong sealed password fails like a wrong password, and a sealed password cannot be moved to another operation', async () => {
  const { client, channel } = session();
  const attempt = (path: string, secret: string) =>
    channel.run(async (request) =>
      client.execute(
        'mutation ($u: String!, $p: SealedValueInput!) { sealedToken(username: $u, password: $p) }',
        { u: 'nobody@oxid-test.local', p: await request.seal(path, secret) },
        { omitToken: true },
      ),
    );

  const wrong = await attempt('sealedToken.password', 'not the password').catch((e: unknown) => e);
  expect(wrong).toBeInstanceOf(GraphqlError);
  expect((wrong as GraphqlError).errorCode).not.toBe('sealed_value_invalid');

  const moved = await attempt('sealedLogin.password', 'x').catch((e: unknown) => e);
  expect((moved as GraphqlError).errorCode).toBe('sealed_value_invalid');
});

test('an unknown channel is expired, a bad handshake key is invalid', async () => {
  const { client } = session();

  const noEnvelope = await client
    .execute(
      'mutation { sealedToken(username: "a", password: {v: 2, channelId: "x", counter: 1, iv: "AA", ct: "AA"}) }',
      undefined,
      { omitToken: true },
    )
    .catch((e: unknown) => e);
  expect((noEnvelope as GraphqlError).errorCode).toBe('sealed_channel_expired');

  const badKey = await client
    .execute(
      'mutation { sealedChannelOpen(clientPublicKey: "AAAA", app: "shop") { channelId } }',
      undefined,
      { omitToken: true },
    )
    .catch((e: unknown) => e);
  expect((badKey as GraphqlError).errorCode).toBe('sealed_value_invalid');
});
