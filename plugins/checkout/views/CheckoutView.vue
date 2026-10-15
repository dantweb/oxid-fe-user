<script setup lang="ts">
import { addressSchema, GraphqlError, type AddressInput } from '@dantweb/oxid-fe-core';
import { computed, onMounted, reactive, ref } from 'vue';
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { useCartStore } from '../../shop/stores/cart';
import {
  BASKET_ADD_ITEM,
  BASKET_CREATE,
  BASKET_DELIVERY_METHODS,
  BASKET_PAYMENTS,
  BASKET_SET_DELIVERY_METHOD,
  BASKET_SET_PAYMENT,
  INVOICE_ADDRESS_QUERY,
  PLACE_ORDER,
  SET_INVOICE_ADDRESS,
  type DeliveryMethod,
  type InvoiceAddress,
} from '../api/queries';
import { checkoutUrls, mapPayments, type PaymentChoice } from '../lib';
import { useCheckoutContext } from '../index';
import { useCheckoutStore } from '../stores/checkout';

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client, registry } = useCheckoutApi();
const cart = useCartStore();
const checkout = useCheckoutStore();

const DEFAULT_COUNTRY_ID = 'a7c40f631fc920687.20179984'; // Germany (demo shop default)

const address = reactive<AddressInput>({
  salutation: 'MR',
  firstName: '',
  lastName: '',
  street: '',
  streetNumber: '',
  zipCode: '',
  city: '',
  countryId: DEFAULT_COUNTRY_ID,
});
const addressSaved = ref(false);
const addressError = ref<string | null>(null);

const basketId = ref<string | null>(null);
const deliveryMethods = ref<DeliveryMethod[]>([]);
const deliveryMethodId = ref<string | null>(null);
const payments = ref<PaymentChoice[]>([]);
const selectedPaymentId = ref<string | null>(null);
const termsConfirmed = ref(false);
const busy = ref(false);
const redirecting = ref(false);
const error = ref<string | null>(null);
const placedOrderNumber = ref<string | null>(null);

const readyToPay = computed(
  () =>
    basketId.value !== null &&
    deliveryMethodId.value !== null &&
    selectedPaymentId.value !== null &&
    termsConfirmed.value &&
    !busy.value,
);

function useCheckoutApi() {
  const ctx = useCheckoutContext();
  return { client: ctx.client, registry: ctx.registry };
}

onMounted(async () => {
  try {
    const data = await client.execute<{ customerInvoiceAddress: InvoiceAddress | null }>(
      INVOICE_ADDRESS_QUERY,
    );
    const existing = data.customerInvoiceAddress;
    if (existing?.firstName && existing.street) {
      Object.assign(address, {
        salutation: existing.salutation ?? 'MR',
        firstName: existing.firstName,
        lastName: existing.lastName,
        street: existing.street,
        streetNumber: existing.streetNumber,
        zipCode: existing.zipCode,
        city: existing.city,
        countryId: existing.country?.id ?? DEFAULT_COUNTRY_ID,
      });
      addressSaved.value = true;
      await prepareBasket();
    }
  } catch {
    /* no address yet — the form collects one */
  }
});

async function saveAddress(): Promise<void> {
  addressError.value = null;
  const parsed = addressSchema.safeParse(address);
  if (!parsed.success) {
    addressError.value = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    return;
  }
  busy.value = true;
  try {
    await client.execute(SET_INVOICE_ADDRESS, { address: parsed.data });
    addressSaved.value = true;
    await prepareBasket();
  } catch (cause) {
    addressError.value = messageOf(cause);
  } finally {
    busy.value = false;
  }
}

/** Fresh server-side basket per attempt — a cancelled attempt blocks its old basket. */
async function prepareBasket(): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    const created = await client.execute<{ basketCreate: { id: string } }>(BASKET_CREATE, {
      title: `fe-checkout-${Date.now()}`,
    });
    for (const item of cart.items) {
      await client.execute(BASKET_ADD_ITEM, {
        basketId: created.basketCreate.id,
        productId: item.productId,
        amount: item.amount,
      });
    }
    basketId.value = created.basketCreate.id;

    const methods = await client.execute<{ basketDeliveryMethods: DeliveryMethod[] }>(
      BASKET_DELIVERY_METHODS,
      { basketId: basketId.value },
    );
    deliveryMethods.value = methods.basketDeliveryMethods;
    if (methods.basketDeliveryMethods.length === 1) {
      await selectDelivery(methods.basketDeliveryMethods[0].id);
    }
  } catch (cause) {
    error.value = t('checkout.errors.basket', { message: messageOf(cause) });
  } finally {
    busy.value = false;
  }
}

async function selectDelivery(methodId: string): Promise<void> {
  if (!basketId.value) {
    return;
  }
  await client.execute(BASKET_SET_DELIVERY_METHOD, {
    basketId: basketId.value,
    deliveryMethodId: methodId,
  });
  deliveryMethodId.value = methodId;

  const offered = await client.execute<{ basketPayments: { id: string; title: string }[] }>(
    BASKET_PAYMENTS,
    { basketId: basketId.value },
  );
  payments.value = mapPayments(offered.basketPayments, (id) => registry.paymentPluginFor(id));
  if (payments.value.length === 1) {
    selectedPaymentId.value = payments.value[0].payment.id;
  }
}

