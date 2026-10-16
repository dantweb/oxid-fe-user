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
import AccountLayout from '../components/AccountLayout.vue';
import EmailForm from '../components/EmailForm.vue';
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
  <AccountLayout active="addresses">
    <h2>{{ t('dashboard.menu.addresses') }}</h2>
    <EmailForm />

    <h2>{{ t('dashboard.addresses.invoice') }}</h2>
    <form class="address" data-testid="invoice-form" @submit.prevent="saveInvoice">
      <label
        >{{ t('checkout.address.firstName')
        }}<input v-model="invoice.firstName" class="form-control" name="firstName"
      /></label>
      <label
        >{{ t('checkout.address.lastName')
        }}<input v-model="invoice.lastName" class="form-control" name="lastName"
      /></label>
      <label
        >{{ t('checkout.address.street')
        }}<input v-model="invoice.street" class="form-control" name="street"
      /></label>
      <label
        >{{ t('checkout.address.streetNumber')
        }}<input v-model="invoice.streetNumber" class="form-control" name="streetNumber"
      /></label>
      <label
        >{{ t('checkout.address.zipCode')
        }}<input v-model="invoice.zipCode" class="form-control" name="zipCode"
      /></label>
      <label
        >{{ t('checkout.address.city')
        }}<input v-model="invoice.city" class="form-control" name="city"
      /></label>
      <p v-if="invoiceError" class="alert alert-danger" role="alert">{{ invoiceError }}</p>
      <p v-if="invoiceSaved" class="alert alert-success" data-testid="invoice-saved">
        {{ t('dashboard.addresses.saved') }}
      </p>
      <button type="submit" class="btn btn-primary" data-testid="save-invoice">
        {{ t('checkout.address.save') }}
      </button>
    </form>

    <h2>{{ t('dashboard.addresses.delivery') }}</h2>
    <p v-if="deliveryAddresses.length === 0" data-testid="delivery-empty">
      {{ t('dashboard.addresses.empty') }}
    </p>
    <ul>
      <li v-for="entry in deliveryAddresses" :key="entry.id" data-testid="delivery-row">
        {{ entry.firstName }} {{ entry.lastName }}, {{ entry.street }} {{ entry.streetNumber }},
        {{ entry.zipCode }} {{ entry.city }}
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          @click="removeDelivery(entry.id)"
        >
          {{ t('dashboard.addresses.delete') }}
        </button>
      </li>
    </ul>
    <button
      v-if="!adding"
      type="button"
      class="btn btn-outline-primary"
      data-testid="add-delivery"
      @click="adding = true"
    >
      {{ t('dashboard.addresses.add') }}
    </button>
    <form v-else class="address" data-testid="delivery-form" @submit.prevent="addDelivery">
      <label
        >{{ t('checkout.address.firstName')
        }}<input v-model="draft.firstName" class="form-control" name="dFirstName"
      /></label>
      <label
        >{{ t('checkout.address.lastName')
        }}<input v-model="draft.lastName" class="form-control" name="dLastName"
      /></label>
      <label
        >{{ t('checkout.address.street')
        }}<input v-model="draft.street" class="form-control" name="dStreet"
      /></label>
      <label
        >{{ t('checkout.address.streetNumber')
        }}<input v-model="draft.streetNumber" class="form-control" name="dStreetNumber"
      /></label>
      <label
        >{{ t('checkout.address.zipCode')
        }}<input v-model="draft.zipCode" class="form-control" name="dZipCode"
      /></label>
      <label
        >{{ t('checkout.address.city')
        }}<input v-model="draft.city" class="form-control" name="dCity"
      /></label>
      <button type="submit" class="btn btn-primary" data-testid="save-delivery">
        {{ t('dashboard.addresses.add') }}
      </button>
    </form>
  </AccountLayout>
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
li {
  margin: 6px 0;
}
</style>
