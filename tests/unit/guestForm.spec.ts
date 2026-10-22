import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyGuestForm, validateGuestForm } from '../../plugins/checkout/guest';
import { useCheckoutStore } from '../../plugins/checkout/stores/checkout';

const COUNTRY = 'a7c40f631fc920687.20179984';
const filled = () => {
  const form = emptyGuestForm(COUNTRY);
  form.email = ' gerda@example.com ';
  Object.assign(form.invoice, {
    salutation: 'MRS',
    firstName: 'Gerda',
    lastName: 'Gast',
    street: 'Bertoldstr',
    streetNumber: '48',
    zipCode: '79098',
    city: 'Freiburg',
  });
  return form;
};

describe('validateGuestForm', () => {
  it('builds the GuestDetails the shop expects, trimmed, without a delivery address by default', () => {
    const { details, errors } = validateGuestForm(filled());

    expect(errors).toEqual({});
    expect(details).toEqual({
      email: 'gerda@example.com',
      invoiceAddress: {
        salutation: 'MRS',
        firstName: 'Gerda',
        lastName: 'Gast',
        street: 'Bertoldstr',
        streetNumber: '48',
        zipCode: '79098',
        city: 'Freiburg',
        countryId: COUNTRY,
      },
    });
  });

  it('names every empty required field, with the i18n key of its message', () => {
    const { details, errors } = validateGuestForm(emptyGuestForm(COUNTRY));

    expect(details).toBeNull();
    expect(errors).toMatchObject({
      email: 'checkout.guest.invalid.email',
      'invoice.firstName': 'checkout.guest.invalid.required',
      'invoice.lastName': 'checkout.guest.invalid.required',
      'invoice.street': 'checkout.guest.invalid.required',
      'invoice.streetNumber': 'checkout.guest.invalid.required',
      'invoice.zipCode': 'checkout.guest.invalid.required',
      'invoice.city': 'checkout.guest.invalid.required',
    });
    expect(Object.keys(errors)).not.toContain('invoice.countryId');
  });

  it.each(['no-at-sign', 'a@b', '@example.com', 'a b@example.com'])(
    'refuses the e-mail %j',
    (email) => {
      const form = filled();
      form.email = email;

      expect(validateGuestForm(form).errors.email).toBe('checkout.guest.invalid.email');
    },
  );

  it('ignores the delivery fields while "deliver elsewhere" is off', () => {
    const form = filled();
    form.delivery.firstName = '';

    expect(validateGuestForm(form).details?.deliveryAddress).toBeUndefined();
  });

  it('validates and sends the delivery address when "deliver elsewhere" is on', () => {
    const form = filled();
    form.deliverElsewhere = true;
    expect(validateGuestForm(form).errors['delivery.firstName']).toBe(
      'checkout.guest.invalid.required',
    );

    Object.assign(form.delivery, {
      firstName: 'Hans',
      lastName: 'Gast',
      street: 'Hauptstr',
      streetNumber: '1',
      zipCode: '10115',
      city: 'Berlin',
    });
    expect(validateGuestForm(form).details?.deliveryAddress).toMatchObject({
      firstName: 'Hans',
      city: 'Berlin',
      countryId: COUNTRY,
    });
  });

  it('leaves out an empty salutation instead of sending ""', () => {
    const form = filled();
    form.invoice.salutation = '';

    expect(validateGuestForm(form).details?.invoiceAddress).not.toHaveProperty('salutation');
  });
});

describe('guest details in the checkout store — memory only (138e policy)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setActivePinia(createPinia());
  });

  const details = validateGuestForm(filled()).details!;

  it('keeps the details for this page view', () => {
    const store = useCheckoutStore();
    store.setGuest(details);

    expect(store.guest).toEqual(details);
  });

  it('writes them to neither sessionStorage nor localStorage', () => {
    useCheckoutStore().setGuest(details);

    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain('gerda');
    expect(sessionStorage.length + localStorage.length).toBe(0);
  });

  it('a new store (a reload) starts without them', () => {
    useCheckoutStore().setGuest(details);
    setActivePinia(createPinia());

    expect(useCheckoutStore().guest).toBeNull();
  });

  it('clear() drops them together with the attempt', () => {
    const store = useCheckoutStore();
    store.setGuest(details);
    store.clear();

    expect(store.guest).toBeNull();
  });
});
