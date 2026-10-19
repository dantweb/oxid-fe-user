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
import de from './i18n/de.json';
import en from './i18n/en.json';

let api: ProviderCheckoutApi | null = null;
let context: PluginContext | null = null;
let keys: SealedKeys<MollieKeys> | null = null;

function checkoutApi(): ProviderCheckoutApi {
  if (!api) {
    throw new Error('payment-mollie plugin is not set up');
  }
  return api;
}

const MOLLIE_LOCALES: Record<string, string> = {
  de: 'de_DE',
  en: 'en_US',
  fr: 'fr_FR',
  nl: 'nl_NL',
  es: 'es_ES',
  it: 'it_IT',
};

/** Mollie's locale: the instance's `locale` override, else derived from the active storefront language. */
export function mollieLocale(active: string, override: string | null): string {
  return override ?? MOLLIE_LOCALES[active] ?? 'en_US';
}

export interface MollieKeys {
  profileId: string;
  /** the shop's mode decides, not this configuration */
  testMode: boolean;
}

/** What the shop may hand over for Mollie (docs/payments-keys.md); test mode defaults to on. */
export function parseMollieKeys(values: SealedValues): MollieKeys {
  const profileId = values.profileId;
  if (typeof profileId !== 'string' || profileId === '') {
    throw new SealedConfigError('The shop did not provide a Mollie profile id');
  }
  return { profileId, testMode: values.testMode !== false };
}

export interface MollieInlineConfig {
  /** explicit Mollie locale (`de_DE`); null = derived from the active language (see mollieLocale) */
  locale: string | null;
  /** Mollie methods offered inline; `creditcard` uses Mollie Components, the rest Mollie's page */
  methods: string[];
}

/** What the inline component needs: the provider calls, the keys (shop-held) and display options. */
export function useMollieInline(): {
  api: ProviderCheckoutApi;
  config: MollieInlineConfig;
  loadKeys: () => Promise<MollieKeys>;
} {
  const config = context?.config ?? {};
  return {
    api: checkoutApi(),
    loadKeys: () => {
      if (!keys) {
        throw new Error('payment-mollie plugin is not set up');
      }
      return keys.load();
    },
    config: {
      locale: config.locale ? String(config.locale) : null,
      methods: Array.isArray(config.methods) ? config.methods.map(String) : ['creditcard'],
    },
  };
}

/**
 * Mollie over payment-base's headless contract. Inline ("iframe mode"): Mollie Components render the
 * card fields in Mollie's iframes; the single-use card token goes with `mollieCheckoutStart`. Other
 * methods (iDEAL, Bancontact, …) pre-select the method and continue on Mollie's page. The profile
 * id and test mode are NOT configured here: the shop hands them over sealed
 * (docs/payments-keys.md). With `mode: redirect`, or when that exchange fails, Mollie's hosted
 * method-selection page is used.
 * Config: `mode`, `locale`, `methods`.
 */
const plugin: PaymentPlugin = {
  name: 'payment-mollie',
  version: '0.2.0',
  paymentId: 'oe_payments_mollie',
  messages: { en, de },
  setup(ctx: PluginContext) {
    context = ctx;
    keys = sealedKeysForPlugin(ctx, 'mollie', parseMollieKeys);
    api = createProviderCheckoutApi(ctx.client, 'mollie', {
      startArguments: { method: 'method', cardToken: 'cardToken' },
    });
  },
  inlineComponent() {
    const config = context?.config ?? {};
    return config.mode === 'redirect' || keys?.failed.value
      ? null
      : () => import('./MollieInline.vue');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken, returnParams) =>
    checkoutApi().checkoutReturn(contractId, contractToken, returnParams),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
