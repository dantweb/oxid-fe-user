<script setup lang="ts">
import { addressSchema, GraphqlError, type AddressInput } from '@dantweb/oxid-fe-core';
import { onMounted, reactive, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import {
  INVOICE_ADDRESS_QUERY,
  SET_INVOICE_ADDRESS,
  type InvoiceAddress,
} from '../../checkout/api/queries';
import {
  DELIVERY_ADDRESSES_QUERY,
  DELIVERY_ADDRESS_ADD,
  DELIVERY_ADDRESS_DELETE,
  type DeliveryAddress,
} from '../api/queries';
import { useDashboardContext } from '../index';

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client } = useDashboardContext();

const DEFAULT_COUNTRY_ID = 'a7c40f631fc920687.20179984';

const invoice = reactive<AddressInput>({
  salutation: 'MR',
  firstName: '',
  lastName: '',
  street: '',
  streetNumber: '',
  zipCode: '',
  city: '',
  countryId: DEFAULT_COUNTRY_ID,
});
const invoiceSaved = ref(false);
const invoiceError = ref<string | null>(null);

const deliveryAddresses = ref<DeliveryAddress[]>([]);
const adding = ref(false);
const draft = reactive<AddressInput>({
  salutation: 'MR',
  firstName: '',
  lastName: '',
  street: '',
  streetNumber: '',
  zipCode: '',
  city: '',
  countryId: DEFAULT_COUNTRY_ID,
});

onMounted(async () => {
  try {
    const data = await client.execute<{ customerInvoiceAddress: InvoiceAddress | null }>(
      INVOICE_ADDRESS_QUERY,
    );
    const existing = data.customerInvoiceAddress;
    if (existing?.firstName) {
      Object.assign(invoice, {
        salutation: existing.salutation ?? 'MR',
        firstName: existing.firstName,
        lastName: existing.lastName,
        street: existing.street,
        streetNumber: existing.streetNumber,
        zipCode: existing.zipCode,
        city: existing.city,
        countryId: existing.country?.id ?? DEFAULT_COUNTRY_ID,
      });
    }
  } catch {
    /* no invoice address yet */
  }
  await loadDeliveryAddresses();
});

async function loadDeliveryAddresses(): Promise<void> {
  const data = await client.execute<{ customerDeliveryAddresses: DeliveryAddress[] }>(
    DELIVERY_ADDRESSES_QUERY,
  );
  deliveryAddresses.value = data.customerDeliveryAddresses;
}

async function saveInvoice(): Promise<void> {
  invoiceError.value = null;
  invoiceSaved.value = false;
  const parsed = addressSchema.safeParse(invoice);
  if (!parsed.success) {
    invoiceError.value = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    return;
  }
  try {
    await client.execute(SET_INVOICE_ADDRESS, { address: parsed.data });
    invoiceSaved.value = true;
  } catch (cause) {
    invoiceError.value = cause instanceof GraphqlError ? cause.message : String(cause);
  }
}

async function addDelivery(): Promise<void> {
  const parsed = addressSchema.safeParse(draft);
  if (!parsed.success) {
    return;
  }
  await client.execute(DELIVERY_ADDRESS_ADD, { address: parsed.data });
  adding.value = false;
  await loadDeliveryAddresses();
}

async function removeDelivery(id: string): Promise<void> {
  await client.execute(DELIVERY_ADDRESS_DELETE, { id });
  await loadDeliveryAddresses();
}
</script>

<template>
  <section>
    <h1>{{ t('dashboard.addresses.headline') }}</h1>

    <h2>{{ t('dashboard.addresses.invoice') }}</h2>
    <form class="address" data-testid="invoice-form" @submit.prevent="saveInvoice">
      <label
        >{{ t('checkout.address.firstName') }}<input v-model="invoice.firstName" name="firstName"
      /></label>
      <label
        >{{ t('checkout.address.lastName') }}<input v-model="invoice.lastName" name="lastName"
      /></label>
      <label
        >{{ t('checkout.address.street') }}<input v-model="invoice.street" name="street"
      /></label>
      <label
        >{{ t('checkout.address.streetNumber')
        }}<input v-model="invoice.streetNumber" name="streetNumber"
      /></label>
      <label
        >{{ t('checkout.address.zipCode') }}<input v-model="invoice.zipCode" name="zipCode"
      /></label>
      <label>{{ t('checkout.address.city') }}<input v-model="invoice.city" name="city" /></label>
      <p v-if="invoiceError" role="alert">{{ invoiceError }}</p>
      <p v-if="invoiceSaved" data-testid="invoice-saved">{{ t('dashboard.addresses.saved') }}</p>
      <button type="submit" data-testid="save-invoice">{{ t('checkout.address.save') }}</button>
    </form>

    <h2>{{ t('dashboard.addresses.delivery') }}</h2>
    <p v-if="deliveryAddresses.length === 0" data-testid="delivery-empty">
      {{ t('dashboard.addresses.empty') }}
    </p>
    <ul>
      <li v-for="entry in deliveryAddresses" :key="entry.id" data-testid="delivery-row">
        {{ entry.firstName }} {{ entry.lastName }}, {{ entry.street }} {{ entry.streetNumber }},
        {{ entry.zipCode }} {{ entry.city }}
        <button type="button" @click="removeDelivery(entry.id)">
          {{ t('dashboard.addresses.delete') }}
        </button>
      </li>
    </ul>
    <button v-if="!adding" type="button" data-testid="add-delivery" @click="adding = true">
      {{ t('dashboard.addresses.add') }}
    </button>
    <form v-else class="address" data-testid="delivery-form" @submit.prevent="addDelivery">
      <label
        >{{ t('checkout.address.firstName') }}<input v-model="draft.firstName" name="dFirstName"
      /></label>
      <label
        >{{ t('checkout.address.lastName') }}<input v-model="draft.lastName" name="dLastName"
      /></label>
      <label
        >{{ t('checkout.address.street') }}<input v-model="draft.street" name="dStreet"
      /></label>
      <label
        >{{ t('checkout.address.streetNumber')
        }}<input v-model="draft.streetNumber" name="dStreetNumber"
      /></label>
      <label
        >{{ t('checkout.address.zipCode') }}<input v-model="draft.zipCode" name="dZipCode"
      /></label>
      <label>{{ t('checkout.address.city') }}<input v-model="draft.city" name="dCity" /></label>
      <button type="submit" data-testid="save-delivery">{{ t('dashboard.addresses.add') }}</button>
    </form>
  </section>
</template>

<style scoped>
.address {
  display: grid;
  grid-template-columns: repeat(2, minmax(160px, 280px));
  gap: 12px;
  margin-bottom: 24px;
}
.address label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.address input {
  padding: 8px;
  border: 1px solid var(--oxfe-color-input-border, #ccc);
  border-radius: var(--oxfe-radius-sm, 4px);
}
li {
  margin: 6px 0;
}
</style>
