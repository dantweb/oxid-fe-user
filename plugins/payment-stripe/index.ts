import {
  createProviderCheckoutApi,
  SealedConfigError,
  sealedKeysForPlugin,
  type PaymentPlugin,
  type PluginContext,
  type ProviderCheckoutApi,
  type SealedKeys,
  type SealedValues,
} from '@dantweb/oxid-fe-core';

export interface StripeKeys {
  publishableKey: string;
}

let api: ProviderCheckoutApi | null = null;
let context: PluginContext | null = null;
let keys: SealedKeys<StripeKeys> | null = null;

/** The one value the shop may hand over for Stripe (docs/payments-keys.md). */
export function parseStripeKeys(values: SealedValues): StripeKeys {
  const publishableKey = values.publishableKey;
  if (typeof publishableKey !== 'string' || publishableKey === '') {
    throw new SealedConfigError('The shop did not provide a Stripe publishable key');
  }
  return { publishableKey };
}

function checkoutApi(): ProviderCheckoutApi {
  if (!api) {
    throw new Error('payment-stripe plugin is not set up');
  }
  return api;
}

/** What the inline component needs: the provider calls and the key, which only the shop holds. */
export function useStripeInline(): {
  api: ProviderCheckoutApi;
  loadKeys: () => Promise<StripeKeys>;
} {
  return {
    api: checkoutApi(),
    loadKeys: () => {
      if (!keys) {
        throw new Error('payment-stripe plugin is not set up');
      }
      return keys.load();
    },
  };
}

/**
 * Stripe over payment-base's headless contract. Inline ("iframe mode"): Stripe Embedded Checkout
 * renders the whole payment form in Stripe's iframe on the checkout page. The publishable key is
 * NOT configured here: the shop hands it over sealed (docs/payments-keys.md). With `mode: redirect`,
 * or when that exchange fails, the hosted Stripe Checkout page is used.
 * Config: `mode: iframe | redirect`.
 */
const plugin: PaymentPlugin = {
  name: 'payment-stripe',
  version: '0.2.0',
  paymentId: 'oe_payments_stripe_wallet',
  setup(ctx: PluginContext) {
    context = ctx;
    keys = sealedKeysForPlugin(ctx, 'stripe', parseStripeKeys);
    api = createProviderCheckoutApi(ctx.client, 'stripe', {
      returnArguments: { session_id: 'checkoutSessionId' },
    });
  },
  inlineComponent() {
    const config = context?.config ?? {};
    return config.mode === 'redirect' || keys?.failed.value
      ? null
      : () => import('./StripeInline.vue');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken, returnParams) =>
    checkoutApi().checkoutReturn(contractId, contractToken, returnParams),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
