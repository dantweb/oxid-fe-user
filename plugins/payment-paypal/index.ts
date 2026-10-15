import {
  createProviderCheckoutApi,
  type PaymentPlugin,
  type PluginContext,
  type ProviderCheckoutApi,
} from '@dantweb/oxid-fe-core';

let api: ProviderCheckoutApi | null = null;

function checkoutApi(): ProviderCheckoutApi {
  if (!api) {
    throw new Error('payment-paypal plugin is not set up');
  }
  return api;
}

/**
 * PayPal over payment-base's headless contract. `uiMode: hosted` is all the
 * backend offers today; Smart Buttons need a new backend uiMode first
 * (sprint-04 plan, S4 follow-up).
 */
const plugin: PaymentPlugin = {
  name: 'payment-paypal',
  version: '0.1.0',
  paymentId: 'oe_payments_paypal',
  setup(ctx: PluginContext) {
    api = createProviderCheckoutApi(ctx.client, 'paypal');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken) =>
    checkoutApi().checkoutReturn(contractId, contractToken),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
