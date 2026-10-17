import {
  createProviderCheckoutApi,
  type PaymentPlugin,
  type PluginContext,
  type ProviderCheckoutApi,
} from '@dantweb/oxid-fe-core';
import de from './i18n/de.json';
import en from './i18n/en.json';

let api: ProviderCheckoutApi | null = null;
let context: PluginContext | null = null;

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

export interface MollieInlineConfig {
  profileId: string;
  testMode: boolean;
  /** explicit Mollie locale (`de_DE`); null = derived from the active language (see mollieLocale) */
  locale: string | null;
  /** Mollie methods offered inline; `creditcard` uses Mollie Components, the rest Mollie's page */
  methods: string[];
}

/** What the inline component needs: the provider calls and the instance's public Mollie config. */
export function useMollieInline(): { api: ProviderCheckoutApi; config: MollieInlineConfig } {
  const config = context?.config ?? {};
  return {
    api: checkoutApi(),
    config: {
      profileId: String(config.profile_id ?? ''),
      testMode: config.test_mode !== false,
      locale: config.locale ? String(config.locale) : null,
      methods: Array.isArray(config.methods) ? config.methods.map(String) : ['creditcard'],
    },
  };
}

/**
 * Mollie over payment-base's headless contract. Inline ("iframe mode"): Mollie Components render the
 * card fields in Mollie's iframes; the single-use card token goes with `mollieCheckoutStart`. Other
 * methods (iDEAL, Bancontact, …) pre-select the method and continue on Mollie's page. Without a
 * `profile_id` (or with `mode: redirect`) Mollie's hosted method-selection page is used.
 * Config: `mode`, `profile_id: pfl_…` (public), `test_mode`, `locale`, `methods`.
 */
const plugin: PaymentPlugin = {
  name: 'payment-mollie',
  version: '0.2.0',
  paymentId: 'oe_payments_mollie',
  messages: { en, de },
  setup(ctx: PluginContext) {
    context = ctx;
    api = createProviderCheckoutApi(ctx.client, 'mollie', {
      startArguments: { method: 'method', cardToken: 'cardToken' },
    });
  },
  inlineComponent() {
    const config = context?.config ?? {};
    return config.mode === 'redirect' || !config.profile_id
      ? null
      : () => import('./MollieInline.vue');
  },
  start: (basketId, options) => checkoutApi().start(basketId, options),
  checkoutReturn: (contractId, contractToken, returnParams) =>
    checkoutApi().checkoutReturn(contractId, contractToken, returnParams),
  cancel: (contractId, contractToken) => checkoutApi().cancel(contractId, contractToken),
};

export default plugin;
