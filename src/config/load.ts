import { parse } from 'yaml';
import { defaultInstanceConfig, instanceConfigSchema, type InstanceConfig } from './schema';

const INSTANCE_CONFIG_URL = '/oxid-config.yaml';

export class InstanceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstanceConfigError';
  }
}

/** Parses and validates the YAML text of an `oxid-config.yaml`. Throws InstanceConfigError. */
export function parseInstanceConfig(yamlText: string): InstanceConfig {
  let raw: unknown;
  try {
    raw = parse(yamlText) ?? {};
  } catch (cause) {
    throw new InstanceConfigError(`oxid-config.yaml is not valid YAML: ${String(cause)}`);
  }
  const result = instanceConfigSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new InstanceConfigError(`oxid-config.yaml is invalid — ${problems}`);
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
  return parseInstanceConfig(await response.text());
}
