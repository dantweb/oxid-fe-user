import { errorCodeOf, providerCodeOf } from '@dantweb/oxid-fe-core';
import { useI18n } from 'vue-i18n';

const GENERIC_KEY = 'errors.generic';

/** True for a translation key that exists in the active catalog (so an unknown code never shows a key). */
type HasKey = (key: string) => boolean;

/**
 * The i18n key that explains `error` to the shopper. Order of preference: the provider's own code
 * (`errors.provider.card_declined`), the shop's error code (`errors.account_exists`), the caller's
 * fallback for its context (`login.failed`), the generic text. The raw message is never a candidate.
 */
export function errorMessageKey(error: unknown, has: HasKey, fallbackKey?: string): string {
  const providerCode = providerCodeOf(error);
  if (providerCode && has(`errors.provider.${providerCode}`)) {
    return `errors.provider.${providerCode}`;
  }
  const code = errorCodeOf(error);
  if (code && has(`errors.${code}`)) {
    return `errors.${code}`;
  }
  return fallbackKey && has(fallbackKey) ? fallbackKey : GENERIC_KEY;
}

/**
 * Turns a failure into translated text — never the raw message of the shop, a provider or the
 * network stack (sprint 138f). `fallbackKey` is the view's own wording for "something else went wrong".
 */
export function useErrorMessage(): (error: unknown, fallbackKey?: string) => string {
  const { t, te } = useI18n();
  return (error, fallbackKey) => t(errorMessageKey(error, (key) => te(key), fallbackKey));
}
