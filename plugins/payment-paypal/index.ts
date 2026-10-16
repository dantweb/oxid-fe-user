import {
  createProviderCheckoutApi,
  type PaymentPlugin,
  type PluginContext,
  type ProviderCheckoutApi,
} from '@dantweb/oxid-fe-core';

let api: ProviderCheckoutApi | null = null;
let context: PluginContext | null = null;

function checkoutApi(): ProviderCheckoutApi {
  if (!api) {
    throw new Error('payment-paypal plugin is not set up');
  }
  return api;
}

/** What the inline component needs: the provider calls and the instance's public PayPal config. */
export function usePayPalInline(): {
  api: ProviderCheckoutApi;
  sdkUrl: string;
} {
  const config = context?.config ?? {};
  const params = new URLSearchParams({
    'client-id': String(config.client_id ?? ''),
    currency: String(config.currency ?? 'EUR'),
    // must match the shop's capture mode: automatic -> capture, manual -> authorize
    intent: String(config.intent ?? 'capture'),
    components: 'buttons',
  });
  return { api: checkoutApi(), sdkUrl: `https://www.paypal.com/sdk/js?${params.toString()}` };
}

/**
 * PayPal over payment-base's headless contract. Inline ("iframe mode"): PayPal Smart Buttons — the
 * buttons and PayPal's approval popup — on the checkout page. Without a `client_id` in the instance
 * config (or with `mode: redirect`) the hosted approval page is used.
 * Config: `mode: iframe | redirect`, `client_id` (public by design), `currency`, `intent`.
 */
const plugin: PaymentPlugin = {
  name: 'payment-paypal',
  version: '0.2.0',
  paymentId: 'oe_payments_paypal',
  setup(ctx: PluginContext) {
    context = ctx;
    api = createProviderCheckoutApi(ctx.client, 'paypal');
  },
  inlineComponent() {
    const config = context?.config ?? {};
    return config.mode === 'redirect' || !config.client_id
      ? null
      : () => import('./PayPalInline.vue');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken, returnParams) =>
    checkoutApi().checkoutReturn(contractId, contractToken, returnParams),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
