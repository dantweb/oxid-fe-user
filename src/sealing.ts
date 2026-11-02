import {
  SealedChannel,
  SEALED_ENVELOPE,
  type ExecuteOptions,
  type GraphqlClient,
} from '@dantweb/oxid-fe-core';

/**
 * The storefront's use of the sealed channel (SEAL-1, shop module oxid-sealed-channel): which operations seal which
 * variables, and the selection of a sealed twin field. The channel itself and the transport live in oxid-fe-core.
 */
export const SEALED = `{ ${SEALED_ENVELOPE} }`;

/** The channel of this app: opened on first use, anonymous (a customer token rotates; the channel key is the capability). */
export function createSealedChannel(client: Pick<GraphqlClient, 'execute'>): SealedChannel {
  return new SealedChannel(client, { app: 'shop' });
}

/** `{ variable: path }` → call options. Order = the order of the operation's arguments on the shop. */
export function sealedArguments(
  operation: string,
  ...variables: [name: string, argument: string][]
): ExecuteOptions {
  return {
    sealedArguments: Object.fromEntries(
      variables.map(([name, argument]) => [name, { path: `${operation}.${argument}`, into: name }]),
    ),
  };
}
