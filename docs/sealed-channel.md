# The sealed channel: sensitive values encrypted on top of TLS (SEAL-1)

For a **chosen list of operations** the storefront encrypts the sensitive values it sends and reads with a per-session key
that only the browser and the shop's PHP know. It protects the values against TLS-terminating intermediaries (Cloudflare,
proxies, load balancers) and against request- and response-body logging. It does **not** protect against XSS (CSP and
Trusted Types do) nor a compromised backend. The protocol, the threat model and the operations of the shop side:
`oxid-sealed-channel` (`docs/envelope-v2.md`, `docs/threat-model.md`). The one-way sealed client config of the payment
plugins (`payments-keys.md`, envelope v1) is a separate, older exchange and is unchanged.

## What is sealed

| Where                                            | Operation (shop module `oxid-sealed-channel`)                                                                       | Sealed                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| login (`AuthService`)                            | `sealedLogin`, falling back to `sealedToken` (never to the plain queries)                                           | password                                                       |
| `ResetPasswordView`                              | `sealedCustomerPasswordReset`                                                                                       | new password, repeat                                           |
| dashboard `PasswordView`                         | `sealedCustomerPasswordChange`                                                                                      | old and new password                                           |
| dashboard `EmailForm`                            | `sealedCustomerEmailUpdate`                                                                                         | e-mail                                                         |
| dashboard `AddressesView`                        | `sealedCustomerDeliveryAddressAdd`, `sealedCustomerInvoiceAddressSet`                                               | the address as one JSON object                                 |
| account summary, address books, checkout address | `customer { sealedPii }`, `customerDeliveryAddresses { sealedAddress }`, `customerInvoiceAddress { sealedAddress }` | e-mail, names, birth date, address and contact fields (answer) |

The documents ask for the sealed twin fields; `GraphqlClient` of oxid-fe-core opens them and puts the plain field names back
(`email`, `firstName`, `street`, `zipCode`, …), so the views are unchanged. The write documents declare
`SealedValueInput` variables; `src/sealing.ts` names which variable is sealed under which path
(`sealedArguments('sealedCustomerPasswordChange', ['old','old'], ['new','new'])`; the order is the order of the operation's arguments).

## How it is wired

`createCore` (`src/core.ts`) creates `SealedChannel` (app `shop`, **no token binding**: customer tokens rotate; the channel key
is the capability), gives it to the client (`client.setSealing`) and turns `AuthService.sealedLogin` on. The channel opens on
the first sealed call (`sealedChannelOpen`, one handshake per page load that seals something), the private key is
non-extractable and in memory only (**no Web Storage**), sealed requests run one at a time, every attempt is sealed anew and
a `sealed_channel_expired` is answered by one re-open and one repeat.

## What stays plain, and why

- The **bearer token** (`Authorization` header, needed on every request) and the tokens in the answers of `sealedLogin` /
  `sealedToken` / `sealedCustomerPasswordChange`.
- **Guest checkout** details and everything of the checkout, basket and payment flows that is not on the list above.
- The vendor operations `token`, `login`, `customerPasswordChange`, `customerRegister`, `customerEmailUpdate` and the plain
  fields of `Customer` and the addresses still exist on the shop (graphql-base, graphql-storefront: not editable from the
  module). **This app no longer calls them.** A shop that wants them gone filters them at its edge.
- There is **no registration screen** in this app; `sealedCustomerRegister` exists on the shop for projects that add one.

## Requirements and switch-over

The shop needs `oe_sealed_channel` (and graphql-storefront). **Without the module the sealed documents fail**: there is no
fallback to plain values, on purpose (an intermediary that blocked the handshake would otherwise get the password).
Order for a live shop: the module on the shop (it accepts plain and sealed values), then this build, then, when no client sends
plain values any more, the module setting `oeSealedChannelStrict`. Older builds keep working until strict is on.

## Tests

`tests/unit/sealedAccount.spec.ts` runs the real `createCore` and the account documents against the shop side in Node crypto and
asserts that no request body holds a plain password, e-mail or address and that the answers open into the plain shape;
oxid-fe-core `tests/unit/sealing/` (the known-answer vector shared with PHP) and `AuthServiceSealed.spec.ts`.
