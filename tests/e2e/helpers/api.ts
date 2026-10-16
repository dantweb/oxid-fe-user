import type { APIRequestContext } from '@playwright/test';
import { DEFAULT_BASE_URL, type Credentials } from './session';

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (playwright)' };

async function post<T>(
  request: APIRequestContext,
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const response = await request.post(`${DEFAULT_BASE_URL}/graphql/`, {
    data: { query, variables },
    headers: token ? { ...HEADERS, Authorization: `Bearer ${token}` } : HEADERS,
  });
  const body = await response.json();
  if (body.errors) {
    throw new Error(JSON.stringify(body.errors));
  }
  return body.data as T;
}

/** Runs a GraphQL document as the customer (test setup / verification, not the UI under test). */
export async function gqlAs<T = unknown>(
  request: APIRequestContext,
  customer: Credentials,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const { token } = await post<{ token: string }>(
    request,
    'query ($u: String!, $p: String!) { token(username: $u, password: $p) }',
    { u: customer.email, p: customer.password },
  );
  return post<T>(request, query, variables, token);
}

/** Whether these credentials still sign in (e.g. after a password change or account deletion). */
export async function canSignIn(
  request: APIRequestContext,
  customer: Credentials,
): Promise<boolean> {
  try {
    await post(request, 'query ($u: String!, $p: String!) { token(username: $u, password: $p) }', {
      u: customer.email,
      p: customer.password,
    });
    return true;
  } catch {
    return false;
  }
}

/** The newest Mailpit mail to the address, once it arrived. */
export async function waitForMail(
  request: APIRequestContext,
  to: string,
  timeoutMs = 30_000,
): Promise<string> {
  const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8025';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await (
      await request.get(`${mailpit}/api/v1/search`, { params: { query: `to:${to}` } })
    ).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const message = await (await request.get(`${mailpit}/api/v1/message/${id}`)).json();
      return `${message.HTML ?? ''}\n${message.Text ?? ''}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`no mail for ${to} within ${timeoutMs} ms`);
}
