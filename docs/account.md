# Account area — parity with the Apex theme (and its button styles)

The reference is the **Apex theme** (`vendor/oxid-esales/apex-theme`, `tpl/page/account/*`,
`build/scss`, compiled `out/apex/src/css/styles.min.css`): what an OXID shopper can do in
"My account" there, they can do here, in the SPA, over the storefront GraphQL API.

## Feature map

| Apex page (`cl=`)                   | Apex function                                                        | SPA route                                    | Storefront API                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `account` (dashboard)               | greeting, **cards** with counts, "Where do you want to go?" menu     | `/dashboard`                                 | `customer { firstName orders reviews files baskets }`                                                                |
| `account_password`                  | change password (old + new + repeat)                                 | `/dashboard/password`                        | `customerPasswordChange`                                                                                             |
| `account_newsletter`                | subscribe / unsubscribe (double opt-in)                              | `/dashboard/newsletter`                      | `customer.newsletterStatus`, `newsletterSubscribe`, `newsletterUnsubscribe`                                          |
| `account_user` (billing & shipping) | invoice address, delivery addresses (add / delete), e-mail, birthday | `/dashboard/addresses`, `/dashboard/profile` | `customerInvoiceAddressSet`, `customerDeliveryAddress{Add,Delete}`, `customerEmailUpdate`, `customerBirthdateUpdate` |
| `account_order`                     | order history, order details                                         | `/dashboard/orders[/:id]`                    | `customer.orders`                                                                                                    |
| `account_noticelist` (wish list)    | products noted for later, remove, count badge                        | `/dashboard/wishlist`                        | basket titled `noticelist` (`basketCreate`, `basketAddItem`, `basketRemoveItem`)                                     |
| `account_wishlist` (gift registry)  | registry items, public / private                                     | `/dashboard/gift-registry`                   | basket titled `wishlist`, `basketMakePublic` / `basketMakePrivate`                                                   |
| `account_reviewlist`                | own reviews, delete                                                  | `/dashboard/reviews`                         | `customer.reviews`, `reviewDelete`                                                                                   |
| `account_downloads`                 | downloadable files of orders                                         | `/dashboard/downloads`                       | `customer.files`, `Order.files`                                                                                      |
| `forgotpwd`                         | "forgot password" → mail → set a new password                        | `/forgot-password`, `/reset-password`        | `customerPasswordForgotRequest`, `customerPasswordReset`                                                             |
| `delete_my_account_confirmation`    | delete the account after a confirmation                              | `/dashboard/delete`                          | `customerDelete`                                                                                                     |
| `compare`, `account_recommlist`     | compare list, listmania — **switched off by default in Apex too**    | — (not in the API)                           | none: documented as out of scope                                                                                     |

Apex hides pages by shop setting (`getShowWishlist`, `isEnabledDownloadableFiles`,
`isUserAllowedToManageOwnReviews`, account deletion). The API does not expose those settings, so
the SPA shows a card/menu entry when it has something to offer — **downloads** when the customer has
files, **reviews** when they have written some — and otherwise lets the shop answer: two actions
are shop settings that refuse with a clear message when off, which the SPA shows and keeps the data
(`blAllowUsersToManageTheirReviews` → deleting a review, `blAllowUsersToDeleteTheirAccount` →
deleting the account; both are **off** in the SDK shop). The e2e proves the refusal by default and
the real deletion with `E2E_SHOP_ALLOWS_ACCOUNT_MANAGEMENT=1` (settings on).

## The shell: menu + cards

Every account page sits in one **account layout**: a heading ("Hello <first name>") and Apex's
dropdown menu "Where do you want to go?" listing the pages above with the active one marked and
count badges (wish list, gift registry). The dashboard shows Apex's **cards** (`card-lg`, title +
text + an outline button "More", whole card clickable) with the counts.

## Button styles (Apex = Bootstrap 5 buttons with its variables)

Taken from Apex's compiled stylesheet and shared by the whole storefront, not only the account:

| Class                  | Look (Apex values)                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `.btn`                 | padding `.375rem .75rem`, 1px border, radius `.375rem`, line-height 1.5, fluid size, disabled: opacity `.65` + no pointer events |
| `.btn-primary`         | filled with the theme's primary colour (Apex: black), contrast text                                                              |
| `.btn-outline-primary` | transparent, primary border + text; hover fills                                                                                  |
| `.btn-secondary`       | white fill (theme surface), dark text                                                                                            |
| `.btn-link`            | link look, underlined                                                                                                            |
| `.btn-sm` / `.btn-lg`  | padding `.25rem .5rem` radius `.25rem` / padding `.5rem 1rem` radius `.5rem`                                                     |
| `.stretched-link`      | makes the whole card the click target                                                                                            |

Colours come from the theme tokens (`--oxfe-color-primary`, `-contrast`, `-border`, `-surface`),
so every theme restyles every button. The look lives in core (`styles/components.css`) because
shop, checkout and dashboard plugins all use it. A new **`apex` theme** (black primary, white
surface, Apex's radius) lets an instance run the Apex look: `theme: { active: apex }`.

## Forgot / reset password

`/forgot-password` asks for the e-mail (`customerPasswordForgotRequest`), always answering "if the
address is known, a mail is on its way" (no account enumeration). The shop's mail carries an
update key (`…cl=forgotpwd&uid=<key>`); the SPA's `/reset-password?uid=<key>` takes the new password
twice (`customerPasswordReset`). The login page links to the form. **Deployment note:** the mail's
link points at the shop's own page, so a headless deployment forwards `cl=forgotpwd&uid=…` to the
frontend's `/reset-password?uid=…` (shop mail template or an edge rule); the e2e takes the key from
the mail (Mailpit) and opens the SPA route.

## What "parity" means here — the proof

`tests/e2e/account-*.spec.ts` run against the dev server and the public ports (`:2083`, `:8443`,
`:2053`): every feature of the map above is exercised as a customer would, including the failure
paths (wrong old password, mismatching repeat, deleting only after confirmation), and
`account-buttons.spec.ts` asserts the computed button styles against the Apex values. Screenshots
of each account page for the default and the `apex` theme go to
`docs/dev_log/20261016/reports/account/`.
