/** Shared e2e data. Credentials come from tests/e2e/.env (see .env.dist), like the Stripe module's suite. */

/** The shop customer the checkout specs sign in as. No default: a committed login is a leak. */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? '',
  password: process.env.TEST_USER_PASSWORD ?? '',
};
/** `test.skip(!TEST_USER_CONFIGURED, TEST_USER_MISSING)` in every spec that signs in as TEST_USER. */
export const TEST_USER_CONFIGURED = TEST_USER.email !== '' && TEST_USER.password !== '';
export const TEST_USER_MISSING =
  'TEST_USER_EMAIL / TEST_USER_PASSWORD not set (tests/e2e/.env, see .env.dist)';

export const STRIPE_TEST_CARDS = {
  VISA_SUCCESS: '4242424242424242',
  CARD_DECLINED: '4000000000000002',
};

export const STRIPE_CARD_DETAILS = {
  expiry: '12/34',
  cvc: '123',
  name: 'Marc Muster',
};

/** "Destiny" — an orderable product in the demo data. */
export const ORDERABLE_PRODUCT_ID = '066e3ce119c43c81cc0e46d4f1681eed';
/** "Caps" category in the demo data. */
export const CAPS_CATEGORY_ID = '8a7ff3dcbc30480b19228b4bf00c8386';
