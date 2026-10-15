import {
  createProviderCheckoutApi,
  type PaymentPlugin,
  type PluginContext,
  type ProviderCheckoutApi,
} from '@dantweb/oxid-fe-core';

let api: ProviderCheckoutApi | null = null;

function checkoutApi(): ProviderCheckoutApi {
  if (!api) {
    throw new Error('payment-mollie plugin is not set up');
  }
  return api;
}

/**
 * Mollie over payment-base's headless contract, hosted page. Mollie's
 * optional `method` pre-selection (ideal, creditcard, …) arrives with the
 * provider-options story.
 */
const plugin: PaymentPlugin = {
  name: 'payment-mollie',
  version: '0.1.0',
  paymentId: 'oe_payments_mollie',
  setup(ctx: PluginContext) {
    api = createProviderCheckoutApi(ctx.client, 'mollie');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken) =>
    checkoutApi().checkoutReturn(contractId, contractToken),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
