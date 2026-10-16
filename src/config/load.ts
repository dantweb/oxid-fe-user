import { defaultInstanceConfig, instanceConfigSchema, type InstanceConfig } from './schema';

/**
 * The browser's instance configuration: `oxid-config.json`, RENDERED on the server from the
 * deployment's `oxid-config.yaml` (scripts/public-config.mjs: allow-list + secret guard). The YAML
 * itself is never served.
 */
const INSTANCE_CONFIG_URL = '/oxid-config.json';

export class InstanceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstanceConfigError';
  }
}

/**
 * Validates the parsed `oxid-config.json`. Throws InstanceConfigError.
 * @public used by the test helpers (knip cannot see them as consumers)
 */
export function parseInstanceConfig(raw: unknown): InstanceConfig {
  const result = instanceConfigSchema.safeParse(raw ?? {});
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new InstanceConfigError(`oxid-config.json is invalid — ${problems}`);
  }
  return result.data;
}

/**
 * Loads the instance's config from the server. An ABSENT file (404, or the SPA fallback
 * answering with HTML) means "all defaults"; a PRESENT but invalid file is a hard error.
 */
export async function loadInstanceConfig(
  fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  url: string = INSTANCE_CONFIG_URL,
): Promise<InstanceConfig> {
  let response: Response;
  try {
    response = await fetchFn(url, { cache: 'no-store' });
  } catch {
    return defaultInstanceConfig();
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || contentType.includes('text/html')) {
    return defaultInstanceConfig();
  }
  try {
    return parseInstanceConfig(await response.json());
  } catch (cause) {
    if (cause instanceof InstanceConfigError) {
      throw cause;
    }
    throw new InstanceConfigError(`oxid-config.json is not valid JSON: ${String(cause)}`);
  }
}
