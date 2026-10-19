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

export interface PayPalKeys {
  clientId: string;
}

let api: ProviderCheckoutApi | null = null;
let context: PluginContext | null = null;
let keys: SealedKeys<PayPalKeys> | null = null;

/** The one value the shop may hand over for PayPal (docs/payments-keys.md). */
export function parsePayPalKeys(values: SealedValues): PayPalKeys {
  const clientId = values.clientId;
  if (typeof clientId !== 'string' || clientId === '') {
    throw new SealedConfigError('The shop did not provide a PayPal client id');
  }
  return { clientId };
}

function checkoutApi(): ProviderCheckoutApi {
  if (!api) {
    throw new Error('payment-paypal plugin is not set up');
  }
  return api;
}

/** What the inline component needs: the provider calls, the key (shop-held) and the SDK URL. */
export function usePayPalInline(): {
  api: ProviderCheckoutApi;
  loadKeys: () => Promise<PayPalKeys>;
  sdkUrl: (keys: PayPalKeys) => string;
} {
  const config = context?.config ?? {};
  return {
    api: checkoutApi(),
    loadKeys: () => {
      if (!keys) {
        throw new Error('payment-paypal plugin is not set up');
      }
      return keys.load();
    },
    sdkUrl: ({ clientId }) => {
      const params = new URLSearchParams({
        'client-id': clientId,
        currency: String(config.currency ?? 'EUR'),
        // must match the shop's capture mode: automatic -> capture, manual -> authorize
        intent: String(config.intent ?? 'capture'),
        components: 'buttons',
      });
      return `https://www.paypal.com/sdk/js?${params.toString()}`;
    },
  };
}

/**
 * PayPal over payment-base's headless contract. Inline ("iframe mode"): PayPal Smart Buttons — the
 * buttons and PayPal's approval popup — on the checkout page. The client id is NOT configured here:
 * the shop hands it over sealed (docs/payments-keys.md). With `mode: redirect`, or when that
 * exchange fails, the hosted approval page is used.
 * Config: `mode: iframe | redirect`, `currency`, `intent`.
 */
const plugin: PaymentPlugin = {
  name: 'payment-paypal',
  version: '0.2.0',
  paymentId: 'oe_payments_paypal',
  setup(ctx: PluginContext) {
    context = ctx;
    keys = sealedKeysForPlugin(ctx, 'paypal', parsePayPalKeys);
    api = createProviderCheckoutApi(ctx.client, 'paypal');
  },
  inlineComponent() {
    const config = context?.config ?? {};
    return config.mode === 'redirect' || keys?.failed.value
      ? null
      : () => import('./PayPalInline.vue');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken, returnParams) =>
    checkoutApi().checkoutReturn(contractId, contractToken, returnParams),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
