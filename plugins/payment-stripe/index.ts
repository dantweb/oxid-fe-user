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
    throw new Error('payment-stripe plugin is not set up');
  }
  return api;
}

/** What the inline component needs: the provider calls and the instance's public Stripe config. */
export function useStripeInline(): {
  api: ProviderCheckoutApi;
  publishableKey: string;
} {
  return { api: checkoutApi(), publishableKey: String(context?.config.publishable_key ?? '') };
}

/**
 * Stripe over payment-base's headless contract. Inline ("iframe mode"): Stripe Embedded Checkout
 * renders the whole payment form in Stripe's iframe on the checkout page. Without a publishable key
 * in the instance config (or with `mode: redirect`) the hosted Stripe Checkout page is used.
 * Config: `mode: iframe | redirect`, `publishable_key: pk_…` (public by design).
 */
const plugin: PaymentPlugin = {
  name: 'payment-stripe',
  version: '0.2.0',
  paymentId: 'oe_payments_stripe_wallet',
  setup(ctx: PluginContext) {
    context = ctx;
    api = createProviderCheckoutApi(ctx.client, 'stripe', {
      returnArguments: { session_id: 'checkoutSessionId' },
    });
  },
  inlineComponent() {
    const config = context?.config ?? {};
    return config.mode === 'redirect' || !config.publishable_key
      ? null
      : () => import('./StripeInline.vue');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken, returnParams) =>
    checkoutApi().checkoutReturn(contractId, contractToken, returnParams),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
