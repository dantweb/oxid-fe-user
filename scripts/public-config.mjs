/**
 * The ONLY instance configuration the browser receives.
 *
 * `oxid-config.yaml` is a deployment file: it stays on the server and is never served. This script
 * renders the browser's `oxid-config.json` from it — an ALLOW-LIST (instance, shop.graphql_url,
 * i18n, theme, and per plugin: enabled / source / config) — and refuses to render at all when
 * anything in it looks like a secret (key names such as secret / password / token / api_key, or
 * values such as sk_live_…, whsec_…, ghp_…, private keys, credentials inside a URL). A mistake
 * therefore stops the build or the container start, instead of reaching a visitor.
 *
 * The command line lives in public-config-cli.mjs.
 */
import { parse } from 'yaml';

const TOP_LEVEL = ['instance', 'shop', 'i18n', 'theme', 'plugins'];
const SHOP_FIELDS = ['graphql_url'];
const PLUGIN_FIELDS = ['enabled', 'source', 'config'];

const SECRET_KEY = /secret|passw(or)?d|token|api[_-]?key|private|credential|authorization|bearer/i;
const SECRET_VALUE =
  /^(sk_(live|test)_|rk_(live|test)_|whsec_|ghp_|gho_|github_pat_|xox[bpa]-|AKIA[0-9A-Z]{8}|-----BEGIN )/;

/** Provider keys and ids a payment SDK needs: the shop owns them (docs/payments-keys.md). */
const PAYMENT_KEY_FIELD = /key|secret|^client_?id$|^profile_?id$/i;

function pick(source, fields) {
  return Object.fromEntries(fields.filter((field) => field in source).map((f) => [f, source[f]]));
}

/** Every secret-looking key or value in `value`, as "path: reason" lines. */
function findSecrets(value, path, found = []) {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const here = path ? `${path}.${key}` : key;
      if (SECRET_KEY.test(key)) {
        found.push(`${here}: key name looks like a secret (${key})`);
      }
      findSecrets(child, here, found);
    }
  } else if (typeof value === 'string' && SECRET_VALUE.test(value.trim())) {
    found.push(`${path}: value looks like a secret (${value.trim().slice(0, 8)}…)`);
  }
  return found;
}

/** Key-like fields inside any `payment-*` plugin's config, as "path: reason" lines. */
function findPaymentKeys(plugins) {
  const found = [];
  const walk = (value, path) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const here = `${path}.${key}`;
      if (PAYMENT_KEY_FIELD.test(key)) {
        found.push(
          `${here}: payment provider keys come from the shop, not from this file (docs/payments-keys.md)`,
        );
      }
      walk(child, here);
    }
  };
  for (const [name, entry] of Object.entries(plugins ?? {})) {
    if (name.startsWith('payment-')) {
      walk(entry?.config, `plugins.${name}.config`);
    }
  }
  return found;
}

export function renderPublicConfig(yamlText) {
  const raw = parse(yamlText) ?? {};
  const publicConfig = pick(raw, TOP_LEVEL);
  if (publicConfig.shop && typeof publicConfig.shop === 'object') {
    publicConfig.shop = pick(publicConfig.shop, SHOP_FIELDS);
  }
  if (publicConfig.plugins && typeof publicConfig.plugins === 'object') {
    publicConfig.plugins = Object.fromEntries(
      Object.entries(publicConfig.plugins).map(([name, entry]) => [
        name,
        entry && typeof entry === 'object' ? pick(entry, PLUGIN_FIELDS) : entry,
      ]),
    );
  }

  const problems = [...findSecrets(publicConfig, ''), ...findPaymentKeys(publicConfig.plugins)];
  const url = publicConfig.shop?.graphql_url;
  if (typeof url === 'string' && /^[a-z]+:\/\/[^/@\s]+@/i.test(url)) {
    problems.push('shop.graphql_url: contains credentials');
  }
  if (problems.length > 0) {
    throw new Error(
      `oxid-config.yaml would expose secrets to the browser — refusing to render:\n- ${problems.join('\n- ')}\n` +
        'Secrets belong in the shop / server environment, never in the instance configuration.',
    );
  }
  return `${JSON.stringify(publicConfig, null, 2)}\n`;
}
