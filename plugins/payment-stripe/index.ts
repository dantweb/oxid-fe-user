import {
  createProviderCheckoutApi,
  type PaymentPlugin,
  type PluginContext,
  type ProviderCheckoutApi,
} from '@dantweb/oxid-fe-core';

let api: ProviderCheckoutApi | null = null;

function checkoutApi(): ProviderCheckoutApi {
  if (!api) {
    throw new Error('payment-stripe plugin is not set up');
  }
  return api;
}

/**
 * Stripe over payment-base's headless contract, hosted Checkout page.
 * `uiMode: embedded` (clientSecret + embedded Checkout) is supported by the
 * backend and lands here with the publishable-key configuration story.
 */
const plugin: PaymentPlugin = {
  name: 'payment-stripe',
  version: '0.1.0',
  paymentId: 'oe_payments_stripe_wallet',
  setup(ctx: PluginContext) {
    api = createProviderCheckoutApi(ctx.client, 'stripe');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken) =>
    checkoutApi().checkoutReturn(contractId, contractToken),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