async function pay(): Promise<void> {
  const choice = payments.value.find((entry) => entry.payment.id === selectedPaymentId.value);
  if (!choice || !basketId.value) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    if (choice.plugin) {
      const urls = checkoutUrls(window.location.origin, choice.plugin.name);
      const result = await choice.plugin.start(basketId.value, urls);
      checkout.setAttempt({
        provider: choice.plugin.name,
        contractId: result.contractId,
        contractToken: result.contractToken,
        orderNumber: result.orderNumber,
      });
      if (result.renderMode === 'redirect' && result.redirectUrl) {
        redirecting.value = true;
        window.location.assign(result.redirectUrl);
        return;
      }
      throw new Error(`unsupported renderMode: ${result.renderMode}`);
    }
    // Classic, non-contract payment: basketSetPayment + placeOrder
    await client.execute(BASKET_SET_PAYMENT, {
      basketId: basketId.value,
      paymentId: choice.payment.id,
    });
    const placed = await client.execute<{ placeOrder: { orderNumber: string } }>(PLACE_ORDER, {
      basketId: basketId.value,
    });
    placedOrderNumber.value = String(placed.placeOrder.orderNumber);
    cart.clear();
  } catch (cause) {
    error.value = t('checkout.errors.start', { message: messageOf(cause) });
    basketId.value = null; // attempt consumed the basket — prepare a fresh one
    await prepareBasket();
  } finally {
    busy.value = false;
  }
}

function messageOf(cause: unknown): string {
  return cause instanceof GraphqlError || cause instanceof Error ? cause.message : String(cause);
}
</script>

<template>
  <section>
    <h1>{{ t('checkout.headline') }}</h1>

    <p v-if="placedOrderNumber" data-testid="order-confirmed">
      {{ t('checkout.return.committed', { orderNumber: placedOrderNumber }) }}
    </p>

    <template v-else>
      <h2>{{ t('checkout.address.headline') }}</h2>
      <form
        v-if="!addressSaved"
        class="address"
        data-testid="address-form"
        @submit.prevent="saveAddress"
      >
        <label
          >{{ t('checkout.address.firstName') }}<input v-model="address.firstName" name="firstName"
        /></label>
        <label
          >{{ t('checkout.address.lastName') }}<input v-model="address.lastName" name="lastName"
        /></label>
        <label
          >{{ t('checkout.address.street') }}<input v-model="address.street" name="street"
        /></label>
        <label
          >{{ t('checkout.address.streetNumber')
          }}<input v-model="address.streetNumber" name="streetNumber"
        /></label>
        <label
          >{{ t('checkout.address.zipCode') }}<input v-model="address.zipCode" name="zipCode"
        /></label>
        <label>{{ t('checkout.address.city') }}<input v-model="address.city" name="city" /></label>
        <p v-if="addressError" role="alert" data-testid="address-error">{{ addressError }}</p>
        <button type="submit" :disabled="busy" data-testid="save-address">
          {{ t('checkout.address.save') }}
        </button>
      </form>
      <p v-else data-testid="address-saved">
        {{ t('checkout.address.saved') }}: {{ address.firstName }} {{ address.lastName }},
        {{ address.street }} {{ address.streetNumber }}, {{ address.zipCode }} {{ address.city }}
      </p>

      <template v-if="addressSaved">
        <h2>{{ t('checkout.delivery.headline') }}</h2>
        <p v-if="busy && !deliveryMethods.length">{{ t('checkout.delivery.loading') }}</p>
        <label v-for="method in deliveryMethods" :key="method.id" class="choice">
          <input
            type="radio"
            name="delivery"
            :checked="deliveryMethodId === method.id"
            @change="selectDelivery(method.id)"
          />
          {{ method.title }}
        </label>
      </template>

      <template v-if="deliveryMethodId">
        <h2>{{ t('checkout.payment.headline') }}</h2>
        <label v-for="choice in payments" :key="choice.payment.id" class="choice">
          <input
            v-model="selectedPaymentId"
            type="radio"
            name="payment"
            :value="choice.payment.id"
            :data-testid="`payment-${choice.payment.id}`"
          />
          {{ choice.payment.title }}
        </label>
        <label class="choice">
          <input v-model="termsConfirmed" type="checkbox" data-testid="confirm-terms" />
          {{ t('checkout.payment.terms') }}
        </label>
        <p v-if="error" role="alert" data-testid="checkout-error">{{ error }}</p>
        <p v-if="redirecting" data-testid="redirecting">{{ t('checkout.payment.redirecting') }}</p>
        <button type="button" :disabled="!readyToPay" data-testid="pay-now" @click="pay">
          {{ t('checkout.payment.pay') }}
        </button>
      </template>
    </template>
  </section>
</template>

<style scoped>
.address {
  display: grid;
  grid-template-columns: repeat(2, minmax(160px, 280px));
  gap: 12px;
}
.address label,
.choice {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.choice {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
input[type='text'],
.address input {
  padding: 8px;
  border: 1px solid var(--oxfe-color-input-border, #ccc);
  border-radius: var(--oxfe-radius-sm, 4px);
}
button {
  padding: 10px 20px;
  border: none;
  border-radius: var(--oxfe-radius-md, 6px);
  background: var(--oxfe-color-primary, #0a5d9c);
  color: var(--oxfe-color-primary-contrast, #fff);
  margin-top: 12px;
}
button:disabled {
  background: var(--oxfe-color-primary-disabled, #9bb8cc);
}
</style>
