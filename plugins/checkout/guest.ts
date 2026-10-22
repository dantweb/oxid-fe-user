import { addressSchema, type GuestAddress, type GuestDetails } from '@dantweb/oxid-fe-core';

/** What the guest form edits: strings only, so every field binds to an input. */
export interface GuestAddressForm {
  salutation: string;
  firstName: string;
  lastName: string;
  street: string;
  streetNumber: string;
  zipCode: string;
  city: string;
  countryId: string;
}

export interface GuestForm {
  email: string;
  invoice: GuestAddressForm;
  /** the "deliver elsewhere" toggle: only then is `delivery` validated and sent */
  deliverElsewhere: boolean;
  delivery: GuestAddressForm;
}

export interface GuestValidation {
  details: GuestDetails | null;
  /** field path (`email`, `invoice.city`, `delivery.zipCode`) → i18n key of its message */
  errors: Record<string, string>;
}

const REQUIRED_KEY = 'checkout.guest.invalid.required';
const EMAIL_KEY = 'checkout.guest.invalid.email';
/** one "@", something on both sides, a dot in the domain, no whitespace — the shop does the real check */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyAddress = (countryId: string): GuestAddressForm => ({
  salutation: 'MR',
  firstName: '',
  lastName: '',
  street: '',
  streetNumber: '',
  zipCode: '',
  city: '',
  countryId,
});

export function emptyGuestForm(countryId: string): GuestForm {
  return {
    email: '',
    invoice: emptyAddress(countryId),
    deliverElsewhere: false,
    delivery: emptyAddress(countryId),
  };
}

function trimmedAddress(form: GuestAddressForm): GuestAddress {
  const address: GuestAddress = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    street: form.street.trim(),
    streetNumber: form.streetNumber.trim(),
    zipCode: form.zipCode.trim(),
    city: form.city.trim(),
    countryId: form.countryId,
  };
  return form.salutation ? { salutation: form.salutation, ...address } : address;
}

function addressErrors(form: GuestAddressForm, prefix: string): Record<string, string> {
  const parsed = addressSchema.safeParse(trimmedAddress(form));
  if (parsed.success) {
    return {};
  }
  return Object.fromEntries(
    parsed.error.issues.map((issue) => [`${prefix}.${issue.path.join('.')}`, REQUIRED_KEY]),
  );
}

/** Client-side check of the form, so the shopper sees what is missing before anything is sent. */
export function validateGuestForm(form: GuestForm): GuestValidation {
  const email = form.email.trim();
  const errors: Record<string, string> = {
    ...(EMAIL_SHAPE.test(email) ? {} : { email: EMAIL_KEY }),
    ...addressErrors(form.invoice, 'invoice'),
    ...(form.deliverElsewhere ? addressErrors(form.delivery, 'delivery') : {}),
  };
  if (Object.keys(errors).length > 0) {
    return { details: null, errors };
  }
  const details: GuestDetails = { email, invoiceAddress: trimmedAddress(form.invoice) };
  if (form.deliverElsewhere) {
    details.deliveryAddress = trimmedAddress(form.delivery);
  }
  return { details, errors: {} };
}
