import { z } from 'zod';

const BUNDLED_PLUGIN_DEFAULTS = [
  'shop',
  'checkout',
  'payment-paypal',
  'payment-stripe',
  'payment-mollie',
  'dashboard',
] as const;

const pluginEntrySchema = z.object({
  enabled: z.boolean().default(true),
  source: z.enum(['bundled', 'external']).default('bundled'),
  config: z.record(z.unknown()).default({}),
});

type PluginEntry = z.infer<typeof pluginEntrySchema>;

const defaultPlugins = (): Record<string, PluginEntry> =>
  Object.fromEntries(BUNDLED_PLUGIN_DEFAULTS.map((name) => [name, pluginEntrySchema.parse({})]));

export const instanceConfigSchema = z
  .object({
    instance: z
      .object({
        id: z.string().min(1).default('default'),
        name: z.string().min(1).default('OXID Storefront'),
      })
      .default({}),
    shop: z.object({ graphql_url: z.string().min(1).default('/graphql/') }).default({}),
    i18n: z
      .object({
        default_locale: z.string().min(1).default('en'),
        fallback_locale: z.string().min(1).default('en'),
        locales: z.array(z.string().min(1)).min(1).default(['en', 'de']),
      })
      .default({}),
    theme: z
      .object({
        default: z.string().min(1).default('default'),
        active: z.string().min(1).optional(),
      })
      .default({}),
    plugins: z.record(pluginEntrySchema).default(defaultPlugins),
  })
  .superRefine((config, ctx) => {
    if (!config.i18n.locales.includes(config.i18n.default_locale)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['i18n', 'default_locale'],
        message: `default_locale "${config.i18n.default_locale}" must be one of locales [${config.i18n.locales.join(', ')}]`,
      });
    }
  });

export type InstanceConfig = z.infer<typeof instanceConfigSchema>;

/** Every default at once — what an instance without a config file runs with. */
export function defaultInstanceConfig(): InstanceConfig {
  return instanceConfigSchema.parse({});
}
